import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getGoLoginClientFromSettings } from "@/lib/gologin";

// POST - Refresh fingerprint for a GoLogin profile
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

    const gologinClient = await getGoLoginClientFromSettings();

    // Refresh the fingerprint in GoLogin
    await gologinClient.refreshFingerprint(gologinProfile.profileId);

    // Update our database with refresh timestamp
    const updatedProfile = await prisma.goLoginProfile.update({
      where: { id: gologinProfile.id },
      data: {
        fingerprintRefreshedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      gologinProfile: updatedProfile,
      message: "Fingerprint refreshed successfully",
    });
  } catch (error) {
    console.error("Error refreshing fingerprint:", error);
    return NextResponse.json(
      { error: "Failed to refresh fingerprint", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH - Update user agent to latest browser version
export async function PATCH(
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

    const gologinClient = await getGoLoginClientFromSettings();

    // Update user agent to latest Chrome version
    await gologinClient.updateUserAgent(gologinProfile.profileId);

    // Update browser version in our database
    const latestChromeVersion = "131.0.0.0"; // This should ideally come from GoLogin response
    const updatedProfile = await prisma.goLoginProfile.update({
      where: { id: gologinProfile.id },
      data: {
        browserVersion: latestChromeVersion,
      },
    });

    return NextResponse.json({
      success: true,
      gologinProfile: updatedProfile,
      message: "Browser version updated successfully",
    });
  } catch (error) {
    console.error("Error updating browser version:", error);
    return NextResponse.json(
      { error: "Failed to update browser version", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
