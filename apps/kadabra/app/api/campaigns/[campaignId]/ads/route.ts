import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { fetchAds, refreshAccessToken } from "@/lib/google-ads-api";
import { isFeatureEnabled } from "@magimanager/shared";
import { decrypt, encrypt } from "@/lib/encryption";

// Helper to return cached ads
function returnCachedAds(account: { cachedAds: string | null; adsCachedAt: Date | null }, campaignId: string, reason: string) {
  if (account.cachedAds && account.adsCachedAt) {
    try {
      const allAds = JSON.parse(account.cachedAds);
      // Filter by campaign if campaignId provided
      const ads = campaignId
        ? allAds.filter((ad: { campaignId: string }) => ad.campaignId === campaignId)
        : allAds;
      const cacheAge = Date.now() - new Date(account.adsCachedAt).getTime();
      console.log(`[API/ads] Returning cached data (${reason}): ${ads.length} ads`);
      return NextResponse.json({
        ads,
        syncedAt: account.adsCachedAt,
        fromCache: true,
        cacheAge,
        cacheReason: reason,
      });
    } catch (parseError) {
      console.error("[API/ads] Failed to parse cached ads:", parseError);
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

    if (!isFeatureEnabled("ads.view")) {
      return NextResponse.json({ error: "Ads viewing is disabled" }, { status: 403 });
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
      const cached = returnCachedAds(account, campaignId, "no_connection");
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
      accessToken = decrypt(account.connection.accessToken);
      refreshToken = decrypt(account.connection.refreshToken);
    } catch (decryptError) {
      const cached = returnCachedAds(account, campaignId, "token_decrypt_failed");
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
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;

        await prisma.googleAdsConnection.update({
          where: { id: account.connection.id },
          data: {
            accessToken: encrypt(refreshed.accessToken),
            tokenExpiresAt: refreshed.expiresAt,
            status: 'active',
            lastSyncError: null,
          },
        });
      } catch (refreshError) {
        console.error("Failed to refresh token:", refreshError);
        await prisma.googleAdsConnection.update({
          where: { id: account.connection.id },
          data: {
            status: 'expired',
            lastSyncError: refreshError instanceof Error ? refreshError.message : 'Token refresh failed',
          },
        });
        const cached = returnCachedAds(account, campaignId, "token_refresh_failed");
        if (cached) return cached;
        return NextResponse.json(
          { error: "Failed to refresh OAuth token", needsReauth: true },
          { status: 401 }
        );
      }
    }

    // Fetch live data
    try {
      const ads = await fetchAds(accessToken, customerId, { campaignId });

      // Update cache with fresh data (store ALL ads, not just filtered)
      if (!campaignId) {
        try {
          await prisma.adAccount.update({
            where: { id: accountId },
            data: {
              cachedAds: JSON.stringify(ads),
              adsCachedAt: new Date(),
            },
          });
        } catch (cacheError) {
          console.error("[API/ads] Failed to update cache:", cacheError);
        }
      }

      return NextResponse.json({
        ads,
        syncedAt: new Date().toISOString(),
        fromCache: false,
      });
    } catch (fetchError) {
      console.error("Error fetching ads:", fetchError);
      const cached = returnCachedAds(account, campaignId, "api_fetch_failed");
      if (cached) return cached;
      throw fetchError;
    }
  } catch (error) {
    console.error("Error fetching ads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch ads" },
      { status: 500 }
    );
  }
}
