import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";

type RouteParams = { params: Promise<{ planId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { planId } = await params;

    // Fetch plan
    const plan = await prisma.campaignPlan.findFirst({
      where: {
        id: planId,
        userId, // Ensure user owns this plan
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("[Campaign Planner] Error fetching plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { planId } = await params;
    const body = await req.json();

    // Verify ownership
    const existingPlan = await prisma.campaignPlan.findFirst({
      where: { id: planId, userId },
    });

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Update plan
    const { name, status } = body;
    const updateData: Record<string, unknown> = {};

    if (name) updateData.name = name;
    if (status && ["DRAFT", "ARCHIVED"].includes(status)) {
      updateData.status = status;
    }

    const updatedPlan = await prisma.campaignPlan.update({
      where: { id: planId },
      data: updateData,
    });

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    console.error("[Campaign Planner] Error updating plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update plan" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { planId } = await params;

    // Verify ownership
    const existingPlan = await prisma.campaignPlan.findFirst({
      where: { id: planId, userId },
    });

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Delete plan
    await prisma.campaignPlan.delete({
      where: { id: planId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Campaign Planner] Error deleting plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete plan" },
      { status: 500 }
    );
  }
}
