import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getGoLoginClientFromSettings } from "@/lib/gologin";

// PATCH - Update proxy for a GoLogin profile
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
    const body = await request.json();
    const { mode, host, port, username, password, country } = body;

    // Get the GoLogin profile
    const gologinProfile = await prisma.goLoginProfile.findUnique({
      where: { identityProfileId: id },
      include: { identityProfile: true },
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

    // Determine proxy mode and update in GoLogin
    if (mode === "gologin") {
      // Use GoLogin's built-in proxy with the specified country
      const proxyCountry = country || gologinProfile.identityProfile.geo || "us";
      await gologinClient.addGologinProxy(gologinProfile.profileId, proxyCountry);

      // Update our database
      await prisma.goLoginProfile.update({
        where: { id: gologinProfile.id },
        data: {
          proxyMode: "gologin",
          proxyCountry: proxyCountry.toLowerCase(),
          proxyHost: null,
          proxyPort: null,
          proxyUsername: null,
          proxyPassword: null,
        },
      });
    } else if (mode === "none") {
      // Remove proxy
      await gologinClient.updateProfileProxy(gologinProfile.profileId, { mode: "none" });

      await prisma.goLoginProfile.update({
        where: { id: gologinProfile.id },
        data: {
          proxyMode: "none",
          proxyCountry: null,
          proxyHost: null,
          proxyPort: null,
          proxyUsername: null,
          proxyPassword: null,
        },
      });
    } else {
      // Custom proxy (http, socks4, socks5)
      if (!host || !port) {
        return NextResponse.json(
          { error: "Host and port are required for custom proxy" },
          { status: 400 }
        );
      }

      await gologinClient.updateProfileProxy(gologinProfile.profileId, {
        mode: mode || "http",
        host,
        port: Number(port),
        username: username || undefined,
        password: password || undefined,
      });

      await prisma.goLoginProfile.update({
        where: { id: gologinProfile.id },
        data: {
          proxyMode: mode || "http",
          proxyHost: host,
          proxyPort: Number(port),
          proxyUsername: username || null,
          proxyPassword: password || null,
          proxyCountry: country || null,
        },
      });
    }

    // Fetch updated profile
    const updatedProfile = await prisma.goLoginProfile.findUnique({
      where: { id: gologinProfile.id },
    });

    return NextResponse.json({
      success: true,
      gologinProfile: updatedProfile,
      message: "Proxy updated successfully",
    });
  } catch (error) {
    console.error("Error updating proxy:", error);
    return NextResponse.json(
      { error: "Failed to update proxy", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET - Get proxy status for a GoLogin profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const gologinProfile = await prisma.goLoginProfile.findUnique({
      where: { identityProfileId: id },
      select: {
        proxyMode: true,
        proxyHost: true,
        proxyPort: true,
        proxyUsername: true,
        proxyCountry: true,
      },
    });

    if (!gologinProfile) {
      return NextResponse.json(
        { error: "GoLogin profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      proxy: {
        mode: gologinProfile.proxyMode,
        host: gologinProfile.proxyHost,
        port: gologinProfile.proxyPort,
        username: gologinProfile.proxyUsername,
        country: gologinProfile.proxyCountry,
        // Don't expose password
      },
    });
  } catch (error) {
    console.error("Error fetching proxy:", error);
    return NextResponse.json(
      { error: "Failed to fetch proxy" },
      { status: 500 }
    );
  }
}
