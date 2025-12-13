/**
 * Script to create a new master snapshot with php-sqlite3, php-apcu, and np/ folder preloaded
 *
 * Run with: npx tsx scripts/create-snapshot.ts
 */

import { PrismaClient } from "@prisma/client";
import { NodeSSH } from "node-ssh";

const prisma = new PrismaClient();

const DO_API_URL = "https://api.digitalocean.com/v2";

interface SshAuthOptions {
  password?: string;
  privateKey?: string;
}

async function request<T>(apiKey: string, endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DO_API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(`DigitalOcean API error: ${response.status} - ${error.message || JSON.stringify(error)}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

async function executeRemoteScript(
  host: string,
  auth: SshAuthOptions,
  script: string,
  timeout: number = 60000
): Promise<{ stdout: string; stderr: string; code: number }> {
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host,
      username: "root",
      password: auth.password,
      privateKey: auth.privateKey,
      readyTimeout: timeout,
    });

    const result = await ssh.execCommand(script, {
      execOptions: { pty: true },
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code ?? 0,
    };
  } finally {
    ssh.dispose();
  }
}

async function waitForSsh(host: string, auth: SshAuthOptions, maxWaitMs: number = 120000): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = await executeRemoteScript(host, auth, 'echo "SSH ready"', 10000);
      if (result.code === 0) {
        return true;
      }
    } catch {
      // SSH not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return false;
}

// NP_FILES content - importing dynamically
async function getNpFiles(): Promise<Record<string, string>> {
  // Import the np-files modules
  const { NP_FILES } = await import("../packages/core/src/website-generator/np-files");
  await import("../packages/core/src/website-generator/np-files-large");
  await import("../packages/core/src/website-generator/np-files-go");
  return NP_FILES;
}

async function main() {
  console.log("🚀 Starting master snapshot creation...\n");

  // Get settings
  const settings = await prisma.appSettings.findFirst();

  if (!settings?.digitaloceanApiKey) {
    throw new Error("DigitalOcean API key not configured");
  }

  const apiKey = settings.digitaloceanApiKey;

  // Get SSH credentials
  let sshAuth: SshAuthOptions;
  if (settings.digitaloceanSshPrivateKey) {
    sshAuth = { privateKey: settings.digitaloceanSshPrivateKey };
  } else if (settings.digitaloceanSshPassword) {
    sshAuth = { password: settings.digitaloceanSshPassword };
  } else {
    throw new Error("No SSH credentials configured");
  }

  const sshKeyId = settings.digitaloceanSshKeyId ? parseInt(settings.digitaloceanSshKeyId) : undefined;

  if (!sshKeyId) {
    throw new Error("SSH key ID not configured in DigitalOcean settings");
  }

  const snapshotName = `magimanager-master-${Date.now()}`;

  // Step 1: Create droplet
  console.log("📦 Step 1: Creating temp droplet...");
  const createResponse = await request<{ droplet: any }>(apiKey, "/droplets", {
    method: "POST",
    body: JSON.stringify({
      name: `snapshot-builder-${Date.now()}`,
      region: "nyc1",
      size: "s-1vcpu-1gb",
      image: "ubuntu-22-04-x64",
      ssh_keys: [sshKeyId],
      tags: ["snapshot-builder"],
      monitoring: true,
    }),
  });

  const dropletId = createResponse.droplet.id;
  console.log(`   Created droplet #${dropletId}`);

  // Step 2: Wait for droplet to be active
  console.log("⏳ Step 2: Waiting for droplet to be active...");
  let dropletIp: string | null = null;
  const maxWaitTime = 300000;
  const pollInterval = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const droplet = await request<{ droplet: any }>(apiKey, `/droplets/${dropletId}`);
    if (droplet.droplet.status === "active") {
      const publicNetwork = droplet.droplet.networks?.v4?.find((n: any) => n.type === "public");
      if (publicNetwork?.ip_address) {
        dropletIp = publicNetwork.ip_address;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  if (!dropletIp) {
    throw new Error("Droplet did not become active in time");
  }
  console.log(`   Droplet active at ${dropletIp}`);

  // Step 3: Wait for SSH
  console.log("🔐 Step 3: Waiting for SSH...");
  const sshReady = await waitForSsh(dropletIp, sshAuth, 180000);
  if (!sshReady) {
    throw new Error("SSH did not become available");
  }
  console.log("   SSH is ready");

  // Wait for cloud-init to settle
  await new Promise((r) => setTimeout(r, 15000));

  // Step 4: Install packages
  console.log("📥 Step 4: Installing packages (this may take a few minutes)...");
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

# Enable APCu in CLI
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

# Find actual PHP-FPM socket and update config
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

echo "INSTALL_COMPLETE"
`;

  const installResult = await executeRemoteScript(dropletIp, sshAuth, installScript, 300000);
  if (!installResult.stdout.includes("INSTALL_COMPLETE")) {
    console.error("Install output:", installResult.stdout);
    console.error("Install stderr:", installResult.stderr);
    throw new Error("Package installation failed");
  }
  console.log("   Packages installed successfully");

  // Step 5: Create np folder and upload files
  console.log("📁 Step 5: Creating np folder and uploading files...");

  // Create directories
  const createDirsScript = `
mkdir -p /var/www/html/np/api/db
mkdir -p /var/www/html/np/app
mkdir -p /var/www/html/np/cv
chown -R www-data:www-data /var/www/html/np
echo "DIRS_CREATED"
`;
  await executeRemoteScript(dropletIp, sshAuth, createDirsScript, 30000);

  // Get NP files and upload
  const NP_FILES = await getNpFiles();
  const fileCount = Object.keys(NP_FILES).length;
  let uploaded = 0;

  for (const [filePath, content] of Object.entries(NP_FILES)) {
    const fullPath = `/var/www/html/${filePath}`;
    const base64Content = Buffer.from(content).toString("base64");
    const uploadScript = `echo "${base64Content}" | base64 -d > "${fullPath}" && chown www-data:www-data "${fullPath}"`;
    await executeRemoteScript(dropletIp, sshAuth, uploadScript, 30000);
    uploaded++;
    process.stdout.write(`\r   Uploaded ${uploaded}/${fileCount} files`);
  }
  console.log("\n   All np files uploaded");

  // Verify installation
  console.log("✅ Step 6: Verifying installation...");
  const verifyScript = `
echo "=== PHP Modules ==="
php -m | grep -i sqlite
php -m | grep -i apcu
echo "=== NP Folder ==="
ls -la /var/www/html/np/ | head -5
ls -la /var/www/html/np/api/ | head -5
`;
  const verifyResult = await executeRemoteScript(dropletIp, sshAuth, verifyScript, 30000);
  console.log(verifyResult.stdout);

  // Step 7: Cleanup for snapshot
  console.log("🧹 Step 7: Cleaning up for snapshot...");
  const cleanupScript = `
apt-get clean
apt-get autoremove -y
truncate -s 0 /var/log/*.log 2>/dev/null || true
> /root/.bash_history
history -c
cloud-init clean --logs 2>/dev/null || true
echo "CLEANUP_DONE"
`;
  await executeRemoteScript(dropletIp, sshAuth, cleanupScript, 60000);
  console.log("   Cleanup complete");

  // Step 8: Power off droplet
  console.log("⏹️  Step 8: Powering off droplet...");
  await request(apiKey, `/droplets/${dropletId}/actions`, {
    method: "POST",
    body: JSON.stringify({ type: "power_off" }),
  });

  // Wait for power off
  await new Promise((r) => setTimeout(r, 30000));
  console.log("   Powered off");

  // Step 9: Create snapshot
  console.log("📸 Step 9: Creating snapshot (this may take several minutes)...");
  const snapshotResponse = await request<{ action: { id: number } }>(apiKey, `/droplets/${dropletId}/actions`, {
    method: "POST",
    body: JSON.stringify({ type: "snapshot", name: snapshotName }),
  });

  const actionId = snapshotResponse.action.id;

  // Wait for snapshot to complete
  const snapshotStartTime = Date.now();
  const snapshotMaxWait = 600000; // 10 minutes
  while (Date.now() - snapshotStartTime < snapshotMaxWait) {
    const action = await request<{ action: { status: string } }>(apiKey, `/droplets/${dropletId}/actions/${actionId}`);
    if (action.action.status === "completed") {
      break;
    }
    if (action.action.status === "errored") {
      throw new Error("Snapshot creation failed");
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.log("\n   Snapshot created");

  // Get snapshot ID
  const snapshots = await request<{ snapshots: any[] }>(apiKey, "/snapshots?resource_type=droplet");
  const newSnapshot = snapshots.snapshots.find((s) => s.name === snapshotName);

  if (!newSnapshot) {
    throw new Error("Could not find created snapshot");
  }

  console.log(`   Snapshot ID: ${newSnapshot.id}`);

  // Step 10: Update settings
  console.log("⚙️  Step 10: Updating app settings...");
  await prisma.appSettings.updateMany({
    data: {
      digitaloceanSnapshotId: newSnapshot.id,
    },
  });
  console.log("   Settings updated");

  // Step 11: Delete temp droplet
  console.log("🗑️  Step 11: Deleting temp droplet...");
  await request(apiKey, `/droplets/${dropletId}`, { method: "DELETE" });
  console.log("   Droplet deleted");

  console.log("\n✅ SUCCESS!");
  console.log(`   New snapshot: ${snapshotName}`);
  console.log(`   Snapshot ID: ${newSnapshot.id}`);
  console.log("   All new websites will now use this snapshot.\n");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  prisma.$disconnect();
  process.exit(1);
});
