import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/accounts/[id]/simulate-warmup - Simulate warmup progression
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the account
    const account = await prisma.adAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Calculate new values (simulate 1 day of warmup)
    const dailySpend = 10 + Math.floor(Math.random() * 20); // $10-30 per day
    const newSpend = Math.min(
      account.currentSpendTotal + dailySpend,
      account.warmupTargetSpend
    );
    const newAdsCount = account.adsCount + Math.floor(1 + Math.random() * 3); // 1-3 new ads

    // Determine new status
    let newStatus = account.status;
    if (account.status === "provisioned") {
      newStatus = "warming-up";
    } else if (
      account.status === "warming-up" &&
      newSpend >= account.warmupTargetSpend
    ) {
      newStatus = "ready";
    }

    // Update the account
    const updatedAccount = await prisma.adAccount.update({
      where: { id },
      data: {
        currentSpendTotal: newSpend,
        adsCount: newAdsCount,
        status: newStatus,
      },
      include: {
        identityProfile: {
          include: {
            gologinProfile: true,
          },
        },
      },
    });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("Failed to simulate warmup:", error);
    return NextResponse.json(
      { error: "Failed to simulate warmup" },
      { status: 500 }
    );
  }
}
