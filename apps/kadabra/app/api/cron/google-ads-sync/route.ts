import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';
import { isValidCronRequest } from '@magimanager/auth';
import {
  refreshAccessToken,
  fetchAccountMetrics,
  fetchCampaigns,
  mapGoogleStatus,
} from '@/lib/google-ads-api';

/**
 * Get a date string in YYYY-MM-DD format with an optional offset
 */
function getDateString(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

/**
 * GET /api/cron/google-ads-sync
 *
 * Hourly sync worker that fetches metrics from Google Ads API
 * for all accounts with active OAuth connections.
 *
 * Called by Vercel Cron every hour.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret using constant-time comparison
  const authHeader = request.headers.get('authorization');

  if (process.env.NODE_ENV === 'production' && !isValidCronRequest(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    synced: 0,
    errors: 0,
    skipped: 0,
    details: [] as { accountId: string; cid: string; status: string; error?: string }[],
  };

  try {
    // Get all accounts with OAuth connections (including expired - we'll try to recover them)
    const accountsToSync = await prisma.adAccount.findMany({
      where: {
        connectionId: { not: null },
        handoffStatus: { not: 'archived' },
      },
      include: {
        connection: true,
      },
    });

    console.log(`[Google Ads Sync] Starting sync for ${accountsToSync.length} accounts`);

    // Group accounts by connection to minimize token refreshes
    const connectionGroups = new Map<string, typeof accountsToSync>();
    for (const account of accountsToSync) {
      const connId = account.connectionId!;
      if (!connectionGroups.has(connId)) {
        connectionGroups.set(connId, []);
      }
      connectionGroups.get(connId)!.push(account);
    }

    // Process each connection group
    for (const [connectionId, accounts] of connectionGroups) {
      const connection = accounts[0].connection!;

      // Check if token needs refresh (with 5 min buffer) or if connection was marked expired
      let accessToken: string;
      const tokenExpiresAt = new Date(connection.tokenExpiresAt);
      const bufferMs = 5 * 60 * 1000; // 5 minutes
      const needsRefresh = tokenExpiresAt.getTime() - Date.now() < bufferMs || connection.status === 'expired';

      if (needsRefresh) {
        console.log(`[Google Ads Sync] Refreshing token for connection ${connectionId} (status: ${connection.status})`);
        try {
          const refreshToken = decrypt(connection.refreshToken);
          const newTokens = await refreshAccessToken(refreshToken);

          // Update stored tokens AND reset status to active
          await prisma.googleAdsConnection.update({
            where: { id: connectionId },
            data: {
              accessToken: encrypt(newTokens.accessToken),
              tokenExpiresAt: newTokens.expiresAt,
              status: 'active', // Reset to active on successful refresh
              lastSyncError: null,
            },
          });

          accessToken = newTokens.accessToken;
          console.log(`[Google Ads Sync] Token refreshed, connection ${connectionId} restored to active`);
        } catch (error) {
          console.error(`[Google Ads Sync] Token refresh failed for ${connectionId}:`, error);

          // Mark connection as expired
          await prisma.googleAdsConnection.update({
            where: { id: connectionId },
            data: {
              status: 'expired',
              lastSyncError: error instanceof Error ? error.message : 'Token refresh failed',
            },
          });

          // Mark all accounts in this group as having sync errors
          for (const account of accounts) {
            await prisma.adAccount.update({
              where: { id: account.id },
              data: {
                syncStatus: 'error',
                googleSyncError: 'OAuth token expired - reconnection required',
              },
            });
            results.errors++;
            results.details.push({
              accountId: account.id,
              cid: account.googleCid || 'unknown',
              status: 'error',
              error: 'Token expired',
            });
          }
          continue;
        }
      } else {
        accessToken = decrypt(connection.accessToken);
      }

      // Sync each account in this connection group
      for (const account of accounts) {
        if (!account.googleCid) {
          results.skipped++;
          continue;
        }

        try {
          // Mark as syncing
          await prisma.adAccount.update({
            where: { id: account.id },
            data: { syncStatus: 'syncing' },
          });

          // Fetch metrics from Google Ads API
          const metrics = await fetchAccountMetrics(accessToken, account.googleCid);

          // Convert cost from micros to cents
          const spendCents = Math.round(metrics.costMicros / 10000); // micros / 1M * 100

          // Update account
          await prisma.adAccount.update({
            where: { id: account.id },
            data: {
              currentSpendTotal: spendCents,
              adsCount: metrics.adCount,
              campaignsCount: metrics.campaignCount,
              accountHealth: mapGoogleStatus(metrics.status),
              lastGoogleSyncAt: new Date(),
              syncStatus: 'synced',
              googleSyncError: null,
              googleCidVerified: true,
            },
          });

          // Create/update daily snapshot
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          await prisma.dailySpendSnapshot.upsert({
            where: {
              adAccountId_date: {
                adAccountId: account.id,
                date: today,
              },
            },
            create: {
              adAccountId: account.id,
              date: today,
              dailySpend: spendCents / 100, // Convert to dollars for snapshot
              totalSpend: spendCents / 100,
              adsCount: metrics.adCount,
              campaignsCount: metrics.campaignCount,
              accountHealth: mapGoogleStatus(metrics.status),
              billingStatus: account.billingStatus,
            },
            update: {
              dailySpend: spendCents / 100,
              totalSpend: spendCents / 100,
              adsCount: metrics.adCount,
              campaignsCount: metrics.campaignCount,
              accountHealth: mapGoogleStatus(metrics.status),
            },
          });

          // Cache campaigns for offline viewing
          try {
            const campaigns = await fetchCampaigns(accessToken, account.googleCid.replace(/-/g, ''), {
              includeMetrics: true,
              dateRangeStart: getDateString(-6), // Last 7 days
              dateRangeEnd: getDateString(0),
            });

            await prisma.adAccount.update({
              where: { id: account.id },
              data: {
                cachedCampaigns: JSON.stringify(campaigns),
                campaignsCachedAt: new Date(),
              },
            });

            console.log(`[Google Ads Sync] Cached ${campaigns.length} campaigns for ${account.googleCid}`);
          } catch (cacheError) {
            // Don't fail the sync if campaign caching fails
            console.error(`[Google Ads Sync] Campaign caching failed for ${account.googleCid}:`, cacheError);
          }

          results.synced++;
          results.details.push({
            accountId: account.id,
            cid: account.googleCid,
            status: 'synced',
          });

          console.log(`[Google Ads Sync] Synced ${account.googleCid}: ${metrics.adCount} ads, $${(spendCents / 100).toFixed(2)} spend`);
        } catch (error) {
          console.error(`[Google Ads Sync] Error syncing ${account.googleCid}:`, error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          await prisma.adAccount.update({
            where: { id: account.id },
            data: {
              syncStatus: 'error',
              googleSyncError: errorMessage,
            },
          });

          results.errors++;
          results.details.push({
            accountId: account.id,
            cid: account.googleCid,
            status: 'error',
            error: errorMessage,
          });
        }
      }

      // Update connection last sync time
      await prisma.googleAdsConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastSyncError: null,
        },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Google Ads Sync] Completed in ${duration}ms: ${results.synced} synced, ${results.errors} errors, ${results.skipped} skipped`);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      results,
    });
  } catch (error) {
    console.error('[Google Ads Sync] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
