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

    if (account.connection.status !== 'active') {
      return NextResponse.json(
        { error: 'OAuth connection is not active - reconnection required' },
        { status: 400 }
      );
    }

    // Check if token needs refresh (with 5 min buffer)
    let accessToken = decrypt(account.connection.accessToken);
    const tokenExpiresAt = new Date(account.connection.tokenExpiresAt);
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (tokenExpiresAt.getTime() - Date.now() < bufferMs) {
      console.log(`[Manual Sync] Refreshing token for account ${id}`);
      try {
        const refreshToken = decrypt(account.connection.refreshToken);
        const newTokens = await refreshAccessToken(refreshToken);

        // Update stored tokens
        await prisma.googleAdsConnection.update({
          where: { id: account.connection.id },
          data: {
            accessToken: encrypt(newTokens.accessToken),
            tokenExpiresAt: newTokens.expiresAt,
          },
        });

        accessToken = newTokens.accessToken;
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
