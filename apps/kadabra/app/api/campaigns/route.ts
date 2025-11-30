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

    if (!account.connection) {
      return NextResponse.json(
        { error: "Account is not connected to Google Ads" },
        { status: 400 }
      );
    }

    // Decrypt and check if token needs refresh
    let accessToken = decrypt(account.connection.accessToken);
    const refreshToken = decrypt(account.connection.refreshToken);
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
        return NextResponse.json(
          { error: "Failed to refresh OAuth token" },
          { status: 401 }
        );
      }
    }

    // Fetch campaigns from Google Ads API
    const campaigns = await fetchCampaigns(accessToken, customerId, {
      includeMetrics: true,
      dateRangeStart,
      dateRangeEnd,
    });

    // Check if account is suspended/inactive and has no campaigns returned
    // but we know it had campaigns before (from cached count)
    const isSuspended = account.accountHealth === "suspended" || account.status === "suspended";
    const hasCachedCampaigns = account.campaignsCount > 0;

    console.log('[API/campaigns] Debug:', {
      accountId,
      campaignsReturned: campaigns.length,
      accountHealth: account.accountHealth,
      accountStatus: account.status,
      campaignsCount: account.campaignsCount,
      isSuspended,
      hasCachedCampaigns,
    });

    return NextResponse.json({
      campaigns,
      syncedAt: new Date().toISOString(),
      // Provide context when suspended account returns no campaigns
      accountSuspended: isSuspended && campaigns.length === 0 && hasCachedCampaigns,
      cachedCampaignCount: hasCachedCampaigns ? account.campaignsCount : undefined,
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
