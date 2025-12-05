import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { buildOAuthUrl } from "@/lib/google-ads-api";
import { encryptOAuthState } from "@/lib/encryption";
import { requireSuperAdmin } from "@/lib/api-auth";

/**
 * GET /api/settings/mcc/authorize
 *
 * Initiates OAuth flow for MCC connection.
 * Only SUPER_ADMIN can connect the MCC account.
 *
 * Query params:
 *   - mccId: The MCC customer ID to connect (e.g., "732-568-8009" or "7325688009")
 */
export async function GET(request: NextRequest) {
  // Verify SUPER_ADMIN
  const auth = await requireSuperAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const mccId = searchParams.get("mccId");

    if (!mccId) {
      return NextResponse.json(
        { error: "MCC ID is required" },
        { status: 400 }
      );
    }

    // Normalize MCC ID (remove dashes)
    const normalizedMccId = mccId.replace(/-/g, "");

    // Validate MCC ID format (should be 10 digits)
    if (!/^\d{10}$/.test(normalizedMccId)) {
      return NextResponse.json(
        { error: "Invalid MCC ID format. Should be 10 digits (e.g., 732-568-8009)" },
        { status: 400 }
      );
    }

    // Check required env vars
    if (!process.env.GOOGLE_ADS_CLIENT_ID) {
      return NextResponse.json(
        { error: "Google Ads OAuth not configured" },
        { status: 500 }
      );
    }

    // Generate CSRF token
    const csrf = crypto.randomBytes(32).toString("hex");

    // Encrypt state with MCC mode flag
    const state = encryptOAuthState({
      csrf,
      mode: "mcc",
      cid: normalizedMccId, // Store MCC ID in state
    });

    // Build callback URL
    const baseUrl = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";
    const redirectUri = `${baseUrl}/api/settings/mcc/callback`;

    // Build OAuth URL
    const authUrl = buildOAuthUrl(redirectUri, state);

    // Redirect to Google OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("MCC OAuth authorize error:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth flow" },
      { status: 500 }
    );
  }
}
