import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { getNamecheapClientFromSettings } from "@magimanager/core";

// POST /api/websites/[id]/dns - Configure DNS A records to point to droplet
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
        { error: "Domain is required" },
        { status: 400 }
      );
    }

    if (!website.dropletIp) {
      return NextResponse.json(
        { error: "Server IP is required. Create and deploy the server first." },
        { status: 400 }
      );
    }

    // Get Namecheap client
    let ncClient;
    try {
      ncClient = await getNamecheapClientFromSettings();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Namecheap not configured" },
        { status: 400 }
      );
    }

    // Configure DNS
    const dnsSuccess = await ncClient.pointToServer(website.domain, website.dropletIp);

    if (!dnsSuccess) {
      return NextResponse.json(
        { error: "DNS configuration failed. Check that the domain is in your Namecheap account." },
        { status: 400 }
      );
    }

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "DNS_CONFIGURED",
        details: `DNS A records set to ${website.dropletIp}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `DNS configured! A records for @ and www now point to ${website.dropletIp}. DNS propagation can take 5-30 minutes.`,
      domain: website.domain,
      ip: website.dropletIp,
    });
  } catch (error) {
    console.error("DNS configuration failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DNS configuration failed" },
      { status: 500 }
    );
  }
}
