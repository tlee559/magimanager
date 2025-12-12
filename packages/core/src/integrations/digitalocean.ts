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
        tags: config.tags || ['1-click-website'],
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
 * Generate cloud-init script for a generic server that works at IP level
 * This is used for the new IP-first deployment flow where:
 * 1. Server boots with generic nginx config (server_name _)
 * 2. Files are uploaded via SSH after server is ready
 * 3. Domain nginx config is added later
 * 4. SSL is installed last
 */
export function generateGenericServerUserData(options: {
  sshPassword?: string;
}): string {
  const { sshPassword } = options;

  return `#!/bin/bash
set -e

# Log all output
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting generic server setup..."

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

# Detect PHP version from installed PHP-FPM
PHP_VERSION=$(ls /var/run/php/ 2>/dev/null | grep -oP 'php\\K[0-9]+\\.[0-9]+' | head -1)
if [ -z "$PHP_VERSION" ]; then
  # Fallback: check php command
  PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null || echo "8.1")
fi
echo "Detected PHP version: $PHP_VERSION"

# Create web directory
mkdir -p /var/www/html
chown -R www-data:www-data /var/www/html

# Create generic nginx config (works with any IP or domain)
cat > /etc/nginx/sites-available/default << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.php index.html index.htm;

    # Accept any domain or IP
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
EOF

# Create placeholder index
cat > /var/www/html/index.html << 'PLACEHOLDER'
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
    <p>Upload your files to continue the deployment.</p>
</body>
</html>
PLACEHOLDER
chown www-data:www-data /var/www/html/index.html

# Ensure nginx sites-enabled link exists
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx

# Mark server as ready
touch /tmp/server-ready
echo "Generic server setup complete!"
`;
}

// ============================================================================
// SSH EXECUTION HELPER
// ============================================================================

/**
 * Execute a script on a remote server via SSH
 */
export async function executeRemoteScript(
  host: string,
  password: string,
  script: string,
  options: {
    username?: string;
    timeout?: number;
  } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  const ssh = new NodeSSH();
  const { username = 'root', timeout = 60000 } = options;

  try {
    await ssh.connect({
      host,
      username,
      password,
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
 */
export async function waitForSsh(
  host: string,
  password: string,
  maxWaitMs: number = 120000
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = await executeRemoteScript(host, password, 'echo "SSH ready"', {
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
