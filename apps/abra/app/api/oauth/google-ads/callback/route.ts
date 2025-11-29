import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt, decryptOAuthState } from '@/lib/encryption';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  listAccessibleCustomers,
  normalizeCid,
  formatCid,
} from '@/lib/google-ads-api';

/**
 * GET /api/oauth/google-ads/callback
 *
 * OAuth callback handler. Google redirects here after user grants consent.
 *
 * Flow:
 * 1. If accountId provided (MagiManager account) - show account picker to select Google Ads CID
 * 2. If cid provided - try to link that specific CID (legacy flow)
 * 3. If neither - just store connection
 *
 * Query params:
 *   - code: Authorization code from Google
 *   - state: Encrypted state containing accountId/CID and CSRF token
 *   - error: Error code if user denied access
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_ABRA_URL || 'https://abra.magimanager.com';

  try {
    const { searchParams } = new URL(request.url);

    // Check for error (user denied access)
    const error = searchParams.get('error');
    if (error) {
      const errorDesc = searchParams.get('error_description') || 'Access denied';
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&message=${encodeURIComponent(errorDesc)}`
      );
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&message=${encodeURIComponent('Missing code or state')}`
      );
    }

    // Decrypt and validate state
    let stateData: { cid?: string; accountId?: string; csrf: string; debug?: boolean; mode?: string };
    try {
      stateData = decryptOAuthState(state);
    } catch {
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=error&message=${encodeURIComponent('Invalid or expired state')}`
      );
    }

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/oauth/google-ads/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Get user info (email, id)
    const userInfo = await getGoogleUserInfo(tokens.accessToken);

    // Get all accessible customer IDs
    let accessibleCids: string[] = [];
    let listCustomersError: string | null = null;
    try {
      accessibleCids = await listAccessibleCustomers(tokens.accessToken);
    } catch (err) {
      console.error('Failed to list accessible customers:', err);
      listCustomersError = err instanceof Error ? err.message : String(err);
      // Continue without accessible CIDs - user might not have any accounts yet
    }

    // DEBUG MODE: Just show the account IDs, don't save anything
    if (stateData.debug) {
      const debugHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Debug - Account IDs</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #34d399; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 24px; margin: 20px 0; }
    .label { color: #9ca3af; font-size: 14px; margin-bottom: 4px; }
    .value { color: #fff; font-size: 18px; font-family: monospace; }
    .cid { background: #1e3a5f; padding: 12px 16px; border-radius: 8px; margin: 8px 0; font-family: monospace; font-size: 16px; }
    .error { color: #f87171; }
    .success { color: #34d399; }
    .empty { color: #fbbf24; }
  </style>
</head>
<body>
  <h1>OAuth Debug Results</h1>

  <div class="card">
    <div class="label">Connected Google Account</div>
    <div class="value">${userInfo.email}</div>
  </div>

  <div class="card">
    <div class="label">Accessible Google Ads Account IDs</div>
    ${listCustomersError ? `<div class="error">Error: ${listCustomersError}</div>` : ''}
    ${accessibleCids.length > 0
      ? accessibleCids.map(cid => `<div class="cid success">${formatCid(cid)}</div>`).join('')
      : `<div class="empty">No accounts found - listAccessibleCustomers returned empty</div>`
    }
    <div style="margin-top: 16px; color: #9ca3af; font-size: 14px;">
      Total: ${accessibleCids.length} account(s)
    </div>
  </div>

  <div class="card">
    <div class="label">Raw Response</div>
    <pre style="background: #111; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px;">${JSON.stringify({ email: userInfo.email, accessibleCids, error: listCustomersError }, null, 2)}</pre>
  </div>

  <button onclick="window.close()" style="margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
    Close Window
  </button>
</body>
</html>`;
      return new NextResponse(debugHtml, { headers: { 'Content-Type': 'text/html' } });
    }

    // PICKER MODE: Return accounts to parent window for selection (used by Add Account modal)
    if (stateData.mode === 'picker') {
      if (listCustomersError || accessibleCids.length === 0) {
        return NextResponse.redirect(
          `${baseUrl}/oauth-result?status=picker&error=${encodeURIComponent(
            listCustomersError || 'This Google account has no accessible Google Ads accounts'
          )}`
        );
      }

      // Store the connection so we can link it to the account later
      const pickerConnection = await prisma.googleAdsConnection.create({
        data: {
          accessToken: encrypt(tokens.accessToken),
          refreshToken: encrypt(tokens.refreshToken),
          tokenExpiresAt: tokens.expiresAt,
          googleUserId: userInfo.id,
          googleEmail: userInfo.email,
          status: 'active',
        },
      });

      // Return accounts as comma-separated list with email and connectionId
      const cidsParam = encodeURIComponent(accessibleCids.map(cid => formatCid(cid)).join(','));
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=picker&email=${encodeURIComponent(userInfo.email)}&cids=${cidsParam}&connectionId=${pickerConnection.id}`
      );
    }

    // Store the connection
    const connection = await prisma.googleAdsConnection.create({
      data: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        googleUserId: userInfo.id,
        googleEmail: userInfo.email,
        status: 'active',
      },
    });

    // NEW FLOW: If accountId provided, show account picker
    if (stateData.accountId) {
      // Verify the MagiManager account exists
      const magiAccount = await prisma.adAccount.findUnique({
        where: { id: stateData.accountId },
        include: { identityProfile: true },
      });

      if (!magiAccount) {
        return NextResponse.redirect(
          `${baseUrl}/oauth-result?status=error&message=${encodeURIComponent('MagiManager account not found')}`
        );
      }

      // If no accessible accounts, show error
      if (accessibleCids.length === 0) {
        return NextResponse.redirect(
          `${baseUrl}/oauth-result?status=error&message=${encodeURIComponent(
            `This Google account (${userInfo.email}) doesn't have access to any Google Ads accounts. Make sure you're logged into the correct Google account.`
          )}`
        );
      }

      // If account already has a CID, check if it's in the accessible list
      if (magiAccount.googleCid) {
        const normalizedExistingCid = normalizeCid(magiAccount.googleCid);
        const hasAccess = accessibleCids.some((cid) => normalizeCid(cid) === normalizedExistingCid);

        if (hasAccess) {
          // CID matches - just link the connection
          await prisma.adAccount.update({
            where: { id: magiAccount.id },
            data: {
              connectionId: connection.id,
              connectionType: 'oauth',
              googleCidVerified: true,
              syncStatus: 'synced',
              googleSyncError: null,
            },
          });

          await prisma.accountActivity.create({
            data: {
              adAccountId: magiAccount.id,
              action: 'OAUTH_CONNECTED',
              details: `Account connected via OAuth (${userInfo.email})`,
            },
          });

          return NextResponse.redirect(
            `${baseUrl}/oauth-result?status=success&cid=${encodeURIComponent(magiAccount.googleCid)}&accountId=${magiAccount.id}`
          );
        }

        // CID doesn't match - show clear error explaining why
        const identityEmail = magiAccount.identityProfile?.email;
        const expectedCid = formatCid(magiAccount.googleCid);

        let errorMessage: string;
        if (identityEmail && identityEmail.toLowerCase() !== userInfo.email.toLowerCase()) {
          // Email mismatch - the most common case
          errorMessage = `Email mismatch: This account profile uses ${identityEmail} (CID: ${expectedCid}), but you signed in with ${userInfo.email}. Please sign in with the correct Google account.`;
        } else {
          // Same email but no access to the CID - permission issue
          errorMessage = `Access denied: Your Google account (${userInfo.email}) doesn't have access to CID ${expectedCid}. Make sure this account has Admin or Standard access to the Google Ads account.`;
        }

        // Clean up the connection we just created since we're not using it
        await prisma.googleAdsConnection.delete({ where: { id: connection.id } });

        return NextResponse.redirect(
          `${baseUrl}/oauth-result?status=error&message=${encodeURIComponent(errorMessage)}`
        );
      }

      // Show account picker - pass accessible CIDs as comma-separated list
      const cidsParam = encodeURIComponent(accessibleCids.join(','));
      return NextResponse.redirect(
        `${baseUrl}/oauth-result?status=select_account&accountId=${magiAccount.id}&connectionId=${connection.id}&email=${encodeURIComponent(userInfo.email)}&cids=${cidsParam}&accountName=${encodeURIComponent(magiAccount.identityProfile?.fullName || `Account #${magiAccount.internalId}`)}`
      );
    }

    // LEGACY FLOW: If a specific CID was provided, try to link it
    const targetCid = stateData.cid ? normalizeCid(stateData.cid) : null;

    if (targetCid) {
      // Check if user has access to this CID
      const hasAccess = accessibleCids.some((cid) => normalizeCid(cid) === targetCid);

      if (!hasAccess) {
        // Log for debugging
        console.log(`OAuth access check failed for CID ${targetCid}:`, {
          targetCid,
          googleEmail: userInfo.email,
          accessibleCids,
          accessibleCount: accessibleCids.length,
        });

        // User doesn't have access to this CID - provide helpful error message
        const accessibleList = accessibleCids.length > 0
          ? `This Google account (${userInfo.email}) has access to ${accessibleCids.length} account(s), but CID ${stateData.cid} is not one of them.`
          : `This Google account (${userInfo.email}) doesn't have access to any Google Ads accounts.`;

        return NextResponse.redirect(
          `${baseUrl}/oauth-result?status=error&message=${encodeURIComponent(
            `${accessibleList} Make sure you're logged into the Google account that has admin access to this ad account, or add ${userInfo.email} as a manager.`
          )}`
        );
      }

      // Check if account exists in MagiManager
      // Search for all possible CID formats: normalized (no dashes), formatted (with dashes), and original
      const formattedCid = formatCid(targetCid);
      const possibleCids = [...new Set([targetCid, formattedCid, stateData.cid!])];

      const existingAccount = await prisma.adAccount.findFirst({
        where: {
          googleCid: {
            in: possibleCids,
          },
        },
      });

      if (existingAccount) {
        // Check if account had a previous connection that needs cleanup
        const oldConnectionId = existingAccount.connectionId;
        const isReconnect = oldConnectionId && oldConnectionId !== connection.id;

        // Link existing account to connection and normalize the CID
        await prisma.adAccount.update({
          where: { id: existingAccount.id },
          data: {
            googleCid: targetCid, // Store normalized CID (no dashes)
            connectionId: connection.id,
            connectionType: 'oauth',
            googleCidVerified: true,
            syncStatus: 'synced',
            googleSyncError: null,
          },
        });

        // Clean up old connection if orphaned (no other accounts use it)
        if (isReconnect && oldConnectionId) {
          const otherAccountsUsingOldConnection = await prisma.adAccount.count({
            where: { connectionId: oldConnectionId },
          });

          if (otherAccountsUsingOldConnection === 0) {
            await prisma.googleAdsConnection.delete({
              where: { id: oldConnectionId },
            });
          }
        }

        // Log the OAuth connection
        await prisma.accountActivity.create({
          data: {
            adAccountId: existingAccount.id,
            action: isReconnect ? 'OAUTH_RECONNECTED' : 'OAUTH_CONNECTED',
            details: isReconnect
              ? `Account reconnected via OAuth (${userInfo.email}) - previous connection replaced`
              : `Account connected via OAuth (${userInfo.email})`,
          },
        });

        return NextResponse.redirect(
          `${baseUrl}/oauth-result?status=success&cid=${encodeURIComponent(stateData.cid!)}&accountId=${existingAccount.id}`
        );
      } else {
        // Account doesn't exist - redirect to quick-add flow
        return NextResponse.redirect(
          `${baseUrl}/oauth-result?status=not_found&cid=${encodeURIComponent(stateData.cid!)}&connectionId=${connection.id}`
        );
      }
    }

    // No specific CID - just show success with connection info
    return NextResponse.redirect(
      `${baseUrl}/oauth-result?status=success&connectionId=${connection.id}&email=${encodeURIComponent(userInfo.email)}`
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      `${baseUrl}/oauth-result?status=error&message=${encodeURIComponent(message)}`
    );
  }
}
