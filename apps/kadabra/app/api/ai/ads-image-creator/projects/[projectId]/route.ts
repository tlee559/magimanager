import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";

// GET /api/ai/ads-image-creator/projects/[projectId] - Get a specific project
export async function GET(
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

    const project = await prisma.adImageProject.findFirst({
      where: { id: projectId, userId },
      include: {
        images: {
          orderBy: { overallScore: "desc" },
        },
        campaignPlan: {
          select: {
            id: true,
            name: true,
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

    return NextResponse.json({ project });
  } catch (error) {
    console.error("[Ads Image Creator] Error fetching project:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/ai/ads-image-creator/projects/[projectId] - Update a project
export async function PATCH(
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
    const body = await req.json();

    // Check ownership
    const existing = await prisma.adImageProject.findFirst({
      where: { id: projectId, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = await prisma.adImageProject.update({
      where: { id: projectId },
      data: {
        name: body.name !== undefined ? body.name : existing.name,
        productDescription: body.productDescription !== undefined ? body.productDescription : existing.productDescription,
        headlines: body.headlines !== undefined ? body.headlines : existing.headlines,
        ctaText: body.ctaText !== undefined ? body.ctaText : existing.ctaText,
        goal: body.goal !== undefined ? body.goal : existing.goal,
        marketingAngles: body.marketingAngles !== undefined ? body.marketingAngles : existing.marketingAngles,
        targetFormats: body.targetFormats !== undefined ? body.targetFormats : existing.targetFormats,
        variationCount: body.variationCount !== undefined ? Math.min(Math.max(body.variationCount, 1), 4) : existing.variationCount,
        colorScheme: body.colorScheme !== undefined ? body.colorScheme : existing.colorScheme,
        fontPreferences: body.fontPreferences !== undefined ? body.fontPreferences : existing.fontPreferences,
      },
      include: {
        images: true,
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("[Ads Image Creator] Error updating project:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/ads-image-creator/projects/[projectId] - Delete a project
export async function DELETE(
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

    // Check ownership
    const existing = await prisma.adImageProject.findFirst({
      where: { id: projectId, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete cascades to images
    await prisma.adImageProject.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Ads Image Creator] Error deleting project:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete project" },
      { status: 500 }
    );
  }
}
