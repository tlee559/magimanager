import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/debug/report-test - Test report queries step by step
export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
  };
  const overallStart = Date.now();

  // Test 1: get_account_stats query
  try {
    const start = Date.now();
    const accounts = await prisma.adAccount.findMany({
      where: { handoffStatus: { not: "archived" } },
    });
    results.statsQuery = {
      success: true,
      count: accounts.length,
      duration: `${Date.now() - start}ms`,
    };
  } catch (error) {
    results.statsQuery = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown",
      duration: `${Date.now() - overallStart}ms`,
    };
  }

  // Test 2: get_accounts_needing_attention query
  try {
    const start = Date.now();
    const accounts = await prisma.adAccount.findMany({
      where: {
        OR: [
          { accountHealth: { in: ["suspended", "banned", "limited"] } },
          { billingStatus: { in: ["pending", "failed"] } },
          { certStatus: "pending" },
        ],
      },
      include: {
        identityProfile: { select: { fullName: true } },
        checkIns: { orderBy: { checkedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    results.alertsQuery = {
      success: true,
      count: accounts.length,
      duration: `${Date.now() - start}ms`,
    };
  } catch (error) {
    results.alertsQuery = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown",
      duration: `${Date.now() - overallStart}ms`,
    };
  }

  // Test 3: get_top_performers query
  try {
    const start = Date.now();
    const accounts = await prisma.adAccount.findMany({
      where: {
        accountHealth: "active",
        handoffStatus: { not: "archived" },
      },
      include: {
        identityProfile: { select: { fullName: true } },
      },
      orderBy: { currentSpendTotal: "desc" },
      take: 5,
    });
    results.topPerformersQuery = {
      success: true,
      count: accounts.length,
      duration: `${Date.now() - start}ms`,
    };
  } catch (error) {
    results.topPerformersQuery = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown",
      duration: `${Date.now() - overallStart}ms`,
    };
  }

  results.totalDuration = `${Date.now() - overallStart}ms`;

  return NextResponse.json(results);
}
