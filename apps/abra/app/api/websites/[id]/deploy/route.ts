import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  getDigitalOceanClientFromSettings,
  getNamecheapClientFromSettings,
} from "@magimanager/core";

// POST /api/websites/[id]/deploy - Deploy website (configure DNS + wait for SSL)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    // Check website exists and has required data
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
        { error: "Domain is required before deploying" },
        { status: 400 }
      );
    }

    if (!website.dropletId) {
      return NextResponse.json(
        { error: "Droplet must be created before deploying" },
        { status: 400 }
      );
    }

    // Get clients
    const doClient = await getDigitalOceanClientFromSettings();

    // Namecheap client is optional - DNS can be configured manually
    let ncClient = null;
    try {
      ncClient = await getNamecheapClientFromSettings();
    } catch {
      // Namecheap not configured - DNS will need to be set manually
    }

    // Update status
    await prisma.website.update({
      where: { id },
      data: {
        status: "DEPLOYING",
        statusMessage: "Checking server status...",
      },
    });

    // Wait for droplet to be ready (if not already)
    let droplet;
    try {
      droplet = await doClient.waitForDroplet(parseInt(website.dropletId), 180000); // 3 min timeout
    } catch (error) {
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: "Server did not become ready in time",
        },
      });
      return NextResponse.json(
        { error: "Server did not become ready in time" },
        { status: 500 }
      );
    }

    // Update with IP
    await prisma.website.update({
      where: { id },
      data: {
        dropletIp: droplet.publicIpv4,
        status: "DEPLOYING",
        statusMessage: "Server ready. Configuring DNS...",
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "DROPLET_READY",
        details: `Server is active with IP ${droplet.publicIpv4}`,
      },
    });

    // Configure DNS to point to droplet (only if Namecheap is configured)
    let dnsConfigured = false;
    if (ncClient) {
      try {
        const dnsSuccess = await ncClient.pointToServer(website.domain, droplet.publicIpv4!);

        if (dnsSuccess) {
          dnsConfigured = true;
          await prisma.websiteActivity.create({
            data: {
              websiteId: id,
              action: "DNS_CONFIGURED",
              details: `DNS A records automatically set to ${droplet.publicIpv4}`,
            },
          });
        } else {
          throw new Error("DNS configuration returned false");
        }
      } catch (error) {
        // DNS config failed but server is up - continue with warning
        await prisma.websiteActivity.create({
          data: {
            websiteId: id,
            action: "DNS_WARNING",
            details: `DNS auto-configuration failed: ${error instanceof Error ? error.message : "Unknown error"}. You may need to configure DNS manually.`,
          },
        });
      }
    } else {
      // Namecheap not configured - log that DNS needs manual setup
      await prisma.websiteActivity.create({
        data: {
          websiteId: id,
          action: "DNS_MANUAL",
          details: `Namecheap not configured. Please manually set DNS A records for @ and www to ${droplet.publicIpv4}`,
        },
      });
    }

    // Update status - SSL will be configured when DNS propagates
    const updated = await prisma.website.update({
      where: { id },
      data: {
        status: "SSL_PENDING",
        statusMessage: "DNS configured. SSL will be enabled once DNS propagates (can take up to 30 minutes).",
      },
    });

    return NextResponse.json({
      success: true,
      website: updated,
      droplet: {
        id: droplet.id,
        ip: droplet.publicIpv4,
        status: droplet.status,
      },
      dnsConfigured,
      message: dnsConfigured
        ? `Website is deploying. Server IP: ${droplet.publicIpv4}. DNS has been auto-configured. SSL will activate once DNS propagates.`
        : `Website is deploying. Server IP: ${droplet.publicIpv4}. Please configure DNS manually (A records for @ and www pointing to ${droplet.publicIpv4}). SSL will activate once DNS propagates.`,
    });
  } catch (error) {
    console.error("Deployment failed:", error);

    // Try to update status to failed
    try {
      const { id } = await params;
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Deployment failed",
        },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deployment failed" },
      { status: 500 }
    );
  }
}

// PATCH /api/websites/[id]/deploy - Mark website as live (after SSL is verified)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { sslEnabled } = body;

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.website.update({
      where: { id },
      data: {
        status: "LIVE",
        sslEnabled: sslEnabled ?? true,
        deployedAt: new Date(),
        statusMessage: null,
        errorMessage: null,
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "DEPLOYED",
        details: `Website is now live at https://${website.domain}`,
      },
    });

    return NextResponse.json({
      success: true,
      website: updated,
    });
  } catch (error) {
    console.error("Failed to mark as live:", error);
    return NextResponse.json(
      { error: "Failed to update website status" },
      { status: 500 }
    );
  }
}
