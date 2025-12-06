import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { del } from "@vercel/blob";
import { prisma } from "@magimanager/database";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  try {
    const dbJob = await prisma.youTubeDownloadJob.findUnique({
      where: { id: jobId },
    });

    if (!dbJob) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (dbJob.userId !== session.user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Transform to match frontend expected format
    const job = {
      id: dbJob.id,
      url: dbJob.url,
      status: dbJob.status.toLowerCase(),
      progress: dbJob.progress,
      videoInfo: dbJob.title
        ? {
            id: dbJob.videoId || "",
            url: dbJob.url,
            title: dbJob.title,
            description: dbJob.description || "",
            thumbnail: dbJob.thumbnail || "",
            duration: dbJob.duration || 0,
            uploadDate: dbJob.uploadDate || "Unknown",
            viewCount: dbJob.viewCount || 0,
            likeCount: dbJob.likeCount || undefined,
            channel: dbJob.channel || "Unknown",
            channelUrl: dbJob.channelUrl || "",
          }
        : undefined,
      blobUrl: dbJob.blobUrl || undefined,
      fileSize: dbJob.fileSize || undefined,
      error: dbJob.error || undefined,
      createdAt: dbJob.createdAt.toISOString(),
      updatedAt: dbJob.updatedAt.toISOString(),
      debug: dbJob.debug,
    };

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("[JOB] Error fetching job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  try {
    const dbJob = await prisma.youTubeDownloadJob.findUnique({
      where: { id: jobId },
    });

    if (!dbJob) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (dbJob.userId !== session.user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete blob if exists
    if (dbJob.blobUrl) {
      try {
        await del(dbJob.blobUrl);
      } catch (error) {
        console.error("Failed to delete blob:", error);
        // Continue with job deletion even if blob deletion fails
      }
    }

    // Delete job from database
    await prisma.youTubeDownloadJob.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[JOB] Error deleting job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete job" },
      { status: 500 }
    );
  }
}
