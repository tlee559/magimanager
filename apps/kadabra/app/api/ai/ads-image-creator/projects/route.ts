import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";

// GET /api/ai/ads-image-creator/projects - List all projects for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status.toUpperCase();
    }

    const [projects, total] = await Promise.all([
      prisma.adImageProject.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          images: {
            select: {
              id: true,
              compositeUrl: true,
              thumbnailUrl: true,
              overallScore: true,
              isFavorite: true,
              angleUsed: true,
              headlineUsed: true,
            },
            orderBy: { overallScore: "desc" },
          },
          campaignPlan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.adImageProject.count({ where }),
    ]);

    return NextResponse.json({ projects, total, limit, offset });
  } catch (error) {
    console.error("[Ads Image Creator] Error fetching projects:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/ai/ads-image-creator/projects - Create a new project
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();

    const {
      name,
      campaignPlanId,
      productDescription,
      productUrl,
      productImageUrl,
      logoUrl,
      headlines,
      ctaText,
      referenceImageUrl,
      competitorDomain,
      goal,
      marketingAngles,
      templateId,
      targetFormats,
      variationCount,
      colorScheme,
      fontPreferences,
    } = body;

    // Validate required fields
    if (!productDescription && !productUrl && !campaignPlanId) {
      return NextResponse.json(
        { error: "Product description, URL, or campaign plan is required" },
        { status: 400 }
      );
    }

    // Create the project
    const project = await prisma.adImageProject.create({
      data: {
        userId,
        name: name || null,
        campaignPlanId: campaignPlanId || null,
        productDescription: productDescription || null,
        productUrl: productUrl || null,
        productImageUrl: productImageUrl || null,
        logoUrl: logoUrl || null,
        headlines: headlines || [],
        ctaText: ctaText || null,
        referenceImageUrl: referenceImageUrl || null,
        competitorDomain: competitorDomain || null,
        goal: goal || "ctr",
        marketingAngles: marketingAngles || [],
        templateId: templateId || null,
        targetFormats: targetFormats || ["meta"],
        variationCount: Math.min(Math.max(variationCount || 4, 1), 4),
        colorScheme: colorScheme || null,
        fontPreferences: fontPreferences || null,
        status: "PENDING",
        progress: 0,
      },
      include: {
        images: true,
        campaignPlan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("[Ads Image Creator] Error creating project:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create project" },
      { status: 500 }
    );
  }
}
