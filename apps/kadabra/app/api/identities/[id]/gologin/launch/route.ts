import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// POST - Get cloud browser launch URL for a GoLogin profile
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const userRole = (session.user as { role?: string }).role;
    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(userRole || "")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;

    // Get the GoLogin profile
    const gologinProfile = await prisma.goLoginProfile.findUnique({
      where: { identityProfileId: id },
    });

    if (!gologinProfile) {
      return NextResponse.json(
        { error: "GoLogin profile not found" },
        { status: 404 }
      );
    }

    if (!gologinProfile.profileId) {
      return NextResponse.json(
        { error: "GoLogin profile has no remote profile ID" },
        { status: 400 }
      );
    }

    // Get the API key
    const settings = await prisma.appSettings.findFirst();
    const apiKey = settings?.gologinApiKey || process.env.GOLOGIN_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GoLogin API key not configured" },
        { status: 500 }
      );
    }

    // Generate cloud browser WebSocket URL
    // This URL can be used with Puppeteer/Playwright to control the browser
    const cloudBrowserUrl = `wss://cloudbrowser.gologin.com/connect?token=${apiKey}&profile=${gologinProfile.profileId}`;

    // Also generate the web app URL for manual access
    const webAppUrl = `https://app.gologin.com/browser/${gologinProfile.profileId}`;

    // Update last used timestamp
    await prisma.goLoginProfile.update({
      where: { id: gologinProfile.id },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      profileId: gologinProfile.profileId,
      cloudBrowserUrl: cloudBrowserUrl,
      webAppUrl: webAppUrl,
      message: "Browser launch URLs generated",
      instructions: {
        cloud: "Use the cloudBrowserUrl with Puppeteer: browser = await puppeteer.connect({ browserWSEndpoint: cloudBrowserUrl })",
        web: "Open webAppUrl in your browser to launch the profile in GoLogin's web app",
      },
    });
  } catch (error) {
    console.error("Error generating launch URL:", error);
    return NextResponse.json(
      { error: "Failed to generate launch URL", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
