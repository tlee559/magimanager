import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query filters
    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status.toUpperCase();
    }

    // Fetch plans
    const [plans, total] = await Promise.all([
      prisma.campaignPlan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          status: true,
          productUrl: true,
          productDescription: true,
          targetAudience: true,
          goals: true,
          monthlyBudget: true,
          // v2 fields
          industry: true,
          competitorUrl: true,
          processingError: true,
          createdAt: true,
          updatedAt: true,
          // Don't include full plan JSON in list view (it's large)
        },
      }),
      prisma.campaignPlan.count({ where }),
    ]);

    return NextResponse.json({
      plans,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Campaign Planner] Error fetching plans:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
