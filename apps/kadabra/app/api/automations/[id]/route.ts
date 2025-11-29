import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { isFeatureEnabled } from "@magimanager/shared";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isFeatureEnabled("automation.view")) {
      return NextResponse.json({ error: "Automation viewing is disabled" }, { status: 403 });
    }

    const { id } = await params;

    const rule = await prisma.automationRule.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { triggeredAt: "desc" },
          take: 10,
        },
      },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Error fetching automation rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch rule" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isFeatureEnabled("automation.edit")) {
      return NextResponse.json({ error: "Rule editing is disabled" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Validate rule exists
    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.scope !== undefined) updateData.scope = body.scope;
    if (body.accountIds !== undefined) updateData.accountIds = body.accountIds;
    if (body.campaignIds !== undefined) updateData.campaignIds = body.campaignIds;
    if (body.adGroupIds !== undefined) updateData.adGroupIds = body.adGroupIds;
    if (body.trigger !== undefined) {
      updateData.trigger = typeof body.trigger === "string" ? body.trigger : JSON.stringify(body.trigger);
    }
    if (body.conditions !== undefined) {
      updateData.conditions = typeof body.conditions === "string" ? body.conditions : JSON.stringify(body.conditions);
    }
    if (body.actions !== undefined) {
      updateData.actions = typeof body.actions === "string" ? body.actions : JSON.stringify(body.actions);
      // Recalculate requiresWriteAccess
      const parsedActions = typeof body.actions === "string" ? JSON.parse(body.actions) : body.actions;
      updateData.requiresWriteAccess = parsedActions.some(
        (action: { requiresWriteAccess?: boolean }) => action.requiresWriteAccess
      );
    }
    if (body.maxExecutionsPerDay !== undefined) updateData.maxExecutionsPerDay = body.maxExecutionsPerDay;
    if (body.cooldownMinutes !== undefined) updateData.cooldownMinutes = body.cooldownMinutes;

    const rule = await prisma.automationRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Error updating automation rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isFeatureEnabled("automation.edit")) {
      return NextResponse.json({ error: "Rule deletion is disabled" }, { status: 403 });
    }

    const { id } = await params;

    // Validate rule exists
    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.automationRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting automation rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete rule" },
      { status: 500 }
    );
  }
}
