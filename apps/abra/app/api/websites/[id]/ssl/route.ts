import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { executeRemoteScript } from "@magimanager/core";

/**
 * POST /api/websites/[id]/ssl - Install Let's Encrypt SSL certificate
 *
 * Prerequisites:
 * 1. Droplet must be running
 * 2. Files must be uploaded
 * 3. Domain must be configured and resolving
 * 4. Site must be accessible via HTTP
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
        { error: "No domain set for this website" },
        { status: 400 }
      );
    }

    if (!website.dropletIp) {
      return NextResponse.json(
        { error: "Droplet must be running with an IP address" },
        { status: 400 }
      );
    }

    if (!website.sshPassword) {
      return NextResponse.json(
        { error: "SSH password not found. Please recreate the droplet." },
        { status: 400 }
      );
    }

    // Verify domain is accessible via HTTP first
    try {
      const httpUrl = `http://${website.domain}/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const httpCheck = await fetch(httpUrl, {
        method: "GET",
        headers: { "User-Agent": "MagiManager/1.0" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!httpCheck.ok) {
        return NextResponse.json(
          {
            error: `Site returned HTTP ${httpCheck.status}. Site must be accessible before installing SSL.`,
            suggestion: "Check that DNS is propagated and the site loads at http://" + website.domain,
          },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: "Cannot reach site via HTTP. DNS may not have propagated yet.",
          suggestion: `Try accessing http://${website.domain} in your browser. If it doesn't load, wait a few more minutes for DNS propagation.`,
        },
        { status: 400 }
      );
    }

    // Update status
    await prisma.website.update({
      where: { id },
      data: {
        status: "SSL_PENDING",
        statusMessage: "Installing SSL certificate...",
      },
    });

    // Run certbot to install SSL
    const sslScript = `
set -e

echo "=== Installing SSL certificate for ${website.domain} ==="

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
  echo "Installing certbot..."
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

# Generate a random email for certbot (or use domain-based)
EMAIL="ssl@${website.domain}"

# Run certbot with nginx plugin
# --non-interactive: Don't ask questions
# --agree-tos: Agree to terms of service
# --redirect: Automatically redirect HTTP to HTTPS
# --no-eff-email: Don't share email with EFF
echo "Running certbot..."
certbot --nginx \\
  -d ${website.domain} \\
  -d www.${website.domain} \\
  --non-interactive \\
  --agree-tos \\
  --email "$EMAIL" \\
  --redirect \\
  --no-eff-email \\
  2>&1 || {
    # If www fails (not pointed to server), try just the main domain
    echo "Retrying with just main domain..."
    certbot --nginx \\
      -d ${website.domain} \\
      --non-interactive \\
      --agree-tos \\
      --email "$EMAIL" \\
      --redirect \\
      --no-eff-email
  }

echo "=== SSL installation complete ==="

# Verify HTTPS is working
nginx -t && systemctl reload nginx

echo "=== Nginx reloaded ==="
`;

    console.log(`Installing SSL for ${website.domain}...`);
    const result = await executeRemoteScript(
      website.dropletIp,
      website.sshPassword,
      sslScript,
      { timeout: 120000 } // 2 minute timeout
    );

    console.log("SSL install output:", result.stdout);
    if (result.stderr) {
      console.error("SSL install stderr:", result.stderr);
    }

    // Verify HTTPS works
    let sslValid = false;
    let httpsStatus: number | null = null;

    try {
      const httpsUrl = `https://${website.domain}/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const httpsCheck = await fetch(httpsUrl, {
        method: "GET",
        headers: { "User-Agent": "MagiManager/1.0" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      httpsStatus = httpsCheck.status;
      sslValid = httpsCheck.ok;

      console.log(`HTTPS check for ${website.domain}: ${httpsStatus}`);
    } catch (error) {
      console.error("HTTPS verification failed:", error);
    }

    // Update website status
    if (sslValid) {
      await prisma.website.update({
        where: { id },
        data: {
          status: "LIVE",
          sslEnabled: true,
          statusMessage: "Website is live with SSL!",
          deployedAt: new Date(),
        },
      });

      // Log activity
      await prisma.websiteActivity.create({
        data: {
          websiteId: id,
          action: "SSL_INSTALLED",
          details: `SSL certificate installed. Site live at https://${website.domain}`,
        },
      });

      return NextResponse.json({
        success: true,
        sslEnabled: true,
        liveUrl: `https://${website.domain}/`,
        message: "SSL certificate installed successfully. Your site is now live!",
      });
    } else {
      // SSL install ran but HTTPS not working yet
      await prisma.website.update({
        where: { id },
        data: {
          status: "SSL_PENDING",
          statusMessage: httpsStatus
            ? `SSL installed but HTTPS returned ${httpsStatus}. May need a few seconds.`
            : "SSL installed but HTTPS verification failed. Try refreshing.",
        },
      });

      return NextResponse.json({
        success: true,
        sslEnabled: false,
        warning: "SSL certificate may have been installed but HTTPS verification failed. Try accessing the site directly.",
        testUrl: `https://${website.domain}/`,
        httpsStatus,
      });
    }
  } catch (error) {
    console.error("Failed to install SSL:", error);

    // Try to update status
    try {
      const { id } = await params;
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "SSL installation failed",
        },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to install SSL" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/websites/[id]/ssl - Check SSL status
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

    if (!website.domain) {
      return NextResponse.json({
        sslEnabled: false,
        sslValid: false,
        error: "No domain set",
      });
    }

    // Check HTTPS
    let sslValid = false;
    let httpsStatus: number | null = null;
    let httpRedirects = false;

    // Check if HTTPS works
    try {
      const httpsUrl = `https://${website.domain}/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const httpsCheck = await fetch(httpsUrl, {
        method: "GET",
        headers: { "User-Agent": "MagiManager/1.0" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      httpsStatus = httpsCheck.status;
      sslValid = httpsCheck.ok;
    } catch {
      // HTTPS not working
    }

    // Check if HTTP redirects to HTTPS
    if (sslValid) {
      try {
        const httpUrl = `http://${website.domain}/`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const httpCheck = await fetch(httpUrl, {
          method: "GET",
          headers: { "User-Agent": "MagiManager/1.0" },
          redirect: "manual",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 301 or 302 to HTTPS means redirect is working
        if (httpCheck.status === 301 || httpCheck.status === 302) {
          const location = httpCheck.headers.get("location");
          if (location?.startsWith("https://")) {
            httpRedirects = true;
          }
        }
      } catch {
        // Ignore HTTP check errors
      }
    }

    return NextResponse.json({
      domain: website.domain,
      sslEnabled: website.sslEnabled,
      sslValid,
      httpsStatus,
      httpRedirects,
      liveUrl: sslValid ? `https://${website.domain}/` : `http://${website.domain}/`,
    });
  } catch (error) {
    console.error("Failed to check SSL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check SSL" },
      { status: 500 }
    );
  }
}
