import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { prisma } from "@magimanager/database";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobs = await prisma.adSpyJob.findMany({
      where: { userId: session.user.email },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      jobs: jobs.map(formatJob),
    });
  } catch (error) {
    console.error("[ADSPY:JOBS] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs" },
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
