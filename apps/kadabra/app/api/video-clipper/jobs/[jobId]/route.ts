import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { del } from "@vercel/blob";

type RouteParams = { params: Promise<{ jobId: string }> };

const REPLICATE_API_URL = "https://api.replicate.com/v1";

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

    // Verify ownership and get job with clips
    const existingJob = await prisma.videoClipJob.findFirst({
      where: { id: jobId, userId },
      include: { clips: true },
    });

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Cancel any in-progress Replicate predictions
    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (apiKey) {
      for (const clip of existingJob.clips) {
        if (clip.replicatePredictionId && clip.status === "PROCESSING") {
          try {
            await fetch(
              `${REPLICATE_API_URL}/predictions/${clip.replicatePredictionId}/cancel`,
              {
                method: "POST",
                headers: { Authorization: `Token ${apiKey}` },
              }
            );
            console.log(`[Video Clipper] Cancelled prediction ${clip.replicatePredictionId}`);
          } catch (e) {
            // Continue even if cancellation fails
            console.error(`[Video Clipper] Failed to cancel prediction:`, e);
          }
        }
      }
    }

    // Collect all Blob URLs to delete
    const blobUrls: string[] = [];

    // Job-level files
    if (existingJob.uploadedVideoUrl) blobUrls.push(existingJob.uploadedVideoUrl);

    // Clip-level files
    for (const clip of existingJob.clips) {
      if (clip.clipUrl) blobUrls.push(clip.clipUrl);
      if (clip.clipWithCaptionsUrl) blobUrls.push(clip.clipWithCaptionsUrl);
      if (clip.thumbnailUrl) blobUrls.push(clip.thumbnailUrl);
    }

    // Delete Blob files (non-blocking, continue even if some fail)
    if (blobUrls.length > 0) {
      try {
        await del(blobUrls);
        console.log(`[Video Clipper] Deleted ${blobUrls.length} Blob files`);
      } catch (e) {
        console.error(`[Video Clipper] Failed to delete some Blob files:`, e);
      }
    }

    // Delete the job (clips will be cascade deleted)
    await prisma.videoClipJob.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Video Clipper] Error deleting job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete job" },
      { status: 500 }
    );
  }
}
