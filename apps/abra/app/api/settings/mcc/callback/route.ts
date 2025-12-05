import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt, decryptOAuthState } from "@/lib/encryption";
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  listAccessibleCustomers,
  normalizeCid,
} from "@/lib/google-ads-api";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";

/**
 * GET /api/settings/mcc/callback
 *
 * OAuth callback handler for MCC connection.
 * Google redirects here after user grants consent.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";

  try {
    const { searchParams } = new URL(request.url);

    // Check for error (user denied access)
    const error = searchParams.get("error");
    if (error) {
      const errorDesc = searchParams.get("error_description") || "Access denied";
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&mode=mcc&message=${encodeURIComponent(errorDesc)}`
      );
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&mode=mcc&message=${encodeURIComponent("Missing code or state")}`
      );
    }

    // Decrypt and validate state
    let stateData: { cid?: string; csrf: string; mode?: string };
    try {
      stateData = decryptOAuthState(state);
    } catch {
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&mode=mcc&message=${encodeURIComponent("Invalid or expired state")}`
      );
    }

    // Verify this is MCC mode
    if (stateData.mode !== "mcc") {
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&mode=mcc&message=${encodeURIComponent("Invalid OAuth mode")}`
      );
    }

    const mccId = stateData.cid;
    if (!mccId) {
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&mode=mcc&message=${encodeURIComponent("MCC ID not found in state")}`
      );
    }

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/settings/mcc/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Get user info (email, id)
    const userInfo = await getGoogleUserInfo(tokens.accessToken);

    // Get all accessible customer IDs to verify access to MCC
    let accessibleCids: string[] = [];
    try {
      accessibleCids = await listAccessibleCustomers(tokens.accessToken);
    } catch (err) {
      console.error("Failed to list accessible customers:", err);
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&mode=mcc&message=${encodeURIComponent(
          "Failed to verify Google Ads access. Please try again."
        )}`
      );
    }

    // Check if the MCC ID is accessible
    const normalizedMccId = normalizeCid(mccId);
    const hasAccess = accessibleCids.some((cid) => normalizeCid(cid) === normalizedMccId);

    if (!hasAccess) {
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&mode=mcc&message=${encodeURIComponent(
          `The Google account (${userInfo.email}) doesn't have access to MCC ${mccId}. ` +
          `Make sure you're signing in with an account that has Admin access to this Manager Account.`
        )}`
      );
    }

    // Get current user session for tracking who connected
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Create the GoogleAdsConnection for MCC
    const connection = await prisma.googleAdsConnection.create({
      data: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        googleUserId: userInfo.id,
        googleEmail: userInfo.email,
        status: "active",
      },
    });

    // Get or create settings
    let settings = await prisma.appSettings.findFirst();
    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          warmupTargetSpend: 5000,
        },
      });
    }

    // Clean up old MCC connection if different
    const oldConnectionId = settings.mccConnectionId;
    if (oldConnectionId && oldConnectionId !== connection.id) {
      // Check if old connection is used by any accounts
      const accountsUsingOld = await prisma.adAccount.count({
        where: { connectionId: oldConnectionId },
      });
      if (accountsUsingOld === 0) {
        await prisma.googleAdsConnection.delete({
          where: { id: oldConnectionId },
        }).catch(() => {}); // Ignore if already deleted
      }
    }

    // Update settings with MCC connection
    await prisma.appSettings.update({
      where: { id: settings.id },
      data: {
        mccCustomerId: normalizedMccId,
        mccConnectionId: connection.id,
        mccConnectedAt: new Date(),
        mccConnectedByUserId: userId,
      },
    });

    // Redirect to success page
    return NextResponse.redirect(
      `${baseUrl}/oauth-result?status=success&mode=mcc&mccId=${encodeURIComponent(mccId)}&email=${encodeURIComponent(userInfo.email)}`
    );
  } catch (error) {
    console.error("MCC OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      `${baseUrl}/oauth-result?status=error&mode=mcc&message=${encodeURIComponent(message)}`
    );
  }
}
