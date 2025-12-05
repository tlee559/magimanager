/**
 * Internal Sync API
 *
 * This endpoint allows KADABRA (or other internal services) to trigger
 * a sync for a specific account. It's the single point of entry for
 * OAuth token management and Google Ads API calls.
 *
 * Authentication: Bearer INTER_APP_SECRET
 */

import { NextResponse } from 'next/server';
import { prisma } from '@magimanager/database';
import { isInterAppRequest } from '@magimanager/auth';
import {
  refreshAccessTokenWithRetry,
  decryptToken,
  encryptToken,
  logOAuthActivity,
  syncSingleAccount,
} from '@magimanager/core';
import { broadcastEvent, CHANNELS } from '@magimanager/realtime';

interface SyncRequest {
  accountId: string;
  reason?: string;
}

export async function POST(request: Request) {
  // Validate inter-app authentication
  if (!isInterAppRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid inter-app credentials' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json() as SyncRequest;
    const { accountId, reason } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing required field: accountId' },
        { status: 400 }
      );
    }

    console.log(`[Internal Sync] Starting sync for account ${accountId} (reason: ${reason || 'not specified'})`);

    // Get the account with its OAuth connection
    const account = await prisma.adAccount.findUnique({
      where: { id: accountId },
      include: {
        connection: true,
        identityProfile: { select: { fullName: true } },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!account.connection) {
      return NextResponse.json(
        { error: 'Account has no OAuth connection' },
        { status: 400 }
      );
    }

    if (!account.googleCid) {
      return NextResponse.json(
        { error: 'Account has no Google CID configured' },
        { status: 400 }
      );
    }

    const connection = account.connection;

    // Log sync start
    await logOAuthActivity(connection.id, 'sync_started', 'abra', {
      accountId,
      reason,
      triggeredBy: 'internal_api',
    });

    // Check if token needs refresh (5 minute buffer)
    const bufferMs = 5 * 60 * 1000;
    const needsRefresh = connection.tokenExpiresAt.getTime() - Date.now() < bufferMs;

    let accessToken: string;

    if (needsRefresh || connection.status === 'needs_refresh') {
      console.log(`[Internal Sync] Token needs refresh for connection ${connection.id}`);

      // Decrypt the refresh token
      const refreshToken = decryptToken(connection.refreshToken);

      // Attempt to refresh with retry logic
      const refreshResult = await refreshAccessTokenWithRetry(
        refreshToken,
        connection.id,
        'abra'
      );

      if (!refreshResult.success) {
        const error = refreshResult.error!;
        console.error(`[Internal Sync] Token refresh failed:`, error.message);

        // Update connection status based on error type
        const newStatus = error.isRecoverable ? 'needs_refresh' : 'expired';

        await prisma.googleAdsConnection.update({
          where: { id: connection.id },
          data: {
            status: newStatus,
            lastSyncError: error.message,
          },
        });

        await logOAuthActivity(connection.id, 'sync_failed', 'abra', {
          accountId,
          reason: 'token_refresh_failed',
          errorCode: error.errorCode,
          isRecoverable: error.isRecoverable,
        }, error.errorCode, error.isRecoverable);

        return NextResponse.json(
          {
            error: 'Token refresh failed',
            errorCode: error.errorCode,
            isRecoverable: error.isRecoverable,
            message: error.message,
          },
          { status: 401 }
        );
      }

      // Store refreshed token
      accessToken = refreshResult.accessToken!;

      const updateData: any = {
        accessToken: encryptToken(accessToken),
        tokenExpiresAt: refreshResult.expiresAt,
        status: 'active',
        lastSyncError: null,
      };

      // Handle token rotation (Google may return a new refresh token)
      if (refreshResult.newRefreshToken) {
        updateData.refreshToken = encryptToken(refreshResult.newRefreshToken);
        console.log(`[Internal Sync] Token rotation detected, storing new refresh token`);
      }

      await prisma.googleAdsConnection.update({
        where: { id: connection.id },
        data: updateData,
      });

      console.log(`[Internal Sync] Token refreshed successfully`);
    } else {
      // Token is still valid, decrypt it
      accessToken = decryptToken(connection.accessToken);
    }

    // Now perform the actual sync
    const metrics = await syncSingleAccount(
      accessToken,
      accountId,
      account.googleCid,
      prisma
    );

    // Update connection last sync time
    await prisma.googleAdsConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
      },
    });

    // Log sync completion
    await logOAuthActivity(connection.id, 'sync_completed', 'abra', {
      accountId,
      metrics: {
        customerId: metrics.customerId,
        costMicros: metrics.costMicros,
        todayCostMicros: metrics.todayCostMicros,
        campaignCount: metrics.campaignCount,
        adCount: metrics.adCount,
      },
    });

    // Broadcast sync completion event for real-time UI updates
    try {
      await broadcastEvent(CHANNELS.ACCOUNTS, 'sync:google-ads', {
        accountId,
        customerId: metrics.customerId,
        status: 'completed',
        metrics: {
          spend: metrics.costMicros / 1000000,
          todaySpend: metrics.todayCostMicros / 1000000,
          campaigns: metrics.campaignCount,
          ads: metrics.adCount,
        },
        syncedAt: new Date().toISOString(),
      });
    } catch (broadcastError) {
      console.error('[Internal Sync] Failed to broadcast event:', broadcastError);
      // Don't fail the sync just because broadcast failed
    }

    console.log(`[Internal Sync] Sync completed successfully for account ${accountId}`);

    return NextResponse.json({
      success: true,
      accountId,
      syncedAt: new Date().toISOString(),
      metrics: {
        customerId: metrics.customerId,
        customerName: metrics.customerName,
        status: metrics.status,
        spend: metrics.costMicros / 1000000,
        todaySpend: metrics.todayCostMicros / 1000000,
        clicks: metrics.clicks,
        impressions: metrics.impressions,
        campaignCount: metrics.campaignCount,
        adCount: metrics.adCount,
      },
    });
  } catch (error) {
    console.error('[Internal Sync] Error:', error);

    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check sync status for an account
 */
export async function GET(request: Request) {
  // Validate inter-app authentication
  if (!isInterAppRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid inter-app credentials' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: accountId' },
      { status: 400 }
    );
  }

  const account = await prisma.adAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      googleCid: true,
      syncStatus: true,
      lastGoogleSyncAt: true,
      googleSyncError: true,
      connection: {
        select: {
          id: true,
          status: true,
          googleEmail: true,
          lastSyncAt: true,
          lastSyncError: true,
          tokenExpiresAt: true,
        },
      },
    },
  });

  if (!account) {
    return NextResponse.json(
      { error: 'Account not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    accountId: account.id,
    googleCid: account.googleCid,
    syncStatus: account.syncStatus,
    lastSyncAt: account.lastGoogleSyncAt,
    syncError: account.googleSyncError,
    connection: account.connection ? {
      id: account.connection.id,
      status: account.connection.status,
      email: account.connection.googleEmail,
      lastSyncAt: account.connection.lastSyncAt,
      lastSyncError: account.connection.lastSyncError,
      tokenExpiresAt: account.connection.tokenExpiresAt,
    } : null,
  });
}
