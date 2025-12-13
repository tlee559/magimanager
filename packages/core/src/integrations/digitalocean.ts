/**
 * DigitalOcean API Client
 * Documentation: https://docs.digitalocean.com/reference/api/
 */

import { prisma } from '@magimanager/database';
import { NodeSSH } from 'node-ssh';

const DO_API_URL = 'https://api.digitalocean.com/v2';

export interface DropletConfig {
  name: string;
  region: string;      // e.g., "nyc1", "sfo3"
  size: string;        // e.g., "s-1vcpu-1gb"
  image: string;       // e.g., "ubuntu-22-04-x64"
  sshKeys?: number[];  // SSH key IDs
  userData?: string;   // Cloud-init script
  tags?: string[];
}

export interface Droplet {
  id: number;
  name: string;
  status: string;      // "new", "active", "off", "archive"
  publicIpv4?: string;
  privateIpv4?: string;
  region: string;
  size: string;
  image: string;
  createdAt: string;
  memory: number;
  vcpus: number;
  disk: number;
}

export interface SshKey {
  id: number;
  name: string;
  fingerprint: string;
  publicKey: string;
}

export interface DigitalOceanError {
  id: string;
  message: string;
}

export interface Region {
  slug: string;
  name: string;
  available: boolean;
}

export interface Size {
  slug: string;
  description: string;
  priceMonthly: number;
  priceHourly: number;
  memory: number;
  vcpus: number;
  disk: number;
  available: boolean;
}

class DigitalOceanClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Make API request to DigitalOcean
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${DO_API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`DigitalOcean API error: ${response.status} - ${error.message || JSON.stringify(error)}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  /**
   * Create a new droplet
   */
  async createDroplet(config: DropletConfig): Promise<Droplet> {
    const response = await this.request<{ droplet: any }>('/droplets', {
      method: 'POST',
      body: JSON.stringify({
        name: config.name,
        region: config.region,
        size: config.size,
        image: config.image,
        ssh_keys: config.sshKeys,
        user_data: config.userData,
        tags: config.tags || ['website-wizard'],
        monitoring: true,
        ipv6: false,
      }),
    });

    return this.mapDroplet(response.droplet);
  }

  /**
   * Get droplet by ID
   */
  async getDroplet(dropletId: number): Promise<Droplet> {
    const response = await this.request<{ droplet: any }>(`/droplets/${dropletId}`);
    return this.mapDroplet(response.droplet);
  }

  /**
   * List all droplets
   */
  async listDroplets(tag?: string): Promise<Droplet[]> {
    const endpoint = tag ? `/droplets?tag_name=${encodeURIComponent(tag)}` : '/droplets';
    const response = await this.request<{ droplets: any[] }>(endpoint);
    return response.droplets.map(d => this.mapDroplet(d));
  }

  /**
   * Get a snapshot by ID
   * Returns snapshot details including which regions it's available in
   */
  async getSnapshot(snapshotId: string): Promise<{
    id: string;
    name: string;
    regions: string[];
    createdAt: string;
    minDiskSize: number;
    sizeGigabytes: number;
  }> {
    const response = await this.request<{ snapshot: any }>(`/snapshots/${snapshotId}`);
    return {
      id: response.snapshot.id,
      name: response.snapshot.name,
      regions: response.snapshot.regions || [],
      createdAt: response.snapshot.created_at,
      minDiskSize: response.snapshot.min_disk_size,
      sizeGigabytes: response.snapshot.size_gigabytes,
    };
  }

  /**
   * Wait for droplet to be active and have an IP
   */
  async waitForDroplet(dropletId: number, maxWaitMs: number = 300000): Promise<Droplet> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const droplet = await this.getDroplet(dropletId);

      if (droplet.status === 'active' && droplet.publicIpv4) {
        return droplet;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Droplet creation timeout after ${maxWaitMs / 1000} seconds`);
  }

  /**
   * Delete a droplet
   */
  async deleteDroplet(dropletId: number): Promise<void> {
    await this.request(`/droplets/${dropletId}`, { method: 'DELETE' });
  }

  /**
   * Reboot a droplet
   */
  async rebootDroplet(dropletId: number): Promise<void> {
    await this.request(`/droplets/${dropletId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'reboot' }),
    });
  }

  /**
   * Power off a droplet
   */
  async powerOffDroplet(dropletId: number): Promise<void> {
    await this.request(`/droplets/${dropletId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'power_off' }),
    });
  }

  /**
   * Power on a droplet
   */
  async powerOnDroplet(dropletId: number): Promise<void> {
    await this.request(`/droplets/${dropletId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'power_on' }),
    });
  }

  /**
   * Reset root password on a droplet
   * IMPORTANT: This is required when creating droplets from snapshots
   * because cloud-init user-data doesn't re-run on snapshots
   *
   * The new password will be emailed to the account owner.
   * For API-controlled password, we need to SSH in after this completes.
   */
  async resetRootPassword(dropletId: number): Promise<{ actionId: number }> {
    const response = await this.request<{ action: { id: number } }>(`/droplets/${dropletId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'password_reset' }),
    });
    return { actionId: response.action.id };
  }

  /**
   * Get action status
   */
  async getAction(dropletId: number, actionId: number): Promise<{ status: string; completedAt?: string }> {
    const response = await this.request<{ action: { status: string; completed_at?: string } }>(
      `/droplets/${dropletId}/actions/${actionId}`
    );
    return {
      status: response.action.status,
      completedAt: response.action.completed_at,
    };
  }

  /**
   * Wait for an action to complete
   */
  async waitForAction(dropletId: number, actionId: number, maxWaitMs: number = 120000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < maxWaitMs) {
      const action = await this.getAction(dropletId, actionId);
      if (action.status === 'completed') {
        return true;
      }
      if (action.status === 'errored') {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return false;
  }

  /**
   * Enable password auth and set password via console access
   * This uses the droplet console action to run commands
   *
   * NOTE: This is a workaround for snapshots where cloud-init doesn't run.
   * The password is set by sending commands through the console.
   */
  async enablePasswordAuthViaConsole(dropletId: number, password: string): Promise<boolean> {
    // DigitalOcean doesn't have a direct API to set password without triggering email
    // The password_reset action emails the password to account owner
    // For full automation, we need to either:
    // 1. Use SSH keys (most reliable)
    // 2. Clean cloud-init state in snapshot before taking it
    // 3. Use the password reset and have user copy from email

    // For now, trigger password reset and return the action
    const { actionId } = await this.resetRootPassword(dropletId);
    return this.waitForAction(dropletId, actionId);
  }

  /**
   * List SSH keys
   */
  async listSshKeys(): Promise<SshKey[]> {
    const response = await this.request<{ ssh_keys: any[] }>('/account/keys');
    return response.ssh_keys.map(key => ({
      id: key.id,
      name: key.name,
      fingerprint: key.fingerprint,
      publicKey: key.public_key,
    }));
  }

  /**
   * Add SSH key
   */
  async addSshKey(name: string, publicKey: string): Promise<SshKey> {
    const response = await this.request<{ ssh_key: any }>('/account/keys', {
      method: 'POST',
      body: JSON.stringify({ name, public_key: publicKey }),
    });

    return {
      id: response.ssh_key.id,
      name: response.ssh_key.name,
      fingerprint: response.ssh_key.fingerprint,
      publicKey: response.ssh_key.public_key,
    };
  }

  /**
   * Delete SSH key
   */
  async deleteSshKey(keyId: number): Promise<void> {
    await this.request(`/account/keys/${keyId}`, { method: 'DELETE' });
  }

  /**
   * Get available regions
   */
  async listRegions(): Promise<Region[]> {
    const response = await this.request<{ regions: any[] }>('/regions');
    return response.regions.map(r => ({
      slug: r.slug,
      name: r.name,
      available: r.available,
    }));
  }

  /**
   * Get available sizes (droplet plans)
   */
  async listSizes(): Promise<Size[]> {
    const response = await this.request<{ sizes: any[] }>('/sizes');
    return response.sizes.map(s => ({
      slug: s.slug,
      description: s.description,
      priceMonthly: s.price_monthly,
      priceHourly: s.price_hourly,
      memory: s.memory,
      vcpus: s.vcpus,
      disk: s.disk,
      available: s.available,
    }));
  }

  /**
   * Get account info
   */
  async getAccount(): Promise<{ email: string; dropletLimit: number; status: string; uuid: string }> {
    const response = await this.request<{ account: any }>('/account');
    return {
      email: response.account.email,
      dropletLimit: response.account.droplet_limit,
      status: response.account.status,
      uuid: response.account.uuid,
    };
  }

  /**
   * Test connection to DigitalOcean API
   */
  async testConnection(): Promise<{ success: boolean; error?: string; email?: string }> {
    try {
      const account = await this.getAccount();
      return { success: true, email: account.email };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Map raw droplet response to Droplet type
   */
  private mapDroplet(raw: any): Droplet {
    const publicNetwork = raw.networks?.v4?.find((n: any) => n.type === 'public');
    const privateNetwork = raw.networks?.v4?.find((n: any) => n.type === 'private');

    return {
      id: raw.id,
      name: raw.name,
      status: raw.status,
      publicIpv4: publicNetwork?.ip_address,
      privateIpv4: privateNetwork?.ip_address,
      region: raw.region?.slug || raw.region,
      size: raw.size_slug || raw.size?.slug,
      image: raw.image?.slug || raw.image,
      createdAt: raw.created_at,
      memory: raw.memory,
      vcpus: raw.vcpus,
      disk: raw.disk,
    };
  }
}

/**
 * Create a DigitalOcean client with explicit API key
 */
export function createDigitalOceanClient(apiKey: string): DigitalOceanClient {
  if (!apiKey) throw new Error('DigitalOcean API key is required');
  return new DigitalOceanClient(apiKey);
}

/**
 * Get DigitalOcean client using settings from database
 */
export async function getDigitalOceanClientFromSettings(): Promise<DigitalOceanClient> {
  const settings = await prisma.appSettings.findFirst();

  if (!settings?.digitaloceanApiKey) {
    throw new Error('DigitalOcean API key not configured. Please set it in Settings.');
  }

  return createDigitalOceanClient(settings.digitaloceanApiKey);
}

// ============================================================================
// CLOUD-INIT USER DATA GENERATORS
// ============================================================================

/**
 * Generate cloud-init script for a website hosting droplet
 * Installs: Nginx, PHP-FPM, Certbot
 */
export function generateWebsiteUserData(options: {
  domain: string;
  zipUrl?: string;       // URL to download website zip from
  cloakerZipUrl?: string; // URL to download np/ cloaker from
  sshPassword?: string;  // Root password for SSH access
}): string {
  const { domain, zipUrl, cloakerZipUrl, sshPassword } = options;

  return `#!/bin/bash
set -e

# Log all output
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting server setup for ${domain}..."

${sshPassword ? `
# Set root password and enable password authentication
echo "root:${sshPassword}" | chpasswd

# Update main sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Also update cloud-init SSH config (Ubuntu 22.04+)
if [ -f /etc/ssh/sshd_config.d/50-cloud-init.conf ]; then
  sed -i 's/^PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/50-cloud-init.conf
fi

systemctl restart sshd
echo "SSH password authentication enabled."
` : '# No SSH password provided - SSH key only'}

# Update system
apt-get update
apt-get upgrade -y

# Install required packages
apt-get install -y nginx php-fpm php-mysql php-curl php-json php-mbstring unzip certbot python3-certbot-nginx curl

# Configure PHP-FPM
PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
sed -i 's/;cgi.fix_pathinfo=1/cgi.fix_pathinfo=0/' /etc/php/$PHP_VERSION/fpm/php.ini
systemctl restart php$PHP_VERSION-fpm

# Create web directory
mkdir -p /var/www/${domain}
chown -R www-data:www-data /var/www/${domain}

# Create Nginx config (using shell variable substitution)
cat > /etc/nginx/sites-available/${domain} << EOF
server {
    listen 80;
    server_name ${domain} www.${domain};
    root /var/www/${domain};
    index index.php index.html index.htm;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        try_files \\$uri \\$uri/ /index.php?\\$query_string;
    }

    location ~ \\.php\\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php\$PHP_VERSION-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \\$document_root\\$fastcgi_script_name;
    }

    location ~ /\\.ht {
        deny all;
    }

    # Deny access to sensitive files
    location ~* \\.(env|log|htaccess)\\$ {
        deny all;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t && systemctl reload nginx

${zipUrl ? `
# Download and extract website files
echo "Downloading website files from ${zipUrl}..."
cd /var/www/${domain}
curl -L -o website.zip "${zipUrl}"
unzip -o website.zip
rm website.zip
chown -R www-data:www-data /var/www/${domain}
` : '# No website zip URL provided'}

${cloakerZipUrl ? `
# Download and extract cloaker
echo "Downloading cloaker from ${cloakerZipUrl}..."
mkdir -p /var/www/${domain}/np
cd /var/www/${domain}/np
curl -L -o cloaker.zip "${cloakerZipUrl}"
unzip -o cloaker.zip
rm cloaker.zip
chown -R www-data:www-data /var/www/${domain}/np
` : '# No cloaker zip URL provided'}

# Create default index if no website was provided
if [ ! -f /var/www/${domain}/index.html ] && [ ! -f /var/www/${domain}/index.php ]; then
    echo "<html><head><title>${domain}</title></head><body><h1>Welcome to ${domain}</h1><p>Server is ready.</p></body></html>" > /var/www/${domain}/index.html
    chown www-data:www-data /var/www/${domain}/index.html
fi

# Create marker file for deployment readiness
touch /tmp/server-ready
echo "Server setup complete for ${domain}"
`;
}

/**
 * Generate cloud-init script that just prepares the server
 * (files will be uploaded separately via SSH/SCP)
 */
export function generateBasicServerUserData(domain: string): string {
  return generateWebsiteUserData({ domain });
}

/**
 * Generate a lightweight user-data script for snapshot-based deployment
 * The snapshot already has nginx, PHP, certbot installed - just configure domain
 */
export function generateSnapshotUserData(options: {
  domain: string;
  zipUrl?: string;
  sshPassword?: string;
}): string {
  const { domain, zipUrl, sshPassword } = options;

  return `#!/bin/bash
set -e

# Log all output
exec > >(tee /var/log/user-data.log) 2>&1
echo "Configuring server for ${domain} (from snapshot)..."

${sshPassword ? `
# Set root password and enable password authentication
echo "root:${sshPassword}" | chpasswd

# Update main sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Also update cloud-init SSH config (Ubuntu 22.04+)
if [ -f /etc/ssh/sshd_config.d/50-cloud-init.conf ]; then
  sed -i 's/^PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/50-cloud-init.conf
fi

systemctl restart sshd
echo "SSH password authentication enabled."
` : '# No SSH password provided'}

# Create web directory for this domain
mkdir -p /var/www/${domain}

${zipUrl ? `
# Download and extract website files
echo "Downloading website files from ${zipUrl}..."
cd /var/www/${domain}
curl -L -o website.zip "${zipUrl}"
unzip -o website.zip

# Handle nested directories (if zip contains a folder)
for dir in */; do
  if [ -d "\\$dir" ]; then
    mv "\\$dir"* . 2>/dev/null || true
    rmdir "\\$dir" 2>/dev/null || true
  fi
done

rm -f website.zip
` : `# No website zip URL provided - creating default index
echo "<html><head><title>${domain}</title></head><body><h1>Welcome to ${domain}</h1><p>Server is ready.</p></body></html>" > /var/www/${domain}/index.html`}

# Set permissions
chown -R www-data:www-data /var/www/${domain}

# Detect PHP version
PHP_VERSION=$(ls /var/run/php/ 2>/dev/null | grep -oP 'php\\K[0-9]+\\.[0-9]+' | head -1)
[ -z "\\$PHP_VERSION" ] && PHP_VERSION="8.1"

# Create Nginx config for this domain (using shell variable substitution)
cat > /etc/nginx/sites-available/${domain} << EOF
server {
    listen 80;
    server_name ${domain} www.${domain};
    root /var/www/${domain};
    index index.php index.html index.htm;

    location / {
        try_files \\$uri \\$uri/ /index.php?\\$query_string;
    }

    location ~ \\.php\\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php\\$PHP_VERSION-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \\$document_root\\$fastcgi_script_name;
    }

    location ~ /\\.ht {
        deny all;
    }
}
EOF

# Enable site and reload nginx
ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx

# Mark server as ready
touch /tmp/server-ready
echo "Server setup complete for ${domain} (snapshot-based)"
`;
}

// ============================================================================
// COMMON DROPLET CONFIGURATIONS
// ============================================================================

export const DROPLET_SIZES = {
  basic: {
    slug: 's-1vcpu-1gb',
    description: 'Basic ($6/mo)',
    priceMonthly: 6,
    memory: 1024,
    vcpus: 1,
  },
  standard: {
    slug: 's-1vcpu-2gb',
    description: 'Standard ($12/mo)',
    priceMonthly: 12,
    memory: 2048,
    vcpus: 1,
  },
  performance: {
    slug: 's-2vcpu-4gb',
    description: 'Performance ($24/mo)',
    priceMonthly: 24,
    memory: 4096,
    vcpus: 2,
  },
} as const;

export const DROPLET_REGIONS = {
  nyc1: 'New York 1',
  nyc3: 'New York 3',
  sfo3: 'San Francisco 3',
  ams3: 'Amsterdam 3',
  sgp1: 'Singapore 1',
  lon1: 'London 1',
  fra1: 'Frankfurt 1',
  tor1: 'Toronto 1',
  blr1: 'Bangalore 1',
  syd1: 'Sydney 1',
} as const;

export const DEFAULT_DROPLET_IMAGE = 'ubuntu-22-04-x64';

// ============================================================================
// GENERIC SERVER USER DATA (IP-FIRST APPROACH)
// ============================================================================

/**
 * Generate cloud-init user-data for a generic server that works at IP level.
 * Installs nginx, PHP-FPM, and certbot, then configures a default site.
 *
 * This is used for the new IP-first deployment flow where:
 * 1. Server boots with generic nginx config (server_name _)
 * 2. Files are uploaded via SSH after server is ready
 * 3. Domain nginx config is added later
 * 4. SSL is installed last
 */
export function generateGenericServerUserData(options: {
  sshPassword?: string;
}): string {
  // Use plain bash script for maximum compatibility
  // cloud-config YAML has issues with complex scripts
  return `#!/bin/bash
set -e
exec > >(tee /var/log/user-data.log) 2>&1

echo "=== Starting server setup $(date) ==="

# Prevent apt from prompting for input
export DEBIAN_FRONTEND=noninteractive

# Wait for any existing apt processes to finish
while fuser /var/lib/dpkg/lock >/dev/null 2>&1; do
  echo "Waiting for apt lock..."
  sleep 5
done

# Update package list
echo "Updating packages..."
apt-get update

# Install required packages
echo "Installing nginx, PHP, and certbot..."
apt-get install -y nginx php-fpm php-mysql php-curl php-json php-mbstring unzip certbot python3-certbot-nginx curl

# Get installed PHP version
PHP_VERSION=$(ls /var/run/php/ 2>/dev/null | grep -oP 'php\\K[0-9]+\\.[0-9]+' | head -1)
if [ -z "$PHP_VERSION" ]; then
  PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null || echo "8.1")
fi
echo "PHP version: $PHP_VERSION"

# Create web directory
echo "Setting up web directory..."
mkdir -p /var/www/html
chown -R www-data:www-data /var/www/html

# Create generic nginx config (works with any IP or domain)
echo "Creating nginx config..."
cat > /etc/nginx/sites-available/default << NGINXEOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.php index.html index.htm;

    server_name _;

    location / {
        try_files \\$uri \\$uri/ /index.php?\\$query_string;
    }

    location ~ \\.php\\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php$PHP_VERSION-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \\$document_root\\$fastcgi_script_name;
    }

    location ~ /\\.ht {
        deny all;
    }
}
NGINXEOF

# Create placeholder index
echo "Creating placeholder index..."
cat > /var/www/html/index.html << 'INDEXEOF'
<!DOCTYPE html>
<html>
<head>
    <title>Server Ready</title>
    <style>
        body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #eee; }
        h1 { color: #4ade80; }
        p { color: #94a3b8; }
    </style>
</head>
<body>
    <h1>Server Ready</h1>
    <p>Your server is configured and waiting for website files.</p>
</body>
</html>
INDEXEOF
chown www-data:www-data /var/www/html/index.html

# Ensure nginx sites-enabled link exists
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Test and reload nginx
echo "Testing and reloading nginx..."
nginx -t && systemctl reload nginx

# Mark server as ready
touch /tmp/server-ready
echo "=== Server setup complete $(date) ==="
`;
}

// ============================================================================
// SSH EXECUTION HELPER
// ============================================================================

/**
 * SSH authentication options - supports both password and private key
 */
export interface SshAuthOptions {
  password?: string;
  privateKey?: string;
  username?: string;
  timeout?: number;
}

/**
 * Execute a script on a remote server via SSH
 * Supports both password and private key authentication
 */
export async function executeRemoteScript(
  host: string,
  authOrPassword: string | SshAuthOptions,
  script: string,
  options: {
    username?: string;
    timeout?: number;
  } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  const ssh = new NodeSSH();

  // Handle both old (password string) and new (options object) signatures
  let auth: SshAuthOptions;
  if (typeof authOrPassword === 'string') {
    // Legacy: password string
    auth = { password: authOrPassword, ...options };
  } else {
    // New: options object
    auth = { ...authOrPassword, ...options };
  }

  const { username = 'root', timeout = 60000, password, privateKey } = auth;

  if (!password && !privateKey) {
    throw new Error('Either password or privateKey must be provided for SSH authentication');
  }

  try {
    await ssh.connect({
      host,
      username,
      password,
      privateKey,
      readyTimeout: timeout,
      // Disable strict host key checking for new servers
      algorithms: {
        serverHostKey: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256'],
      },
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

/**
 * Wait for SSH to become available on a server
 * Supports both password and private key authentication
 */
export async function waitForSsh(
  host: string,
  authOrPassword: string | SshAuthOptions,
  maxWaitMs: number = 120000
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = await executeRemoteScript(host, authOrPassword, 'echo "SSH ready"', {
        timeout: 10000,
      });
      if (result.code === 0) {
        return true;
      }
    } catch {
      // SSH not ready yet, keep trying
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return false;
}

/**
 * Generate an SSH key pair for use with DigitalOcean droplets
 * Uses the ssh-keygen command which produces standard OpenSSH format
 * Returns { publicKey, privateKey }
 */
export async function generateSshKeyPair(keyName: string = 'magimanager-websites'): Promise<{ publicKey: string; privateKey: string }> {
  const { execSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  // Create temp directory for key generation
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-keygen-'));
  const keyPath = path.join(tempDir, 'id_rsa');

  try {
    // Generate RSA key pair using ssh-keygen (available on Mac/Linux)
    execSync(`ssh-keygen -t rsa -b 4096 -f "${keyPath}" -N "" -C "${keyName}"`, {
      stdio: 'pipe',
    });

    // Read the generated keys
    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const publicKey = fs.readFileSync(`${keyPath}.pub`, 'utf8').trim();

    return { publicKey, privateKey };
  } finally {
    // Clean up temp files
    try {
      fs.unlinkSync(keyPath);
      fs.unlinkSync(`${keyPath}.pub`);
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get SSH credentials from app settings
 * Returns either privateKey (preferred) or password for SSH connections
 */
export async function getSshCredentialsFromSettings(): Promise<SshAuthOptions> {
  const settings = await prisma.appSettings.findFirst();

  if (settings?.digitaloceanSshPrivateKey) {
    return { privateKey: settings.digitaloceanSshPrivateKey };
  }

  if (settings?.digitaloceanSshPassword) {
    return { password: settings.digitaloceanSshPassword };
  }

  throw new Error('No SSH credentials configured. Please set up SSH key or password in Settings.');
}
