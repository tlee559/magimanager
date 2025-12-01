import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { put } from "@vercel/blob";
import { generateAdCreatives } from "@/lib/ads-image-creator-agent";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for image generation

// POST /api/ai/ads-image-creator/projects/[projectId]/generate - Start image generation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { projectId } = await params;

    // Fetch the project
    const project = await prisma.adImageProject.findFirst({
      where: { id: projectId, userId },
      include: {
        campaignPlan: {
          select: {
            productDescription: true,
            targetAudience: true,
            plan: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Don't re-process if already completed
    if (project.status === "COMPLETED") {
      return NextResponse.json({
        error: "Project already completed. Create a new project to generate more images."
      }, { status: 400 });
    }

    // Update status to generating
    await prisma.adImageProject.update({
      where: { id: projectId },
      data: {
        status: "GENERATING",
        progress: 10,
        startedAt: new Date(),
        processingError: null,
      },
    });

    // Start async generation
    generateImagesAsync(projectId, project, userId).catch((err) => {
      console.error("[Ads Image Creator] Background generation error:", err);
    });

    return NextResponse.json({
      message: "Generation started",
      projectId,
      status: "GENERATING",
    });
  } catch (error) {
    console.error("[Ads Image Creator] Error starting generation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start generation" },
      { status: 500 }
    );
  }
}

// Async image generation process
async function generateImagesAsync(
  projectId: string,
  project: {
    productDescription: string | null;
    productUrl: string | null;
    productImageUrl: string | null;
    logoUrl: string | null;
    headlines: string[];
    ctaText: string | null;
    referenceImageUrl: string | null;
    referenceAnalysis: unknown;
    competitorDomain: string | null;
    competitorAnalysis: unknown;
    goal: string | null;
    marketingAngles: string[];
    templateId: string | null;
    targetFormats: string[];
    variationCount: number;
    colorScheme: unknown;
    fontPreferences: unknown;
    campaignPlan: {
      productDescription: string | null;
      targetAudience: string | null;
      plan: unknown;
    } | null;
  },
  userId: string
) {
  const LOG_PREFIX = `[AdsImageCreator:${projectId.slice(0, 8)}]`;

  console.log(`${LOG_PREFIX} ========== STARTING GENERATION ==========`);

  try {
    // Build context from project and campaign plan
    const productDescription = project.productDescription ||
      project.campaignPlan?.productDescription ||
      "Product";

    const targetAudience = project.campaignPlan?.targetAudience || null;

    // Extract plan data if available
    let planData: { uniqueSellingPoints?: string[]; headlines?: string[] } | null = null;
    if (project.campaignPlan?.plan && typeof project.campaignPlan.plan === 'object') {
      planData = project.campaignPlan.plan as { uniqueSellingPoints?: string[]; headlines?: string[] };
    }

    // Use headlines from project or extract from plan
    const headlines = project.headlines.length > 0
      ? project.headlines
      : (planData?.headlines || ["Discover the difference"]);

    // Determine marketing angles
    const angles = project.marketingAngles.length > 0
      ? project.marketingAngles
      : ["benefit_focused"]; // Default angle

    console.log(`${LOG_PREFIX} Product: ${productDescription.substring(0, 100)}...`);
    console.log(`${LOG_PREFIX} Headlines: ${headlines.join(", ")}`);
    console.log(`${LOG_PREFIX} Angles: ${angles.join(", ")}`);
    console.log(`${LOG_PREFIX} Variations: ${project.variationCount}`);

    // Update progress
    await prisma.adImageProject.update({
      where: { id: projectId },
      data: { progress: 20 },
    });

    // Generate ad creatives using the AI agent
    const creatives = await generateAdCreatives({
      productDescription,
      productUrl: project.productUrl,
      productImageUrl: project.productImageUrl,
      logoUrl: project.logoUrl,
      headlines,
      ctaText: project.ctaText,
      targetAudience,
      goal: project.goal || "ctr",
      angles,
      referenceAnalysis: project.referenceAnalysis as Record<string, unknown> | null,
      competitorAnalysis: project.competitorAnalysis as Record<string, unknown> | null,
      variationCount: project.variationCount,
      colorScheme: project.colorScheme as Record<string, string> | null,
    });

    console.log(`${LOG_PREFIX} Generated ${creatives.length} creative specs`);

    // Update progress
    await prisma.adImageProject.update({
      where: { id: projectId },
      data: { progress: 50 },
    });

    // Create image records
    const createdImages = [];
    for (let i = 0; i < creatives.length; i++) {
      const creative = creatives[i];

      console.log(`${LOG_PREFIX} Processing creative ${i + 1}/${creatives.length}`);

      // Create image record
      const image = await prisma.adImage.create({
        data: {
          projectId,
          backgroundPrompt: creative.backgroundPrompt,
          headlineUsed: creative.headline,
          ctaUsed: creative.cta,
          angleUsed: creative.angle,
          templateUsed: project.templateId,
          compositeUrl: creative.imageUrl, // For now, just the generated image
          backgroundUrl: creative.imageUrl,
          creativeRationale: creative.rationale,
          hookScore: creative.scores?.hook || null,
          clarityScore: creative.scores?.clarity || null,
          ctaScore: creative.scores?.cta || null,
          overallScore: creative.scores?.overall || null,
        },
      });

      createdImages.push(image);

      // Update progress
      const progressPercent = 50 + Math.floor((i + 1) / creatives.length * 45);
      await prisma.adImageProject.update({
        where: { id: projectId },
        data: { progress: progressPercent },
      });
    }

    // Mark as completed
    await prisma.adImageProject.update({
      where: { id: projectId },
      data: {
        status: "COMPLETED",
        progress: 100,
        completedAt: new Date(),
      },
    });

    console.log(`${LOG_PREFIX} ========== GENERATION COMPLETE ==========`);
    console.log(`${LOG_PREFIX} Created ${createdImages.length} images`);

  } catch (error) {
    console.error(`${LOG_PREFIX} ========== GENERATION FAILED ==========`);
    console.error(`${LOG_PREFIX} Error:`, error);

    await prisma.adImageProject.update({
      where: { id: projectId },
      data: {
        status: "FAILED",
        processingError: error instanceof Error ? error.message : "Generation failed",
      },
    });
  }
}
