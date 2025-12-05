import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import {
  fetchAdGroups,
  refreshAccessTokenWithRetry,
  decryptToken,
  encryptToken,
} from "@magimanager/core";
import { isFeatureEnabled } from "@magimanager/shared";

// Helper to return cached ad groups
function returnCachedAdGroups(account: { cachedAdGroups: string | null; adGroupsCachedAt: Date | null }, campaignId: string, reason: string) {
  if (account.cachedAdGroups && account.adGroupsCachedAt) {
    try {
      const allAdGroups = JSON.parse(account.cachedAdGroups);
      // Filter by campaign if campaignId provided
      const adGroups = campaignId
        ? allAdGroups.filter((ag: { campaignId: string }) => ag.campaignId === campaignId)
        : allAdGroups;
      const cacheAge = Date.now() - new Date(account.adGroupsCachedAt).getTime();
      console.log(`[API/ad-groups] Returning cached data (${reason}): ${adGroups.length} ad groups`);
      return NextResponse.json({
        adGroups,
        syncedAt: account.adGroupsCachedAt,
        fromCache: true,
        cacheAge,
        cacheReason: reason,
      });
    } catch (parseError) {
      console.error("[API/ad-groups] Failed to parse cached ad groups:", parseError);
    }
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isFeatureEnabled("campaigns.view")) {
      return NextResponse.json({ error: "Campaign viewing is disabled" }, { status: 403 });
    }

    const { campaignId } = await params;
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const customerId = searchParams.get("customerId");

    if (!accountId || !customerId) {
      return NextResponse.json(
        { error: "accountId and customerId are required" },
        { status: 400 }
      );
    }

    const account = await prisma.adAccount.findUnique({
      where: { id: accountId },
      include: { connection: true },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // No connection - return cached data
    if (!account.connection) {
      const cached = returnCachedAdGroups(account, campaignId, "no_connection");
      if (cached) return cached;
      return NextResponse.json(
        { error: "Account is not connected to Google Ads" },
        { status: 400 }
      );
    }

    // Decrypt tokens
    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = decryptToken(account.connection.accessToken);
      refreshToken = decryptToken(account.connection.refreshToken);
    } catch (decryptError) {
      const cached = returnCachedAdGroups(account, campaignId, "token_decrypt_failed");
      if (cached) return cached;
      return NextResponse.json(
        { error: "Token decryption failed", needsReauth: true },
        { status: 401 }
      );
    }

    // Check if token needs refresh
    const now = new Date();
    const needsRefresh = account.connection.tokenExpiresAt <= now || account.connection.status === 'expired';

    if (needsRefresh) {
      const refreshResult = await refreshAccessTokenWithRetry(refreshToken, account.connection.id, 'kadabra');

      if (!refreshResult.success) {
        const newStatus = refreshResult.error?.isRecoverable ? 'needs_refresh' : 'expired';
        await prisma.googleAdsConnection.update({
          where: { id: account.connection.id },
          data: {
            status: newStatus,
            lastSyncError: refreshResult.error?.message || 'Token refresh failed',
          },
        });
        const cached = returnCachedAdGroups(account, campaignId, "token_refresh_failed");
        if (cached) return cached;
        return NextResponse.json(
          { error: "Failed to refresh OAuth token", needsReauth: !refreshResult.error?.isRecoverable },
          { status: 401 }
        );
      }

      accessToken = refreshResult.accessToken!;

      const updateData: any = {
        accessToken: encryptToken(refreshResult.accessToken!),
        tokenExpiresAt: refreshResult.expiresAt,
        status: 'active',
        lastSyncError: null,
      };

      if (refreshResult.newRefreshToken) {
        updateData.refreshToken = encryptToken(refreshResult.newRefreshToken);
      }

      await prisma.googleAdsConnection.update({
        where: { id: account.connection.id },
        data: updateData,
      });
    }

    // Fetch live data
    try {
      const adGroups = await fetchAdGroups(accessToken, customerId, { campaignId });

      // Update cache with fresh data (store ALL ad groups, not just filtered)
      if (!campaignId) {
        try {
          await prisma.adAccount.update({
            where: { id: accountId },
            data: {
              cachedAdGroups: JSON.stringify(adGroups),
              adGroupsCachedAt: new Date(),
            },
          });
        } catch (cacheError) {
          console.error("[API/ad-groups] Failed to update cache:", cacheError);
        }
      }

      return NextResponse.json({
        adGroups,
        syncedAt: new Date().toISOString(),
        fromCache: false,
      });
    } catch (fetchError) {
      console.error("Error fetching ad groups:", fetchError);
      const cached = returnCachedAdGroups(account, campaignId, "api_fetch_failed");
      if (cached) return cached;
      throw fetchError;
    }
  } catch (error) {
    console.error("Error fetching ad groups:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch ad groups" },
      { status: 500 }
    );
  }
}
