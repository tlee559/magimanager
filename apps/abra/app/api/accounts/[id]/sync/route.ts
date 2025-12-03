import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';
import { syncSingleAccount, refreshAccessTokenWithRetry } from '@/lib/google-ads-api';

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

    // Only block permanently expired connections - allow 'needs_refresh' to attempt recovery
    if (account.connection.status === 'expired') {
      return NextResponse.json(
        { error: 'OAuth connection has expired - reconnection required' },
        { status: 400 }
      );
    }

    // Check if token needs refresh (with 5 min buffer) or connection needs recovery
    let accessToken = decrypt(account.connection.accessToken);
    const tokenExpiresAt = new Date(account.connection.tokenExpiresAt);
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    const needsRefresh = tokenExpiresAt.getTime() - Date.now() < bufferMs || account.connection.status === 'needs_refresh';

    if (needsRefresh) {
      console.log(`[Manual Sync] Refreshing token for account ${id} (status: ${account.connection.status})`);

      const refreshToken = decrypt(account.connection.refreshToken);
      const refreshResult = await refreshAccessTokenWithRetry(refreshToken);

      if (!refreshResult.success) {
        const error = refreshResult.error!;
        console.error(`[Manual Sync] Token refresh failed:`, error.message);

        // Determine new status based on error type
        const newStatus = error.isRecoverable ? 'needs_refresh' : 'expired';

        await prisma.googleAdsConnection.update({
          where: { id: account.connection.id },
          data: {
            status: newStatus,
            lastSyncError: error.message,
          },
        });

        if (error.isRecoverable) {
          return NextResponse.json(
            { error: 'Token refresh temporarily failed - please try again in a few minutes' },
            { status: 503 }
          );
        } else {
          return NextResponse.json(
            { error: 'OAuth token expired - reconnection required' },
            { status: 401 }
          );
        }
      }

      // Success - update tokens
      const updateData: {
        accessToken: string;
        tokenExpiresAt: Date;
        status: string;
        lastSyncError: null;
        refreshToken?: string;
      } = {
        accessToken: encrypt(refreshResult.accessToken!),
        tokenExpiresAt: refreshResult.expiresAt!,
        status: 'active',
        lastSyncError: null,
      };

      // Handle refresh token rotation (Google may issue a new refresh token)
      if (refreshResult.newRefreshToken) {
        console.log(`[Manual Sync] Refresh token rotated for account ${id}`);
        updateData.refreshToken = encrypt(refreshResult.newRefreshToken);
      }

      await prisma.googleAdsConnection.update({
        where: { id: account.connection.id },
        data: updateData,
      });

      accessToken = refreshResult.accessToken!;
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
