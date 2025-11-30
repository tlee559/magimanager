import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMessage } from "@magimanager/core";
import { isValidCronRequest } from "@magimanager/auth";

// GET /api/cron/checkin-reminder - Called by Vercel Cron at 3 PM PT daily
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronRequest(authHeader)) {
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

    // Find accounts that haven't been checked in for 24+ hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Get all non-archived accounts with their latest check-in
    const accounts = await prisma.adAccount.findMany({
      where: {
        handoffStatus: { not: "archived" },
        accountHealth: { not: "banned" }, // Don't remind about banned accounts
      },
      include: {
        identityProfile: {
          select: {
            fullName: true,
          },
        },
        checkIns: {
          orderBy: { checkedAt: "desc" },
          take: 1,
        },
      },
    });

    // Filter accounts needing check-in
    const needsCheckIn = accounts.filter((account) => {
      const lastCheckIn = account.checkIns[0];
      if (!lastCheckIn) return true; // Never checked in
      return new Date(lastCheckIn.checkedAt) < twentyFourHoursAgo;
    });

    const overdue = accounts.filter((account) => {
      const lastCheckIn = account.checkIns[0];
      if (!lastCheckIn) return true; // Never checked in
      return new Date(lastCheckIn.checkedAt) < fortyEightHoursAgo;
    });

    if (needsCheckIn.length === 0) {
      // All accounts checked in - no reminder needed
      return NextResponse.json({
        success: true,
        reminderSent: false,
        message: "All accounts have been checked in recently",
      });
    }

    // Build reminder message
    let message = `\u23f0 *Check-in Reminder*\n\n`;

    if (overdue.length > 0) {
      message += `*\u26a0\ufe0f Overdue (48h+):*\n`;
      overdue.forEach((a) => {
        const name = a.identityProfile?.fullName || a.googleCid || "Unknown";
        const lastCheckIn = a.checkIns[0];
        const daysSince = lastCheckIn
          ? Math.floor(
              (Date.now() - new Date(lastCheckIn.checkedAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;
        message += `\u2022 ${name}${daysSince ? ` (${daysSince}d ago)` : " (never)"}\n`;
      });
      message += "\n";
    }

    const needsButNotOverdue = needsCheckIn.filter(
      (a) => !overdue.some((o) => o.id === a.id)
    );

    if (needsButNotOverdue.length > 0) {
      message += `*\ud83d\udcdd Needs Check-in (24h+):*\n`;
      needsButNotOverdue.forEach((a) => {
        const name = a.identityProfile?.fullName || a.googleCid || "Unknown";
        message += `\u2022 ${name}\n`;
      });
    }

    message += `\n_${needsCheckIn.length} account${needsCheckIn.length > 1 ? "s" : ""} need attention_`;

    // Send the reminder
    const sent = await sendMessage(message, chatId);

    return NextResponse.json({
      success: true,
      reminderSent: sent,
      needsCheckInCount: needsCheckIn.length,
      overdueCount: overdue.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Check-in reminder cron error:", error);
    return NextResponse.json(
      { error: "Failed to send check-in reminder" },
      { status: 500 }
    );
  }
}
