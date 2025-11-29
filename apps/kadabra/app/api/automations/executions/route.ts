import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { isFeatureEnabled } from "@magimanager/shared";

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature flag
    if (!isFeatureEnabled("automation.view")) {
      return NextResponse.json({ error: "Automation viewing is disabled" }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get("ruleId");
    const accountId = searchParams.get("accountId");
    const result = searchParams.get("result");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    const where: Record<string, unknown> = {};

    if (ruleId) {
      where.ruleId = ruleId;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    if (result) {
      where.result = result;
    }

    const [executions, total] = await Promise.all([
      prisma.automationExecution.findMany({
        where,
        orderBy: { triggeredAt: "desc" },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      prisma.automationExecution.count({ where }),
    ]);

    return NextResponse.json({
      executions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching automation executions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch executions" },
      { status: 500 }
    );
  }
}
