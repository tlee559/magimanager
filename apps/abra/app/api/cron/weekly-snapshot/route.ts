import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

// Get the Monday of the current week
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// GET /api/cron/weekly-snapshot - Capture weekly stats snapshot
export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Previous week for comparison
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    // Fetch all accounts
    const accounts = await prisma.adAccount.findMany({
      select: {
        accountHealth: true,
        handoffStatus: true,
        currentSpendTotal: true,
        adsCount: true,
        createdAt: true,
        handoffDate: true,
      },
    });

    // Fetch identities
    const identities = await prisma.identityProfile.findMany({
      select: {
        createdAt: true,
      },
    });

    // Fetch check-ins this week
    const checkInsThisWeek = await prisma.accountCheckIn.count({
      where: {
        checkedAt: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    });

    // Get previous week's snapshot for delta calculation
    const prevSnapshot = await prisma.weeklyStatsSnapshot.findUnique({
      where: { weekStart: prevWeekStart },
    });

    // Calculate stats
    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter((a) => a.accountHealth === "active").length;
    const suspendedAccounts = accounts.filter((a) => a.accountHealth === "suspended").length;
    const bannedAccounts = accounts.filter((a) => a.accountHealth === "banned").length;
    const limitedAccounts = accounts.filter((a) => a.accountHealth === "limited").length;
    const archivedAccounts = accounts.filter((a) => a.handoffStatus === "archived").length;

    const totalSpend = accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0);
    const totalAds = accounts.reduce((sum, a) => sum + a.adsCount, 0);

    const accountsCreated = accounts.filter(
      (a) => a.createdAt >= weekStart && a.createdAt < weekEnd
    ).length;

    const accountsHandedOff = accounts.filter(
      (a) => a.handoffDate && a.handoffDate >= weekStart && a.handoffDate < weekEnd
    ).length;

    const totalIdentities = identities.length;
    const identitiesCreated = identities.filter(
      (i) => i.createdAt >= weekStart && i.createdAt < weekEnd
    ).length;

    const weeklySpendDelta = prevSnapshot ? totalSpend - prevSnapshot.totalSpend : 0;

    // Create or update the weekly snapshot
    const snapshot = await prisma.weeklyStatsSnapshot.upsert({
      where: { weekStart },
      update: {
        totalAccounts,
        activeAccounts,
        suspendedAccounts,
        bannedAccounts,
        limitedAccounts,
        archivedAccounts,
        totalSpend,
        weeklySpendDelta,
        totalAds,
        accountsCreated,
        accountsHandedOff,
        checkInsCount: checkInsThisWeek,
        totalIdentities,
        identitiesCreated,
      },
      create: {
        weekStart,
        totalAccounts,
        activeAccounts,
        suspendedAccounts,
        bannedAccounts,
        limitedAccounts,
        archivedAccounts,
        totalSpend,
        weeklySpendDelta,
        totalAds,
        accountsCreated,
        accountsHandedOff,
        checkInsCount: checkInsThisWeek,
        totalIdentities,
        identitiesCreated,
      },
    });

    return NextResponse.json({
      success: true,
      weekStart: weekStart.toISOString().split("T")[0],
      snapshot: {
        totalAccounts,
        activeAccounts,
        totalSpend: totalSpend / 100, // Convert to dollars for display
        weeklySpendDelta: weeklySpendDelta / 100,
        accountsCreated,
        identitiesCreated,
        checkInsCount: checkInsThisWeek,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Weekly snapshot cron error:", error);
    return NextResponse.json(
      { error: "Failed to capture weekly snapshot" },
      { status: 500 }
    );
  }
}
