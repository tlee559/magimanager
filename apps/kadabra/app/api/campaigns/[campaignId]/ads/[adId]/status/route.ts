import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import {
  mutateAdStatus,
  refreshAccessTokenWithRetry,
  decryptToken,
  encryptToken,
} from "@magimanager/core";
import { isFeatureEnabled } from "@magimanager/shared";

/**
 * PATCH /api/campaigns/[campaignId]/ads/[adId]/status
 *
 * Update ad status (pause/enable)
 * Requires: ads.pause feature flag
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; adId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isFeatureEnabled("ads.pause")) {
      return NextResponse.json(
        { error: "Ad status updates are not enabled" },
        { status: 403 }
      );
    }

    const { adId } = await params;
    const body = await req.json();
    const { accountId, customerId, adGroupId, status } = body;

    if (!accountId || !customerId || !adGroupId) {
      return NextResponse.json(
        { error: "accountId, customerId, and adGroupId are required" },
        { status: 400 }
      );
    }

    if (!status || !["ENABLED", "PAUSED"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'ENABLED' or 'PAUSED'" },
        { status: 400 }
      );
    }

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
    const result = await mutateAdStatus(
      accessToken,
      customerId,
      adGroupId,
      adId,
      status,
      settings?.mccCustomerId || undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update ad status" },
        { status: 500 }
      );
    }

    // Log the activity
    await prisma.accountActivity.create({
      data: {
        adAccountId: accountId,
        createdBy: session.user.id,
        action: status === "PAUSED" ? "AD_PAUSED" : "AD_ENABLED",
        details: `Ad ${adId} ${status === "PAUSED" ? "paused" : "enabled"} by ${session.user.name || session.user.email}`,
      },
    });

    return NextResponse.json({
      success: true,
      adId,
      status,
      resourceName: result.resourceName,
    });
  } catch (error) {
    console.error("Error updating ad status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update ad status" },
      { status: 500 }
    );
  }
}
