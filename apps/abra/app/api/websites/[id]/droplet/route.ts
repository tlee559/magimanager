import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  getDigitalOceanClientFromSettings,
  generateGenericServerUserData,
  DEFAULT_DROPLET_IMAGE,
} from "@magimanager/core";

/**
 * Generate a valid hostname from website name or domain
 * DigitalOcean only allows: a-z, A-Z, 0-9, . and -
 */
function generateDropletName(websiteName: string, domain?: string | null): string {
  // Prefer domain if available, otherwise use website name
  let source = domain || websiteName;
  let name = source.toLowerCase().trim();

  // Clean domain-style input (remove protocol, www, trailing slash)
  name = name.replace(/^https?:\/\//, "");
  name = name.replace(/^www\./, "");
  name = name.split("/")[0];

  // Replace dots and spaces with dashes
  name = name.replace(/[\.\s]+/g, "-");

  // Remove any invalid characters (keep only a-z, 0-9, -)
  name = name.replace(/[^a-z0-9-]/g, "");

  // Remove leading/trailing dashes
  name = name.replace(/^-+|-+$/g, "");

  // Ensure it's not empty
  if (!name) {
    name = `website-${Date.now()}`;
  }

  return name;
}

// GET /api/websites/[id]/droplet - Get droplet status
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

    if (!website.dropletId) {
      return NextResponse.json(
        { error: "No droplet associated with this website" },
        { status: 400 }
      );
    }

    // Get DigitalOcean client
    const client = await getDigitalOceanClientFromSettings();
    const droplet = await client.getDroplet(parseInt(website.dropletId));

    return NextResponse.json({
      droplet,
      website: {
        id: website.id,
        status: website.status,
        statusMessage: website.statusMessage,
      },
    });
  } catch (error) {
    console.error("Failed to get droplet status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get droplet status" },
      { status: 500 }
    );
  }
}

// POST /api/websites/[id]/droplet - Create droplet
// New IP-first flow: Creates a generic server that works at IP level first
// Files are uploaded separately, then domain is configured, then SSL is installed
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    let { region = "nyc1", size = "s-1vcpu-1gb" } = body;

    // Check website exists (domain is optional now - can create server first)
    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    if (website.dropletId) {
      return NextResponse.json(
        { error: "Droplet already exists for this website" },
        { status: 400 }
      );
    }

    // Get DigitalOcean client and settings
    let client;
    let settings;
    try {
      settings = await prisma.appSettings.findFirst();
      client = await getDigitalOceanClientFromSettings();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "DigitalOcean not configured" },
        { status: 400 }
      );
    }

    // Determine image and SSH configuration
    const useSnapshot = !!settings?.digitaloceanSnapshotId;
    const imageId = useSnapshot ? settings!.digitaloceanSnapshotId! : DEFAULT_DROPLET_IMAGE;

    // When using a snapshot, we need to use a region where it's available
    // Snapshots are only available in the region they were created
    // Fetch snapshot info to get the correct region
    if (useSnapshot) {
      try {
        const snapshot = await client.getSnapshot(settings!.digitaloceanSnapshotId!);
        if (snapshot && snapshot.regions && snapshot.regions.length > 0) {
          // Use the first available region for this snapshot
          const snapshotRegion = snapshot.regions[0];
          if (snapshotRegion !== region) {
            console.log(`Overriding region ${region} -> ${snapshotRegion} (snapshot only available there)`);
            region = snapshotRegion;
          }
        }
      } catch (snapshotError) {
        console.warn("Could not fetch snapshot info, using default region:", snapshotError);
        // If we can't get snapshot info, just use nyc1 as that's where our snapshots are
        region = "nyc1";
      }
    }

    // Get SSH key ID for passwordless authentication (preferred)
    // Falls back to password-based auth if no SSH key configured
    const sshKeyId = settings?.digitaloceanSshKeyId
      ? parseInt(settings.digitaloceanSshKeyId)
      : undefined;

    // Only use cloud-init user-data for fresh images (not snapshots)
    // Snapshots already have the server configured
    let userData: string | undefined;
    if (!useSnapshot) {
      // Fresh image - use cloud-init to set up the server
      // Note: SSH key auth doesn't require password setup in cloud-init
      userData = generateGenericServerUserData({});
    }

    // Update status
    await prisma.website.update({
      where: { id },
      data: {
        status: "DROPLET_CREATING",
        statusMessage: "Creating server...",
        // SSH auth is handled via key - no password needed per-website
        sshPassword: null,
      },
    });

    // Create droplet with SSH key (if configured)
    const droplet = await client.createDroplet({
      name: generateDropletName(website.name, website.domain),
      region,
      size,
      image: imageId!,
      userData,
      sshKeys: sshKeyId ? [sshKeyId] : undefined,
      tags: ["website-wizard", `website-${id}`],
    });

    // Update website with droplet info
    await prisma.website.update({
      where: { id },
      data: {
        dropletId: droplet.id.toString(),
        dropletRegion: region,
        dropletSize: size,
        status: "DROPLET_CREATING",
        statusMessage: "Server created, waiting for it to become active...",
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "DROPLET_CREATED",
        details: `Created droplet #${droplet.id} in ${region} (${size})`,
      },
    });

    // Poll for droplet IP (up to 2 minutes)
    let dropletIp: string | null = null;
    const maxWaitTime = 120000; // 2 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const dropletStatus = await client.getDroplet(droplet.id);
        if (dropletStatus.publicIpv4) {
          dropletIp = dropletStatus.publicIpv4;
          break;
        }
      } catch {
        // Droplet not ready yet
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }

    // Update with IP if found
    const updated = await prisma.website.update({
      where: { id },
      data: {
        dropletIp: dropletIp,
        status: dropletIp ? "DROPLET_READY" : "DROPLET_CREATING",
        statusMessage: dropletIp
          ? `Server is ready at ${dropletIp}. Waiting for services to start...`
          : "Server created but IP not yet assigned. Please check status.",
      },
    });

    return NextResponse.json({
      success: true,
      website: updated,
      droplet: { ...droplet, ip_address: dropletIp },
    });
  } catch (error) {
    console.error("Failed to create droplet:", error);

    // Try to update status to failed
    try {
      const { id } = await params;
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Droplet creation failed",
        },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create droplet" },
      { status: 500 }
    );
  }
}

// DELETE /api/websites/[id]/droplet - Delete droplet
export async function DELETE(
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

    if (!website.dropletId) {
      return NextResponse.json(
        { error: "No droplet associated with this website" },
        { status: 400 }
      );
    }

    // Get DigitalOcean client and delete droplet
    const client = await getDigitalOceanClientFromSettings();
    await client.deleteDroplet(parseInt(website.dropletId));

    // Update website
    await prisma.website.update({
      where: { id },
      data: {
        dropletId: null,
        dropletIp: null,
        status: "DOMAIN_PURCHASED",
        statusMessage: "Droplet deleted. You can create a new one.",
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "DROPLET_DELETED",
        details: `Deleted droplet #${website.dropletId}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete droplet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete droplet" },
      { status: 500 }
    );
  }
}
