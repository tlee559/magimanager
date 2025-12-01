import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { fetchCampaigns, refreshAccessToken } from "../../../lib/google-ads-api";
import { isFeatureEnabled } from "@magimanager/shared";
import { decrypt, encrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature flag
    if (!isFeatureEnabled("campaigns.view")) {
      return NextResponse.json({ error: "Campaign viewing is disabled" }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const customerId = searchParams.get("customerId");
    const dateRangeParam = searchParams.get("dateRange") || "LAST_7_DAYS";

    // Convert date range enum to actual dates
    function getDateRange(range: string): { start: string; end: string } {
      const today = new Date();
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      switch (range) {
        case "TODAY":
          return { start: formatDate(today), end: formatDate(today) };
        case "YESTERDAY": {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return { start: formatDate(yesterday), end: formatDate(yesterday) };
        }
        case "LAST_7_DAYS": {
          const start = new Date(today);
          start.setDate(start.getDate() - 6);
          return { start: formatDate(start), end: formatDate(today) };
        }
        case "LAST_14_DAYS": {
          const start = new Date(today);
          start.setDate(start.getDate() - 13);
          return { start: formatDate(start), end: formatDate(today) };
        }
        case "LAST_30_DAYS": {
          const start = new Date(today);
          start.setDate(start.getDate() - 29);
          return { start: formatDate(start), end: formatDate(today) };
        }
        default: {
          const start = new Date(today);
          start.setDate(start.getDate() - 6);
          return { start: formatDate(start), end: formatDate(today) };
        }
      }
    }

    const { start: dateRangeStart, end: dateRangeEnd } = getDateRange(dateRangeParam);

    if (!accountId || !customerId) {
      return NextResponse.json(
        { error: "accountId and customerId are required" },
        { status: 400 }
      );
    }

    // Get the account and its connection
    const account = await prisma.adAccount.findUnique({
      where: { id: accountId },
      include: {
        connection: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Helper to return cached campaigns (account is guaranteed to exist at this point)
    function returnCachedCampaigns(reason: string) {
      const acc = account!; // TypeScript narrowing
      if (acc.cachedCampaigns && acc.campaignsCachedAt) {
        try {
          const campaigns = JSON.parse(acc.cachedCampaigns);
          const cacheAge = Date.now() - new Date(acc.campaignsCachedAt).getTime();
          console.log(`[API/campaigns] Returning cached data (${reason}): ${campaigns.length} campaigns, cached ${Math.round(cacheAge / 60000)} min ago`);
          return NextResponse.json({
            campaigns,
            syncedAt: acc.campaignsCachedAt,
            fromCache: true,
            cacheAge,
            cacheReason: reason,
            accountSuspended: acc.accountHealth === "suspended",
          });
        } catch (parseError) {
          console.error("[API/campaigns] Failed to parse cached campaigns:", parseError);
        }
      }
      return null;
    }

    // No connection - try to return cached data
    if (!account.connection) {
      const cached = returnCachedCampaigns("no_connection");
      if (cached) return cached;
      return NextResponse.json(
        { error: "Account is not connected to Google Ads" },
        { status: 400 }
      );
    }

    // Decrypt and check if token needs refresh
    let accessToken: string;
    let refreshToken: string;

    try {
      accessToken = decrypt(account.connection.accessToken);
      refreshToken = decrypt(account.connection.refreshToken);
    } catch (decryptError) {
      console.error("Failed to decrypt tokens:", decryptError);
      const cached = returnCachedCampaigns("token_decrypt_failed");
      if (cached) return cached;
      return NextResponse.json(
        {
          error: "Token decryption failed - encryption key mismatch between apps. Please re-authenticate this account.",
          needsReauth: true,
        },
        { status: 401 }
      );
    }

    const now = new Date();

    if (account.connection.tokenExpiresAt <= now) {
      // Refresh the token
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;

        // Update the connection with new encrypted token
        await prisma.googleAdsConnection.update({
          where: { id: account.connection.id },
          data: {
            accessToken: encrypt(refreshed.accessToken),
            tokenExpiresAt: refreshed.expiresAt,
          },
        });
      } catch (refreshError) {
        console.error("Failed to refresh token:", refreshError);
        const cached = returnCachedCampaigns("token_refresh_failed");
        if (cached) return cached;
        return NextResponse.json(
          { error: "Failed to refresh OAuth token", needsReauth: true },
          { status: 401 }
        );
      }
    }

    // Fetch campaigns from Google Ads API
    // Wrap in try-catch to handle suspended/disabled accounts gracefully
    let campaigns: Awaited<ReturnType<typeof fetchCampaigns>> = [];
    let apiError: string | null = null;

    try {
      campaigns = await fetchCampaigns(accessToken, customerId, {
        includeMetrics: true,
        dateRangeStart,
        dateRangeEnd,
      });

      // Update cache with fresh data
      try {
        await prisma.adAccount.update({
          where: { id: accountId },
          data: {
            cachedCampaigns: JSON.stringify(campaigns),
            campaignsCachedAt: new Date(),
          },
        });
      } catch (cacheUpdateError) {
        console.error("[API/campaigns] Failed to update cache:", cacheUpdateError);
      }
    } catch (fetchError) {
      // If the account is suspended/disabled, Google Ads API will throw an error
      // We catch it here and try to return cached data
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.log('[API/campaigns] Fetch error:', errorMessage);
      apiError = errorMessage;

      // Try to return cached data on fetch error
      const cached = returnCachedCampaigns("api_fetch_failed");
      if (cached) return cached;
    }

    // Check if account is suspended/inactive
    const hasCachedCampaigns = account.campaignsCount > 0;
    // Account is suspended if: explicitly marked, OR API returned "not enabled" error
    const isSuspendedByApi = apiError?.includes('not enabled') || apiError?.includes('CUSTOMER_NOT_ENABLED');
    const isSuspendedByStatus = account.accountHealth === "suspended" || account.status === "suspended";
    const isSuspended = isSuspendedByStatus || isSuspendedByApi;

    return NextResponse.json({
      campaigns,
      syncedAt: new Date().toISOString(),
      fromCache: false,
      // Provide context when suspended account returns no campaigns
      accountSuspended: isSuspended && campaigns.length === 0 && hasCachedCampaigns,
      cachedCampaignCount: hasCachedCampaigns ? account.campaignsCount : undefined,
      apiError: apiError || undefined,
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
