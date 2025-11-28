import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildOAuthUrl } from '@/lib/google-ads-api';
import { encryptOAuthState } from '@/lib/encryption';

/**
 * GET /api/oauth/google-ads/authorize
 *
 * Initiates OAuth flow for Google Ads connection.
 * Called from the dashboard when user clicks "Connect to Google".
 *
 * Query params:
 *   - accountId: MagiManager ad account ID (new flow - shows account picker after OAuth)
 *   - cid: Optional Google Ads customer ID being connected (legacy flow)
 *   - debug: If true, shows raw account IDs after OAuth (no linking)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || undefined;
    const cid = searchParams.get('cid') || undefined;
    const debug = searchParams.get('debug') === 'true';

    // Check required env vars
    if (!process.env.GOOGLE_ADS_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Google Ads OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate CSRF token
    const csrf = crypto.randomBytes(32).toString('hex');

    // Encrypt state with accountId/CID, CSRF, and debug flag
    const state = encryptOAuthState({ accountId, cid, csrf, debug });

    // Build callback URL - always use the same registered callback
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abra.magimanager.com';
    const redirectUri = `${baseUrl}/api/oauth/google-ads/callback`;

    // Build OAuth URL
    const authUrl = buildOAuthUrl(redirectUri, state);

    // Redirect to Google OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('OAuth authorize error:', error);
    return NextResponse.json(
      { error: 'Failed to start OAuth flow' },
      { status: 500 }
    );
  }
}
