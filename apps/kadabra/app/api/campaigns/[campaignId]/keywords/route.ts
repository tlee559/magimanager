import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import {
  fetchKeywords,
  refreshAccessTokenWithRetry,
  decryptToken,
  encryptToken,
} from "@magimanager/core";
import { isFeatureEnabled } from "@magimanager/shared";

// Helper to return cached keywords
function returnCachedKeywords(
  account: { cachedKeywords: string | null; keywordsCachedAt: Date | null },
  campaignId: string,
  adGroupId: string | undefined,
  reason: string
) {
  if (account.cachedKeywords && account.keywordsCachedAt) {
    try {
      let keywords = JSON.parse(account.cachedKeywords);
      // Filter by campaign if provided
      if (campaignId) {
        keywords = keywords.filter((kw: { campaignId: string }) => kw.campaignId === campaignId);
      }
      // Filter by ad group if provided
      if (adGroupId) {
        keywords = keywords.filter((kw: { adGroupId: string }) => kw.adGroupId === adGroupId);
      }
      const cacheAge = Date.now() - new Date(account.keywordsCachedAt).getTime();
      console.log(`[API/keywords] Returning cached data (${reason}): ${keywords.length} keywords`);
      return NextResponse.json({
        keywords,
        syncedAt: account.keywordsCachedAt,
        fromCache: true,
        cacheAge,
        cacheReason: reason,
      });
    } catch (parseError) {
      console.error("[API/keywords] Failed to parse cached keywords:", parseError);
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

    if (!isFeatureEnabled("keywords.view")) {
      return NextResponse.json({ error: "Keywords viewing is disabled" }, { status: 403 });
    }

    const { campaignId } = await params;
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const customerId = searchParams.get("customerId");
    const dateRange = searchParams.get("dateRange") || "LAST_30_DAYS";
    const adGroupId = searchParams.get("adGroupId") || undefined;

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
      const cached = returnCachedKeywords(account, campaignId, adGroupId, "no_connection");
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
      const cached = returnCachedKeywords(account, campaignId, adGroupId, "token_decrypt_failed");
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
        const cached = returnCachedKeywords(account, campaignId, adGroupId, "token_refresh_failed");
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
      const keywords = await fetchKeywords(accessToken, customerId, {
        campaignId,
        adGroupId,
        dateRange: dateRange as any,
      });

      // Update cache with fresh data (store ALL keywords when no filters)
      if (!campaignId && !adGroupId) {
        try {
          await prisma.adAccount.update({
            where: { id: accountId },
            data: {
              cachedKeywords: JSON.stringify(keywords),
              keywordsCachedAt: new Date(),
            },
          });
        } catch (cacheError) {
          console.error("[API/keywords] Failed to update cache:", cacheError);
        }
      }

      return NextResponse.json({
        keywords,
        syncedAt: new Date().toISOString(),
        fromCache: false,
      });
    } catch (fetchError) {
      console.error("Error fetching keywords:", fetchError);
      const cached = returnCachedKeywords(account, campaignId, adGroupId, "api_fetch_failed");
      if (cached) return cached;
      throw fetchError;
    }
  } catch (error) {
    console.error("Error fetching keywords:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch keywords" },
      { status: 500 }
    );
  }
}
