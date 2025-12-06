// Thin route wrapper using shared handlers from @magimanager/core
import { NextRequest, NextResponse } from "next/server";
import { accountCheckInHandler } from "@magimanager/core/api-handlers";
import { prisma } from "@/lib/db";

export const POST = accountCheckInHandler;

// GET /api/accounts/[id]/check-in - Get check-in history for an account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    // Verify account exists
    const account = await prisma.adAccount.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const [checkIns, total] = await Promise.all([
      prisma.accountCheckIn.findMany({
        where: { adAccountId: id },
        orderBy: { checkedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.accountCheckIn.count({
        where: { adAccountId: id },
      }),
    ]);

    return NextResponse.json({
      checkIns,
      total,
      hasMore: offset + checkIns.length < total,
    });
  } catch (error) {
    console.error(`GET /api/accounts/${id}/check-in error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch check-ins" },
      { status: 500 }
    );
  }
}
