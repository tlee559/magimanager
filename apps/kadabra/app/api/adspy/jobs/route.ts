import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { prisma } from "@magimanager/database";

export async function GET(req: NextRequest) {
  console.log("[ADSPY:JOBS] ========== GET request received ==========");

  // Check auth
  let session;
  try {
    session = await getServerSession(authOptions);
    console.log("[ADSPY:JOBS] Session user:", session?.user?.email || "NO SESSION");
  } catch (authError) {
    console.error("[ADSPY:JOBS] Auth error:", authError);
    return NextResponse.json({
      success: false,
      error: "Authentication error",
      debug: { authError: String(authError) }
    }, { status: 500 });
  }

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[ADSPY:JOBS] Fetching jobs for user:", session.user.email);

    const jobs = await prisma.adSpyJob.findMany({
      where: { userId: session.user.email },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    console.log("[ADSPY:JOBS] Found", jobs.length, "jobs");

    return NextResponse.json({
      success: true,
      jobs: jobs.map(formatJob),
    });
  } catch (error) {
    console.error("[ADSPY:JOBS] Database error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch jobs",
        debug: {
          error: String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      },
      { status: 500 }
    );
  }
}

function formatJob(job: any) {
  return {
    id: job.id,
    keyword: job.keyword,
    location: job.location,
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
