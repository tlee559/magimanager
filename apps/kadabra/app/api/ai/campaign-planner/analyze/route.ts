import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { generateCampaignPlan } from "@/lib/campaign-planner-agent";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();

    const {
      productUrl,
      productDescription,
      targetAudience,
      monthlyBudget,
      goals,
      documents,
      name,
      // v2 Enhancement fields
      competitorUrl,
      industry,
    } = body;

    // Validate input - need at least URL or description
    if (!productUrl && !productDescription) {
      return NextResponse.json(
        { error: "Product URL or description is required" },
        { status: 400 }
      );
    }

    // Create the campaign plan record
    const plan = await prisma.campaignPlan.create({
      data: {
        userId,
        name: name || `Campaign Plan - ${new Date().toLocaleDateString()}`,
        status: "PROCESSING",
        productUrl,
        productDescription,
        targetAudience,
        monthlyBudget: monthlyBudget ? parseFloat(monthlyBudget) : null,
        goals,
        documents,
        // v2 Enhancement fields
        competitorUrl,
        industry,
        processingStartedAt: new Date(),
      },
    });

    // Generate the campaign plan asynchronously
    // Don't await - let it process in background
    generateCampaignPlan(plan.id, {
      productUrl,
      productDescription,
      targetAudience,
      monthlyBudget,
      goals,
      documents,
      // v2 Enhancement fields
      competitorUrl,
      industry,
    }).catch((error) => {
      console.error(`[Campaign Planner] Error generating plan ${plan.id}:`, error);
      // Update plan status to failed
      prisma.campaignPlan.update({
        where: { id: plan.id },
        data: {
          status: "FAILED",
          processingError: error instanceof Error ? error.message : "Unknown error",
        },
      }).catch(console.error);
    });

    return NextResponse.json({
      planId: plan.id,
      status: "processing",
      message: "Campaign plan generation started",
    });
  } catch (error) {
    console.error("[Campaign Planner] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create campaign plan" },
      { status: 500 }
    );
  }
}
