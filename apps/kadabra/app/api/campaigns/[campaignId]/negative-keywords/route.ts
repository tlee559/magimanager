import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import {
  addCampaignNegativeKeywords,
  refreshAccessTokenWithRetry,
  decryptToken,
  encryptToken,
} from "@magimanager/core";
import { isFeatureEnabled } from "@magimanager/shared";

/**
 * POST /api/campaigns/[campaignId]/negative-keywords
 *
 * Add negative keywords to a campaign
 * Requires: keywords.add feature flag
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isFeatureEnabled("keywords.add")) {
      return NextResponse.json(
        { error: "Adding keywords is not enabled" },
        { status: 403 }
      );
    }

    const { campaignId } = await params;
    const body = await req.json();
    const { accountId, customerId, keywords } = body;

    if (!accountId || !customerId) {
      return NextResponse.json(
        { error: "accountId and customerId are required" },
        { status: 400 }
      );
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "keywords array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate keywords format
    for (const kw of keywords) {
      if (!kw.text || typeof kw.text !== "string") {
        return NextResponse.json(
          { error: "Each keyword must have a text property" },
          { status: 400 }
        );
      }
      if (kw.matchType && !["EXACT", "PHRASE", "BROAD"].includes(kw.matchType)) {
        return NextResponse.json(
          { error: "matchType must be 'EXACT', 'PHRASE', or 'BROAD'" },
          { status: 400 }
        );
      }
    }

    // Default matchType to PHRASE if not specified
    const normalizedKeywords = keywords.map((kw: { text: string; matchType?: string }) => ({
      text: kw.text,
      matchType: (kw.matchType || "PHRASE") as "EXACT" | "PHRASE" | "BROAD",
    }));

    // Get the account and its connection
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

    // Decrypt tokens
    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = decryptToken(account.connection.accessToken);
      refreshToken = decryptToken(account.connection.refreshToken);
    } catch {
      return NextResponse.json(
        { error: "Token decryption failed", needsReauth: true },
        { status: 401 }
      );
    }

    // Check if token needs refresh
    const now = new Date();
    if (account.connection.tokenExpiresAt <= now || account.connection.status === "expired") {
      const refreshResult = await refreshAccessTokenWithRetry(
        refreshToken,
        account.connection.id,
        "kadabra"
      );

      if (!refreshResult.success) {
        return NextResponse.json(
          { error: "Failed to refresh OAuth token", needsReauth: !refreshResult.error?.isRecoverable },
          { status: 401 }
        );
      }

      accessToken = refreshResult.accessToken!;

      const updateData: any = {
        accessToken: encryptToken(refreshResult.accessToken!),
        tokenExpiresAt: refreshResult.expiresAt,
        status: "active",
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

    // Get MCC ID if operating through MCC
    const settings = await prisma.appSettings.findFirst({
      select: { mccCustomerId: true },
    });

    // Execute the mutation
    const results = await addCampaignNegativeKeywords(
      accessToken,
      customerId,
      campaignId,
      normalizedKeywords,
      settings?.mccCustomerId || undefined
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // Log the activity
    await prisma.accountActivity.create({
      data: {
        adAccountId: accountId,
        createdBy: session.user.id,
        action: "NEGATIVE_KEYWORDS_ADDED",
        details: `${successCount} negative keyword(s) added to campaign ${campaignId} by ${session.user.name || session.user.email}`,
      },
    });

    return NextResponse.json({
      success: failCount === 0,
      campaignId,
      added: successCount,
      failed: failCount,
      results: results.map((r, i) => ({
        keyword: normalizedKeywords[i].text,
        matchType: normalizedKeywords[i].matchType,
        success: r.success,
        error: r.error,
        resourceName: r.resourceName,
      })),
    });
  } catch (error) {
    console.error("Error adding negative keywords:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add negative keywords" },
      { status: 500 }
    );
  }
}
