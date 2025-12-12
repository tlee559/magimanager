import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  executeRemoteScript,
  getNamecheapClientFromSettings,
  getSshCredentialsFromSettings,
} from "@magimanager/core";

/**
 * POST /api/websites/[id]/configure-domain - Configure domain for the website
 *
 * This endpoint:
 * 1. Creates domain-specific nginx config on the server
 * 2. Sets DNS A records via Namecheap to point to the droplet IP
 * 3. Returns status for polling
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    if (!website.domain) {
      return NextResponse.json(
        { error: "No domain set for this website. Please set a domain first." },
        { status: 400 }
      );
    }

    if (!website.dropletIp) {
      return NextResponse.json(
        { error: "Droplet must be running with an IP address first" },
        { status: 400 }
      );
    }

    // Get SSH credentials from settings (SSH key preferred, falls back to password)
    let sshAuth;
    try {
      sshAuth = await getSshCredentialsFromSettings();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "SSH credentials not configured" },
        { status: 400 }
      );
    }

    // Update status
    await prisma.website.update({
      where: { id },
      data: {
        status: "DNS_CONFIGURING",
        statusMessage: "Configuring domain and DNS...",
      },
    });

    // 1. Create domain-specific nginx config via SSH
    // We detect PHP version dynamically to avoid socket mismatch errors
    const nginxScript = `
set -e

echo "=== Configuring nginx for ${website.domain} ==="

# Detect PHP version
PHP_VERSION=$(ls /var/run/php/ 2>/dev/null | grep -oP 'php\\K[0-9]+\\.[0-9]+' | head -1)
if [ -z "$PHP_VERSION" ]; then
  PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null || echo "8.1")
fi
echo "Detected PHP version: $PHP_VERSION"

# Create nginx config for domain
cat > /etc/nginx/sites-available/${website.domain} << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ${website.domain} www.${website.domain};

    root /var/www/html;
    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/phpPHP_VERSION_PLACEHOLDER-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location ~ /\\.ht {
        deny all;
    }
}
NGINX_EOF

# Replace PHP version placeholder
sed -i "s/PHP_VERSION_PLACEHOLDER/$PHP_VERSION/g" /etc/nginx/sites-available/${website.domain}

# Enable the site
ln -sf /etc/nginx/sites-available/${website.domain} /etc/nginx/sites-enabled/

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx

echo "=== Nginx configured for ${website.domain} ==="
`;

    console.log(`Configuring nginx for ${website.domain} on ${website.dropletIp}...`);
    const nginxResult = await executeRemoteScript(
      website.dropletIp,
      sshAuth,
      nginxScript,
      { timeout: 30000 }
    );

    console.log("Nginx config output:", nginxResult.stdout);
    if (nginxResult.stderr) {
      console.error("Nginx config stderr:", nginxResult.stderr);
    }

    // 2. Set DNS A records via Namecheap (if configured)
    let dnsConfigured = false;
    let dnsError: string | null = null;

    try {
      const ncClient = await getNamecheapClientFromSettings();

      console.log(`Setting DNS for ${website.domain} -> ${website.dropletIp}`);
      const dnsSuccess = await ncClient.pointToServer(website.domain, website.dropletIp);

      if (dnsSuccess) {
        dnsConfigured = true;
        console.log("DNS records set successfully");
      } else {
        dnsError = "Failed to set DNS records";
      }
    } catch (error) {
      // Namecheap not configured or domain not in account
      dnsError = error instanceof Error ? error.message : "DNS configuration failed";
      console.log("DNS configuration skipped:", dnsError);
    }

    // Update website status
    await prisma.website.update({
      where: { id },
      data: {
        status: "DNS_CONFIGURING",
        statusMessage: dnsConfigured
          ? "DNS records set. Waiting for propagation (can take up to 30 minutes)..."
          : `Nginx configured. ${dnsError ? `DNS: ${dnsError}. ` : ""}Please configure DNS manually to point to ${website.dropletIp}`,
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "DOMAIN_CONFIGURED",
        details: dnsConfigured
          ? `Domain ${website.domain} configured. DNS A records set to ${website.dropletIp}`
          : `Nginx configured for ${website.domain}. DNS needs manual configuration.`,
      },
    });

    return NextResponse.json({
      success: true,
      domain: website.domain,
      dropletIp: website.dropletIp,
      nginxConfigured: true,
      dnsConfigured,
      dnsError,
      testUrl: `http://${website.domain}/`,
      message: dnsConfigured
        ? "Domain configured. DNS propagation can take 5-30 minutes."
        : `Nginx configured. Please set DNS A records for ${website.domain} to point to ${website.dropletIp}`,
    });
  } catch (error) {
    console.error("Failed to configure domain:", error);

    // Try to update status to failed
    try {
      const { id } = await params;
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Domain configuration failed",
        },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to configure domain" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/websites/[id]/configure-domain - Check if domain is resolving to droplet
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    if (!website.domain || !website.dropletIp) {
      return NextResponse.json({
        domainResolved: false,
        siteAccessible: false,
        error: "Domain or droplet IP not set",
      });
    }

    // Check if domain resolves to the correct IP
    let domainResolved = false;
    let resolvedIp: string | null = null;
    let siteAccessible = false;
    let httpStatus: number | null = null;

    // Try to fetch the site via domain name
    try {
      const testUrl = `http://${website.domain}/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(testUrl, {
        method: "GET",
        headers: { "User-Agent": "MagiManager/1.0" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      httpStatus = response.status;
      siteAccessible = response.ok;
      domainResolved = true; // If we got a response, DNS resolved

      console.log(`Domain ${website.domain} test: ${httpStatus}`);
    } catch (error) {
      // Could be DNS not propagated, or other network error
      console.log(`Domain ${website.domain} not accessible:`, error instanceof Error ? error.message : "Unknown error");
    }

    return NextResponse.json({
      domain: website.domain,
      expectedIp: website.dropletIp,
      domainResolved,
      resolvedIp,
      siteAccessible,
      httpStatus,
      testUrl: `http://${website.domain}/`,
    });
  } catch (error) {
    console.error("Failed to check domain:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check domain" },
      { status: 500 }
    );
  }
}
