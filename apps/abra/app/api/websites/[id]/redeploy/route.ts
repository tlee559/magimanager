import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

// POST /api/websites/[id]/redeploy - Redeploy files to existing droplet
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

    if (!website.dropletIp) {
      return NextResponse.json(
        { error: "Server IP is required. Deploy the website first." },
        { status: 400 }
      );
    }

    if (!website.zipFileUrl) {
      return NextResponse.json(
        { error: "No zip file uploaded" },
        { status: 400 }
      );
    }

    if (!website.domain) {
      return NextResponse.json(
        { error: "Domain is required" },
        { status: 400 }
      );
    }

    // Build the deployment command
    const deployCommand = `cd /var/www/${website.domain} && rm -rf * && curl -sL "${website.zipFileUrl}" -o /tmp/site.zip && unzip -o /tmp/site.zip -d . && rm /tmp/site.zip && chown -R www-data:www-data .`;

    // Log activity with the deployment command
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "FILES_UPDATED",
        details: `New zip file uploaded and ready for deployment.`,
      },
    });

    // Return success with deployment info
    // Note: Actual file deployment requires SSH access to the server
    // The files have been uploaded to Vercel Blob, now need to be pulled by server
    return NextResponse.json({
      success: true,
      message: "Files uploaded successfully! Run the deploy command on your server to update.",
      website: {
        id: website.id,
        domain: website.domain,
        dropletIp: website.dropletIp,
        zipFileUrl: website.zipFileUrl,
      },
      deployment: {
        sshCommand: `ssh root@${website.dropletIp}`,
        deployCommand,
        oneLineCommand: `ssh root@${website.dropletIp} '${deployCommand}'`,
      },
    });
  } catch (error) {
    console.error("Redeploy failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Redeploy failed" },
      { status: 500 }
    );
  }
}
