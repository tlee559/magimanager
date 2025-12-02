import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';
import { syncSingleAccount, refreshAccessToken } from '@/lib/google-ads-api';

/**
 * POST /api/accounts/[id]/sync
 *
 * Manually trigger a sync for a single account.
 * Refreshes token if needed and fetches latest metrics from Google Ads.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get the account with its connection
    const account = await prisma.adAccount.findUnique({
      where: { id },
      include: {
        connection: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (!account.googleCid) {
      return NextResponse.json(
        { error: 'Account has no Google CID configured' },
        { status: 400 }
      );
    }

    if (!account.connection) {
      return NextResponse.json(
        { error: 'Account is not connected via OAuth' },
        { status: 400 }
      );
    }

    // Try to refresh token - even if status is 'expired', we attempt recovery
    // The refresh token might still be valid even if access token expired
    let accessToken: string;
    const tokenExpiresAt = new Date(account.connection.tokenExpiresAt);
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    const needsRefresh = tokenExpiresAt.getTime() - Date.now() < bufferMs || account.connection.status === 'expired';

    if (needsRefresh) {
      console.log(`[Manual Sync] Refreshing token for account ${id} (status: ${account.connection.status})`);
      try {
        const refreshToken = decrypt(account.connection.refreshToken);
        const newTokens = await refreshAccessToken(refreshToken);

        // Update stored tokens AND reset status to active
        await prisma.googleAdsConnection.update({
          where: { id: account.connection.id },
          data: {
            accessToken: encrypt(newTokens.accessToken),
            tokenExpiresAt: newTokens.expiresAt,
            status: 'active', // Reset to active on successful refresh
            lastSyncError: null,
          },
        });

        accessToken = newTokens.accessToken;
        console.log(`[Manual Sync] Token refreshed successfully, connection restored to active`);
      } catch (error) {
        console.error(`[Manual Sync] Token refresh failed:`, error);

        // Mark connection as expired
        await prisma.googleAdsConnection.update({
          where: { id: account.connection.id },
          data: {
            status: 'expired',
            lastSyncError: error instanceof Error ? error.message : 'Token refresh failed',
          },
        });

        return NextResponse.json(
          { error: 'OAuth token expired - reconnection required' },
          { status: 401 }
        );
      }
    } else {
      accessToken = decrypt(account.connection.accessToken);
    }

    // Perform the sync
    const metrics = await syncSingleAccount(
      accessToken,
      account.id,
      account.googleCid,
      prisma
    );

    // Update connection last sync time
    await prisma.googleAdsConnection.update({
      where: { id: account.connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      metrics: {
        spend: metrics.costMicros / 1000000,
        ads: metrics.adCount,
        campaigns: metrics.campaignCount,
        status: metrics.status,
      },
    });
  } catch (error) {
    console.error('[Manual Sync] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
