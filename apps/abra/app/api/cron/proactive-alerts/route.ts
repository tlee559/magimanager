import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram-bot";

// Verify the request is from Vercel Cron
function isValidCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");

  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  if (authHeader === `Bearer ${process.env.TELEGRAM_BOT_TOKEN}`) {
    return true;
  }

  return false;
}

// GET /api/cron/proactive-alerts - Check for new critical issues every 4 hours
export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!chatId) {
      console.error("TELEGRAM_CHAT_ID not configured");
      return NextResponse.json(
        { error: "Chat ID not configured" },
        { status: 500 }
      );
    }

    // Look for critical events in the last 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

    // Find recent critical activity events
    const criticalActivities = await prisma.accountActivity.findMany({
      where: {
        createdAt: { gte: fourHoursAgo },
        action: {
          in: [
            "HEALTH_SUSPENDED",
            "HEALTH_BANNED",
            "BILLING_FAILED",
            "CERT_ERRORED",
            "CERT_SUSPENDED",
          ],
        },
      },
      include: {
        adAccount: {
          include: {
            identityProfile: {
              select: { fullName: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also check for accounts that are critical but haven't been alerted yet
    // (in case the status was set directly without an activity log)
    const criticalAccounts = await prisma.adAccount.findMany({
      where: {
        handoffStatus: { not: "archived" },
        updatedAt: { gte: fourHoursAgo },
        OR: [
          { accountHealth: { in: ["suspended", "banned"] } },
          { billingStatus: "failed" },
        ],
      },
      include: {
        identityProfile: {
          select: { fullName: true },
        },
      },
    });

    // Deduplicate - collect unique account IDs from activities
    const activityAccountIds = new Set(
      criticalActivities.map((a) => a.adAccountId)
    );

    // Find accounts that are critical but weren't in the activity log
    const unreportedAccounts = criticalAccounts.filter(
      (a) => !activityAccountIds.has(a.id)
    );

    // Build alert message
    const alerts: string[] = [];

    // Add activity-based alerts
    for (const activity of criticalActivities) {
      const accountName =
        activity.adAccount?.identityProfile?.fullName ||
        activity.adAccount?.googleCid ||
        "Unknown";
      const internalId = activity.adAccount
        ? `MM${String(activity.adAccount.internalId).padStart(3, "0")}`
        : "";

      let emoji = "⚠️";
      if (activity.action.includes("BANNED")) emoji = "🚫";
      else if (activity.action.includes("SUSPENDED")) emoji = "🔴";
      else if (activity.action.includes("FAILED")) emoji = "💳";

      alerts.push(
        `${emoji} *${internalId} ${accountName}*\n   ${activity.details || activity.action}`
      );
    }

    // Add unreported critical accounts
    for (const account of unreportedAccounts) {
      const accountName =
        account.identityProfile?.fullName || account.googleCid || "Unknown";
      const internalId = `MM${String(account.internalId).padStart(3, "0")}`;

      let emoji = "⚠️";
      let reason = "";

      if (account.accountHealth === "banned") {
        emoji = "🚫";
        reason = "Account BANNED";
      } else if (account.accountHealth === "suspended") {
        emoji = "🔴";
        reason = "Account SUSPENDED";
      } else if (account.billingStatus === "failed") {
        emoji = "💳";
        reason = "Billing FAILED";
      }

      alerts.push(`${emoji} *${internalId} ${accountName}*\n   ${reason}`);
    }

    // Only send if there are alerts
    if (alerts.length > 0) {
      const message = `🚨 *CRITICAL ALERTS* (Last 4 hours)\n\n${alerts.join("\n\n")}\n\n_Use /alerts for full details_`;
      await sendMessage(message, chatId);

      return NextResponse.json({
        success: true,
        alertsSent: true,
        alertCount: alerts.length,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      alertsSent: false,
      alertCount: 0,
      message: "No critical alerts in the last 4 hours",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Proactive alerts cron error:", error);
    return NextResponse.json(
      { error: "Failed to check proactive alerts" },
      { status: 500 }
    );
  }
}
