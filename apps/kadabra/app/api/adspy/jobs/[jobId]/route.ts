import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { prisma } from "@magimanager/database";
import { del } from "@vercel/blob";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jobId } = await params;

    const job = await prisma.adSpyJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.userId !== session.user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      job: formatJob(job),
    });
  } catch (error) {
    console.error("[ADSPY:JOB] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jobId } = await params;

    const job = await prisma.adSpyJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.userId !== session.user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete screenshots from Vercel Blob
    const screenshotUrls = job.screenshotUrls as Record<string, string> | null;
    if (screenshotUrls) {
      for (const url of Object.values(screenshotUrls)) {
        try {
          await del(url);
        } catch (e) {
          console.error("[ADSPY:JOB] Failed to delete blob:", e);
        }
      }
    }

    // Delete the job
    await prisma.adSpyJob.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADSPY:JOB] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete job" },
      { status: 500 }
    );
  }
}

function formatJob(job: any) {
  return {
    id: job.id,
    keyword: job.keyword,
    location: job.location,
    businessContext: job.businessContext,
    status: job.status.toLowerCase(),
    progress: job.progress,
    ads: job.ads,
    aiAnalysis: job.aiAnalysis,
    screenshotUrls: job.screenshotUrls,
    error: job.error,
    debug: job.debug,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
