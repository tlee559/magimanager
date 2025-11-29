import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  sendMessage,
  formatDailyReport,
  formatAlertsReport,
  type AccountData,
  type AlertData,
} from "@magimanager/core";

// Verify the request is from Vercel Cron
function isValidCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");

  // Vercel Cron sends a secret in the Authorization header
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // Also allow internal calls with bot token
  if (authHeader === `Bearer ${process.env.TELEGRAM_BOT_TOKEN}`) {
    return true;
  }

  return false;
}

// GET /api/cron/daily-report - Called by Vercel Cron at 9 AM PT daily
export async function GET(request: NextRequest) {
  // Verify it's a valid cron request
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

    // Fetch account data
    const accounts = await fetchAccounts();
    const alerts = await fetchAlerts();

    // Send morning report
    const reportMessage = formatDailyReport(accounts);
    const reportSent = await sendMessage(reportMessage, chatId);

    // If there are critical alerts, send them too
    const criticalAlerts = alerts.filter(a => a.alertPriority === "critical");
    let alertsSent = true;

    if (criticalAlerts.length > 0) {
      const alertsMessage = formatAlertsReport(alerts);
      alertsSent = await sendMessage(alertsMessage, chatId);
    }

    return NextResponse.json({
      success: true,
      reportSent,
      alertsSent,
      accountCount: accounts.length,
      alertCount: alerts.length,
      criticalCount: criticalAlerts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily report cron error:", error);
    return NextResponse.json(
      { error: "Failed to send daily report" },
      { status: 500 }
    );
  }
}

// Fetch accounts from database
async function fetchAccounts(): Promise<AccountData[]> {
  const accounts = await prisma.adAccount.findMany({
    where: {
      handoffStatus: { not: "archived" },
    },
    include: {
      identityProfile: {
        select: {
          fullName: true,
          geo: true,
        },
      },
      mediaBuyer: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { currentSpendTotal: "desc" },
  });

  return accounts.map((a) => ({
    id: a.id,
    internalId: a.internalId,
    googleCid: a.googleCid,
    origin: a.origin,
    status: a.status,
    accountHealth: a.accountHealth,
    billingStatus: a.billingStatus,
    certStatus: a.certStatus,
    handoffStatus: a.handoffStatus,
    currentSpendTotal: a.currentSpendTotal,
    warmupTargetSpend: a.warmupTargetSpend,
    adsCount: a.adsCount,
    campaignsCount: a.campaignsCount,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    handoffDate: a.handoffDate?.toISOString() || null,
    identityProfile: a.identityProfile
      ? {
          fullName: a.identityProfile.fullName,
          geo: a.identityProfile.geo,
        }
      : null,
    mediaBuyer: a.mediaBuyer
      ? {
          name: a.mediaBuyer.name,
        }
      : null,
  }));
}

// Fetch accounts needing attention as alerts
async function fetchAlerts(): Promise<AlertData[]> {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const accounts = await prisma.adAccount.findMany({
    where: {
      handoffStatus: { not: "archived" },
      OR: [
        { accountHealth: { in: ["suspended", "banned", "limited"] } },
        { billingStatus: { in: ["pending", "failed"] } },
        { certStatus: { in: ["pending", "errored"] } },
      ],
    },
    include: {
      identityProfile: {
        select: {
          fullName: true,
          geo: true,
        },
      },
      checkIns: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return accounts.map((a) => {
    let alertPriority: "critical" | "warning" | "info" = "info";
    let alertReason = "";

    if (a.accountHealth === "banned") {
      alertPriority = "critical";
      alertReason = "Account BANNED";
    } else if (a.accountHealth === "suspended") {
      alertPriority = "critical";
      alertReason = "Account SUSPENDED";
    } else if (a.billingStatus === "failed") {
      alertPriority = "critical";
      alertReason = "Billing FAILED";
    } else if (a.accountHealth === "limited") {
      alertPriority = "warning";
      alertReason = "Account limited";
    } else if (a.billingStatus === "pending") {
      alertPriority = "warning";
      alertReason = "Billing pending";
    } else if (a.certStatus === "errored") {
      alertPriority = "warning";
      alertReason = "Cert errored";
    } else if (a.certStatus === "pending") {
      alertPriority = "info";
      alertReason = "Cert pending";
    }

    const lastCheckIn = a.checkIns[0];
    const daysSinceCheckIn = lastCheckIn
      ? Math.floor(
          (Date.now() - new Date(lastCheckIn.checkedAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    return {
      id: a.id,
      googleCid: a.googleCid,
      accountHealth: a.accountHealth,
      billingStatus: a.billingStatus,
      certStatus: a.certStatus,
      alertPriority,
      alertReason,
      daysSinceCheckIn,
      identityProfile: a.identityProfile
        ? {
            fullName: a.identityProfile.fullName,
            geo: a.identityProfile.geo,
          }
        : null,
    };
  });
}
