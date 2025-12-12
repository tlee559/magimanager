import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import crypto from "crypto";
import {
  getDigitalOceanClientFromSettings,
  generateWebsiteUserData,
  generateSnapshotUserData,
  DROPLET_SIZES,
  DEFAULT_DROPLET_IMAGE,
} from "@magimanager/core";

/**
 * Generate a secure random password for SSH access
 */
function generateSecurePassword(length: number = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

/**
 * Generate a valid hostname from a domain
 * DigitalOcean only allows: a-z, A-Z, 0-9, . and -
 */
function generateDropletName(domain: string): string {
  // Clean the domain first (remove protocol, www, trailing slash)
  let name = domain.toLowerCase().trim();
  name = name.replace(/^https?:\/\//, "");
  name = name.replace(/^www\./, "");
  name = name.split("/")[0];

  // Replace dots with dashes
  name = name.replace(/\./g, "-");

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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { region = "nyc1", size = "s-1vcpu-1gb" } = body;

    // Check website exists and has domain
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
        { error: "Domain must be purchased before creating droplet" },
        { status: 400 }
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

    // Generate SSH password
    const sshPassword = generateSecurePassword(16);

    // Update status
    await prisma.website.update({
      where: { id },
      data: {
        status: "DROPLET_CREATING",
        statusMessage: "Creating server...",
        sshPassword, // Store the password
      },
    });

    // Determine if we should use snapshot or cloud-init
    const useSnapshot = !!settings?.digitaloceanSnapshotId;
    const imageId = useSnapshot ? settings.digitaloceanSnapshotId : DEFAULT_DROPLET_IMAGE;

    // Generate user-data script
    // If using snapshot, we just need a simple script to configure domain and download files
    // If not using snapshot, we need the full cloud-init script
    let userData: string;
    if (useSnapshot) {
      // Snapshot already has nginx/php installed, just configure domain
      userData = generateSnapshotUserData({
        domain: website.domain,
        zipUrl: website.zipFileUrl || undefined,
        sshPassword,
      });
    } else {
      // Full cloud-init for fresh Ubuntu image
      userData = generateWebsiteUserData({
        domain: website.domain,
        zipUrl: website.zipFileUrl || undefined,
        sshPassword,
      });
    }

    // Create droplet
    const droplet = await client.createDroplet({
      name: generateDropletName(website.domain),
      region,
      size,
      image: imageId!,
      userData,
      tags: ["1-click-website", `website-${id}`],
    });

    // Update website with droplet info
    const updated = await prisma.website.update({
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

    return NextResponse.json({
      success: true,
      website: updated,
      droplet,
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
