import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  getDigitalOceanClientFromSettings,
  executeRemoteScript,
  waitForSsh,
  getSshCredentialsFromSettings,
  NP_FILES,
} from "@magimanager/core";

/**
 * GET /api/digitalocean/snapshots - List all snapshots
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const client = await getDigitalOceanClientFromSettings();
    const snapshots = await client.listSnapshots();

    // Get current snapshot ID from settings
    const settings = await prisma.appSettings.findFirst();
    const currentSnapshotId = settings?.digitaloceanSnapshotId;

    return NextResponse.json({
      snapshots,
      currentSnapshotId,
    });
  } catch (error) {
    console.error("Failed to list snapshots:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list snapshots" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/digitalocean/snapshots - Create a new master snapshot
 * This creates a droplet, installs required packages, adds np folder, and creates a snapshot
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { name = `magimanager-master-${Date.now()}` } = body;

    const client = await getDigitalOceanClientFromSettings();
    const settings = await prisma.appSettings.findFirst();

    // Get SSH credentials
    let sshAuth;
    try {
      sshAuth = await getSshCredentialsFromSettings();
    } catch (error) {
      return NextResponse.json(
        { error: "SSH credentials not configured. Please set up SSH key in Settings." },
        { status: 400 }
      );
    }

    // Get SSH key ID for droplet creation
    const sshKeyId = settings?.digitaloceanSshKeyId
      ? parseInt(settings.digitaloceanSshKeyId)
      : undefined;

    if (!sshKeyId) {
      return NextResponse.json(
        { error: "SSH key not configured in DigitalOcean settings" },
        { status: 400 }
      );
    }

    // Step 1: Create a fresh droplet from Ubuntu image
    console.log("Creating temp droplet for snapshot...");
    const droplet = await client.createDroplet({
      name: `snapshot-builder-${Date.now()}`,
      region: "nyc1",
      size: "s-1vcpu-1gb",
      image: "ubuntu-22-04-x64",
      sshKeys: [sshKeyId],
      tags: ["snapshot-builder"],
    });

    // Step 2: Wait for droplet to be ready
    console.log("Waiting for droplet to be active...");
    const activeDroplet = await client.waitForDroplet(droplet.id, 300000);
    const dropletIp = activeDroplet.publicIpv4;

    if (!dropletIp) {
      throw new Error("Droplet created but no IP assigned");
    }

    // Step 3: Wait for SSH to be ready
    console.log(`Waiting for SSH on ${dropletIp}...`);
    const sshReady = await waitForSsh(dropletIp, sshAuth, 180000);
    if (!sshReady) {
      throw new Error("SSH did not become available");
    }

    // Wait a bit more for cloud-init to settle
    await new Promise(r => setTimeout(r, 10000));

    // Step 4: Install required packages
    console.log("Installing packages...");
    const installScript = `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

# Wait for any existing apt processes
while fuser /var/lib/dpkg/lock >/dev/null 2>&1; do
  sleep 5
done

# Update and install packages
apt-get update
apt-get install -y nginx php-fpm php-mysql php-curl php-json php-mbstring php-sqlite3 php-apcu unzip certbot python3-certbot-nginx curl

# Get PHP version
PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
echo "PHP Version: $PHP_VERSION"

# Configure PHP-FPM
sed -i 's/;cgi.fix_pathinfo=1/cgi.fix_pathinfo=0/' /etc/php/$PHP_VERSION/fpm/php.ini

# Enable APCu in CLI (optional but useful)
echo "apc.enable_cli=1" >> /etc/php/$PHP_VERSION/mods-available/apcu.ini

# Restart PHP-FPM
systemctl restart php$PHP_VERSION-fpm

# Create web root
mkdir -p /var/www/html

# Create generic nginx config
cat > /etc/nginx/sites-available/default << 'NGINXEOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.php index.html index.htm;

    server_name _;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location ~ /\\.ht {
        deny all;
    }
}
NGINXEOF

# Find the actual PHP-FPM socket and update nginx config
PHP_SOCKET=$(ls /var/run/php/php*-fpm.sock 2>/dev/null | head -1)
if [ -n "$PHP_SOCKET" ]; then
  sed -i "s|unix:/var/run/php/php-fpm.sock|unix:$PHP_SOCKET|g" /etc/nginx/sites-available/default
fi

# Enable site
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx

# Create placeholder
echo "<html><head><title>Server Ready</title></head><body><h1>Server Ready</h1></body></html>" > /var/www/html/index.html
chown www-data:www-data /var/www/html/index.html

echo "Package installation complete"
`;

    const installResult = await executeRemoteScript(dropletIp, sshAuth, installScript, { timeout: 300000 });
    if (installResult.code !== 0) {
      console.error("Install stderr:", installResult.stderr);
      throw new Error(`Package installation failed: ${installResult.stderr || installResult.stdout}`);
    }
    console.log("Packages installed successfully");

    // Step 5: Create np folder structure and upload files
    console.log("Creating np folder...");

    // Create directories first
    const createDirsScript = `
mkdir -p /var/www/html/np/api
mkdir -p /var/www/html/np/api/db
mkdir -p /var/www/html/np/app
mkdir -p /var/www/html/np/cv
chown -R www-data:www-data /var/www/html/np
`;
    await executeRemoteScript(dropletIp, sshAuth, createDirsScript, { timeout: 30000 });

    // Upload each np file
    for (const [filePath, content] of Object.entries(NP_FILES)) {
      const fullPath = `/var/www/html/${filePath}`;
      const base64Content = Buffer.from(content).toString("base64");
      const uploadScript = `echo "${base64Content}" | base64 -d > "${fullPath}" && chown www-data:www-data "${fullPath}"`;
      await executeRemoteScript(dropletIp, sshAuth, uploadScript, { timeout: 30000 });
    }
    console.log(`Uploaded ${Object.keys(NP_FILES).length} np files`);

    // Verify installation
    const verifyScript = `
echo "=== Verification ==="
echo "PHP SQLite3:" && php -m | grep -i sqlite || echo "NOT INSTALLED"
echo "PHP APCu:" && php -m | grep -i apcu || echo "NOT INSTALLED"
echo "NP folder:" && ls -la /var/www/html/np/ | head -10
echo "NP API folder:" && ls -la /var/www/html/np/api/ | head -5
`;
    const verifyResult = await executeRemoteScript(dropletIp, sshAuth, verifyScript, { timeout: 30000 });
    console.log("Verification:", verifyResult.stdout);

    // Step 6: Clean up for snapshot
    console.log("Cleaning up for snapshot...");
    const cleanupScript = `
# Clean apt cache
apt-get clean
apt-get autoremove -y

# Clear logs
truncate -s 0 /var/log/*.log 2>/dev/null || true
truncate -s 0 /var/log/**/*.log 2>/dev/null || true

# Clear bash history
> /root/.bash_history
history -c

# Clear cloud-init to allow it to run again on new droplets
cloud-init clean --logs 2>/dev/null || true

echo "Cleanup complete"
`;
    await executeRemoteScript(dropletIp, sshAuth, cleanupScript, { timeout: 60000 });

    // Step 7: Power off droplet for clean snapshot
    console.log("Powering off droplet...");
    await client.powerOffDroplet(droplet.id);

    // Wait for power off
    await new Promise(r => setTimeout(r, 30000));

    // Step 8: Create snapshot
    console.log("Creating snapshot...");
    const { actionId } = await client.createSnapshot(droplet.id, name);

    // Wait for snapshot to complete (can take several minutes)
    const snapshotComplete = await client.waitForAction(droplet.id, actionId, 600000);
    if (!snapshotComplete) {
      throw new Error("Snapshot creation timed out");
    }

    // Get the new snapshot ID
    const snapshots = await client.listSnapshots();
    const newSnapshot = snapshots.find(s => s.name === name);

    if (!newSnapshot) {
      throw new Error("Snapshot created but could not find it in list");
    }

    console.log(`Snapshot created: ${newSnapshot.id}`);

    // Step 9: Update settings to use new snapshot
    await prisma.appSettings.updateMany({
      data: {
        digitaloceanSnapshotId: newSnapshot.id,
      },
    });

    // Step 10: Delete the temp droplet
    console.log("Deleting temp droplet...");
    await client.deleteDroplet(droplet.id);

    return NextResponse.json({
      success: true,
      snapshot: newSnapshot,
      message: `New master snapshot created: ${newSnapshot.name} (${newSnapshot.id})`,
    });
  } catch (error) {
    console.error("Failed to create snapshot:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create snapshot" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/digitalocean/snapshots - Update current snapshot ID in settings
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { snapshotId } = body;

    if (!snapshotId) {
      return NextResponse.json(
        { error: "snapshotId is required" },
        { status: 400 }
      );
    }

    // Verify snapshot exists
    const client = await getDigitalOceanClientFromSettings();
    try {
      await client.getSnapshot(snapshotId);
    } catch {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    // Update settings
    await prisma.appSettings.updateMany({
      data: {
        digitaloceanSnapshotId: snapshotId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Settings updated to use snapshot ${snapshotId}`,
    });
  } catch (error) {
    console.error("Failed to update snapshot setting:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
