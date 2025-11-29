import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { fetchKeywords, refreshAccessToken } from "@/lib/google-ads-api";
import { isFeatureEnabled } from "@magimanager/shared";
import { decrypt, encrypt } from "@/lib/encryption";

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

    if (!account.connection) {
      return NextResponse.json(
        { error: "Account is not connected to Google Ads" },
        { status: 400 }
      );
    }

    let accessToken = decrypt(account.connection.accessToken);
    const refreshToken = decrypt(account.connection.refreshToken);
    const now = new Date();

    if (account.connection.tokenExpiresAt <= now) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;

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

    const keywords = await fetchKeywords(accessToken, customerId, {
      campaignId,
      adGroupId,
      dateRange: dateRange as any,
    });

    return NextResponse.json({
      keywords,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching keywords:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch keywords" },
      { status: 500 }
    );
  }
}
