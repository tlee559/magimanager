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
    const accountId = searchParams.get("accountId");
    const status = searchParams.get("status");

    // Build query
    const where: Record<string, unknown> = {};

    if (accountId) {
      where.accountIds = { has: accountId };
    }

    if (status) {
      where.status = status;
    }

    const rules = await prisma.automationRule.findMany({
      where,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error fetching automation rules:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature flag
    if (!isFeatureEnabled("automation.create")) {
      return NextResponse.json({ error: "Rule creation is disabled" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      status = "PAUSED",
      priority = 50,
      scope,
      accountIds = [],
      campaignIds = [],
      adGroupIds = [],
      trigger,
      conditions,
      actions,
      maxExecutionsPerDay,
      cooldownMinutes,
    } = body;

    // Validate required fields
    if (!name || !scope || !trigger || !conditions || !actions) {
      return NextResponse.json(
        { error: "Missing required fields: name, scope, trigger, conditions, actions" },
        { status: 400 }
      );
    }

    // Determine if rule requires write access
    const parsedActions = typeof actions === "string" ? JSON.parse(actions) : actions;
    const requiresWriteAccess = parsedActions.some(
      (action: { requiresWriteAccess?: boolean }) => action.requiresWriteAccess
    );

    const rule = await prisma.automationRule.create({
      data: {
        name,
        description,
        status,
        priority,
        scope,
        accountIds,
        campaignIds,
        adGroupIds,
        trigger: typeof trigger === "string" ? trigger : JSON.stringify(trigger),
        conditions: typeof conditions === "string" ? conditions : JSON.stringify(conditions),
        actions: typeof actions === "string" ? actions : JSON.stringify(actions),
        maxExecutionsPerDay,
        cooldownMinutes,
        requiresWriteAccess,
        createdBy: (session.user as { id: string }).id,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Error creating automation rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create rule" },
      { status: 500 }
    );
  }
}
