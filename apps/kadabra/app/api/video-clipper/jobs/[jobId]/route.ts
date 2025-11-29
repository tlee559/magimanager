import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";

type RouteParams = { params: Promise<{ jobId: string }> };

// GET /api/video-clipper/jobs/[jobId] - Get a single job with all clips
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { jobId } = await params;

    const job = await prisma.videoClipJob.findFirst({
      where: {
        id: jobId,
        userId,
      },
      include: {
        clips: {
          orderBy: { marketingScore: "desc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("[Video Clipper] Error fetching job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch job" },
      { status: 500 }
    );
  }
}

// PATCH /api/video-clipper/jobs/[jobId] - Update job (e.g., rename)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { jobId } = await params;
    const body = await req.json();

    // Verify ownership
    const existingJob = await prisma.videoClipJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Only allow updating certain fields
    const { name } = body;
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;

    const updatedJob = await prisma.videoClipJob.update({
      where: { id: jobId },
      data: updateData,
      include: {
        clips: {
          orderBy: { marketingScore: "desc" },
        },
      },
    });

    return NextResponse.json({ job: updatedJob });
  } catch (error) {
    console.error("[Video Clipper] Error updating job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update job" },
      { status: 500 }
    );
  }
}

// DELETE /api/video-clipper/jobs/[jobId] - Delete a job and all its clips
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { jobId } = await params;

    // Verify ownership
    const existingJob = await prisma.videoClipJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Delete the job (clips will be cascade deleted)
    await prisma.videoClipJob.delete({
      where: { id: jobId },
    });

    // In production: Also delete associated files from Vercel Blob

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Video Clipper] Error deleting job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete job" },
      { status: 500 }
    );
  }
}
