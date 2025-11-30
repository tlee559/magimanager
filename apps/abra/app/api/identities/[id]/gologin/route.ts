import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getGoLoginClientFromSettings } from "@magimanager/core";

// GET - Get GoLogin profile for an identity
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

    const identity = await prisma.identityProfile.findUnique({
      where: { id },
      include: { gologinProfile: true },
    });

    if (!identity) {
      return NextResponse.json({ error: "Identity not found" }, { status: 404 });
    }

    return NextResponse.json({
      gologinProfile: identity.gologinProfile,
    });
  } catch (error) {
    console.error("Error fetching GoLogin profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch GoLogin profile" },
      { status: 500 }
    );
  }
}

// POST - Create GoLogin profile for an identity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions - only SUPER_ADMIN, ADMIN, MANAGER can create GoLogin profiles
    const userRole = (session.user as { role?: string }).role;
    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(userRole || "")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;

    // Check if identity exists - include ad account for naming
    const identity = await prisma.identityProfile.findUnique({
      where: { id },
      include: {
        gologinProfile: true,
        adAccounts: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!identity) {
      return NextResponse.json({ error: "Identity not found" }, { status: 404 });
    }

    // Check if profile already exists
    if (identity.gologinProfile) {
      return NextResponse.json(
        { error: "GoLogin profile already exists for this identity" },
        { status: 400 }
      );
    }

    // Get GoLogin client
    let gologinClient;
    try {
      gologinClient = await getGoLoginClientFromSettings();
    } catch (settingsError) {
      const errorMessage = settingsError instanceof Error ? settingsError.message : "Unknown settings error";
      console.error("GoLogin settings error:", errorMessage);
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Create profile name: MM001-Thomas Lee (internal ID + full name)
    const adAccount = identity.adAccounts?.[0];
    const internalId = adAccount
      ? `MM${String(adAccount.internalId).padStart(3, '0')}`
      : 'MM000'; // Fallback if no account linked
    const profileName = `${internalId}-${identity.fullName}`;

    try {
      // Create profile in GoLogin with 2FA extension pre-installed
      console.log(`Creating GoLogin profile: ${profileName}`);
      const gologinProfile = await gologinClient.createProfile({
        name: profileName,
        os: "win",
        notes: `Identity: ${identity.fullName} | Email: ${identity.email || 'N/A'} | ID: ${identity.id}`,
      });
      console.log(`GoLogin profile created:`, gologinProfile);

      // Add GoLogin's built-in residential proxy matching identity's geo
      // This ensures IP location matches the identity's country for consistency
      const proxyCountry = identity.geo?.toLowerCase() || "us";
      let proxyAdded = false;
      try {
        console.log(`Adding GoLogin proxy for country: ${proxyCountry}`);
        await gologinClient.addGologinProxy(gologinProfile.id, proxyCountry);
        proxyAdded = true;
        console.log(`GoLogin proxy added successfully`);
      } catch (proxyError) {
        // Proxy might fail if account doesn't have proxy traffic - continue anyway
        console.warn(`Failed to add GoLogin proxy (may require paid plan):`, proxyError);
      }

      // Wait for profile to be ready (GoLogin needs time to provision)
      console.log(`Waiting for profile ${gologinProfile.id} to be ready...`);
      const readyProfile = await gologinClient.waitForProfileReady(gologinProfile.id, 30000, 2000);
      const isReady = readyProfile.canBeRunning === true && !readyProfile.isRunDisabled;
      console.log(`Profile ready status: ${isReady}, canBeRunning: ${readyProfile.canBeRunning}, isRunDisabled: ${readyProfile.isRunDisabled}`);

      // Determine status based on GoLogin's response
      let profileStatus = "provisioning";
      if (isReady) {
        profileStatus = "ready";
      } else if (readyProfile.isRunDisabled && readyProfile.runDisabledReason) {
        profileStatus = "error";
      }

      // Save to database
      const savedProfile = await prisma.goLoginProfile.create({
        data: {
          identityProfileId: identity.id,
          profileId: gologinProfile.id,
          profileName: profileName,
          status: profileStatus,
          proxyMode: proxyAdded ? "gologin" : "none",
          proxyCountry: proxyAdded ? proxyCountry : null,
          errorMessage: readyProfile.runDisabledReason || null,
        },
      });

      // Log activity
      const currentUserId = session.user.id;
      const proxyNote = proxyAdded ? ` with ${proxyCountry.toUpperCase()} proxy` : "";
      await prisma.identityActivity.create({
        data: {
          identityProfileId: identity.id,
          action: "GOLOGIN_CREATED",
          details: `GoLogin browser profile created: ${profileName} (ID: ${gologinProfile.id})${proxyNote}`,
          createdBy: currentUserId,
        },
      });

      return NextResponse.json({
        success: true,
        gologinProfile: savedProfile,
        message: `GoLogin profile created successfully${proxyAdded ? ` with ${proxyCountry.toUpperCase()} proxy` : ""}`,
        proxyAdded,
      });
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : "Unknown API error";
      console.error("GoLogin API error:", errorMessage);

      // Save failed attempt to database
      const failedProfile = await prisma.goLoginProfile.create({
        data: {
          identityProfileId: identity.id,
          profileName: profileName,
          status: "error",
          errorMessage: errorMessage,
        },
      });

      return NextResponse.json(
        {
          error: "GoLogin API error",
          details: errorMessage,
          gologinProfile: failedProfile,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating GoLogin profile:", errorMessage, error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Delete GoLogin profile for an identity
export async function DELETE(
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

    // If we have a real GoLogin profile ID, try to delete it from GoLogin
    if (gologinProfile.profileId) {
      const gologinClient = await getGoLoginClientFromSettings();
      if (gologinClient) {
        try {
          await gologinClient.deleteProfile(gologinProfile.profileId);
        } catch (apiError) {
          console.error("Failed to delete from GoLogin API:", apiError);
          // Continue with database deletion even if API fails
        }
      }
    }

    // Delete from database
    await prisma.goLoginProfile.delete({
      where: { identityProfileId: id },
    });

    // Log activity
    const currentUserId = session.user.id;
    await prisma.identityActivity.create({
      data: {
        identityProfileId: id,
        action: "GOLOGIN_DELETED",
        details: `GoLogin browser profile "${gologinProfile.profileName}" deleted`,
        createdBy: currentUserId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "GoLogin profile deleted",
    });
  } catch (error) {
    console.error("Error deleting GoLogin profile:", error);
    return NextResponse.json(
      { error: "Failed to delete GoLogin profile" },
      { status: 500 }
    );
  }
}
