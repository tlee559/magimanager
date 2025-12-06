import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { prisma } from "@magimanager/database";

export async function GET() {
  console.log("[JOBS] GET request received");

  const session = await getServerSession(authOptions);
  console.log("[JOBS] Session:", session?.user?.email || "none");

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get jobs for this user from database
    const dbJobs = await prisma.youTubeDownloadJob.findMany({
      where: { userId: session.user.email },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to last 50 jobs
    });

    // Transform to match frontend expected format
    const jobs = dbJobs.map((job) => ({
      id: job.id,
      url: job.url,
      status: job.status.toLowerCase(),
      progress: job.progress,
      videoInfo: job.title
        ? {
            id: job.videoId || "",
            url: job.url,
            title: job.title,
            description: job.description || "",
            thumbnail: job.thumbnail || "",
            duration: job.duration || 0,
            uploadDate: job.uploadDate || "Unknown",
            viewCount: job.viewCount || 0,
            likeCount: job.likeCount || undefined,
            channel: job.channel || "Unknown",
            channelUrl: job.channelUrl || "",
          }
        : undefined,
      blobUrl: job.blobUrl || undefined,
      fileSize: job.fileSize || undefined,
      error: job.error || undefined,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      debug: job.debug,
    }));

    console.log(`[JOBS] Returning ${jobs.length} jobs for user ${session.user.email}`);

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error("[JOBS] Error fetching jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
