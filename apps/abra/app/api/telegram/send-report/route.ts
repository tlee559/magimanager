import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  sendMessage,
  formatDailyReport,
  formatAlertsReport,
  formatSummary,
  AccountData,
  AlertData,
} from "@/lib/telegram-bot";

// API key for securing internal calls (optional, can use same as bot token or separate)
const API_SECRET = process.env.TELEGRAM_BOT_TOKEN;

// POST /api/telegram/send-report - Manually trigger a report to Telegram
export async function POST(request: NextRequest) {
  try {
    // Check authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type = "report", chatId } = body;

    // Use provided chatId or fall back to default
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!targetChatId) {
      return NextResponse.json(
        { error: "No chat ID configured or provided" },
        { status: 400 }
      );
    }

    let message = "";

    switch (type) {
      case "report":
        const accounts = await fetchAccounts();
        message = formatDailyReport(accounts);
        break;

      case "alerts":
        const alerts = await fetchAlerts();
        message = formatAlertsReport(alerts);
        break;

      case "summary":
        const summaryAccounts = await fetchAccounts();
        message = formatSummary(summaryAccounts);
        break;

      case "custom":
        // Allow sending a custom message
        if (!body.message) {
          return NextResponse.json(
            { error: "Custom type requires a message field" },
            { status: 400 }
          );
        }
        message = body.message;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}. Use: report, alerts, summary, or custom` },
          { status: 400 }
        );
    }

    // Send the message
    const success = await sendMessage(message, targetChatId);

    if (success) {
      return NextResponse.json({
        success: true,
        type,
        chatId: targetChatId,
      });
    } else {
      return NextResponse.json(
        { error: "Failed to send message to Telegram" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Send report error:", error);
    return NextResponse.json(
      { error: "Failed to send report" },
      { status: 500 }
    );
  }
}

// Fetch accounts from database
async function fetchAccounts(): Promise<AccountData[]> {
  const accounts = await prisma.adAccount.findMany({
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
  const accounts = await prisma.adAccount.findMany({
    where: {
      handoffStatus: { not: "archived" },
      OR: [
        { accountHealth: { in: ["suspended", "banned", "limited"] } },
        { billingStatus: { in: ["pending", "failed"] } },
        { certStatus: "pending" },
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

    if (a.accountHealth === "suspended" || a.accountHealth === "banned") {
      alertPriority = "critical";
      alertReason = `Account ${a.accountHealth}`;
    } else if (a.billingStatus === "failed") {
      alertPriority = "critical";
      alertReason = "Billing failed";
    } else if (a.accountHealth === "limited") {
      alertPriority = "warning";
      alertReason = "Account limited";
    } else if (a.billingStatus === "pending") {
      alertPriority = "warning";
      alertReason = "Billing pending";
    } else if (a.certStatus === "pending") {
      alertPriority = "info";
      alertReason = "Certification pending";
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

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoints: {
      "POST /api/telegram/send-report": {
        description: "Send a report to Telegram",
        body: {
          type: "report | alerts | summary | custom",
          chatId: "(optional) override default chat ID",
          message: "(required for custom type) custom message text",
        },
        headers: {
          Authorization: "Bearer <TELEGRAM_BOT_TOKEN>",
        },
      },
    },
  });
}
