import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidCronRequest } from "@magimanager/auth";

// GET /api/cron/daily-snapshot - Capture daily spend snapshots for all accounts
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronRequest(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get today's date (midnight UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get yesterday's date for calculating daily spend delta
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Fetch all non-archived accounts
    const accounts = await prisma.adAccount.findMany({
      where: {
        handoffStatus: { not: "archived" },
      },
      select: {
        id: true,
        currentSpendTotal: true,
        adsCount: true,
        campaignsCount: true,
        accountHealth: true,
        billingStatus: true,
      },
    });

    // Fetch yesterday's snapshots for calculating daily spend
    const yesterdaySnapshots = await prisma.dailySpendSnapshot.findMany({
      where: {
        date: yesterday,
      },
      select: {
        adAccountId: true,
        totalSpend: true,
      },
    });

    const yesterdayMap = new Map(
      yesterdaySnapshots.map((s) => [s.adAccountId, Number(s.totalSpend)])
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Create or update snapshots for each account
    for (const account of accounts) {
      const totalSpend = account.currentSpendTotal / 100; // Convert from cents
      const yesterdaySpend = yesterdayMap.get(account.id) || 0;
      const dailySpend = Math.max(0, totalSpend - yesterdaySpend);

      try {
        await prisma.dailySpendSnapshot.upsert({
          where: {
            adAccountId_date: {
              adAccountId: account.id,
              date: today,
            },
          },
          update: {
            dailySpend,
            totalSpend,
            adsCount: account.adsCount,
            campaignsCount: account.campaignsCount,
            accountHealth: account.accountHealth,
            billingStatus: account.billingStatus,
          },
          create: {
            adAccountId: account.id,
            date: today,
            dailySpend,
            totalSpend,
            adsCount: account.adsCount,
            campaignsCount: account.campaignsCount,
            accountHealth: account.accountHealth,
            billingStatus: account.billingStatus,
          },
        });
        created++;
      } catch (err) {
        console.error(`Failed to snapshot account ${account.id}:`, err);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      date: today.toISOString().split("T")[0],
      accountsProcessed: accounts.length,
      snapshotsCreated: created,
      snapshotsSkipped: skipped,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily snapshot cron error:", error);
    return NextResponse.json(
      { error: "Failed to capture daily snapshots" },
      { status: 500 }
    );
  }
}
