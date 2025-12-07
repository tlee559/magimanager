import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { prisma } from "@magimanager/database";
import {
  getVideoInfoFromPython,
  downloadVideoFromPython,
} from "../../../../lib/youtube-scraper/python-service";

export const maxDuration = 300; // 5 minutes

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(req: NextRequest) {
  console.log("[DOWNLOAD] POST request received");

  const session = await getServerSession(authOptions);
  console.log("[DOWNLOAD] Session:", session?.user?.email || "none");

  if (!session?.user?.email) {
    console.log("[DOWNLOAD] Unauthorized - no session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log("[DOWNLOAD] Request body:", body);
    const { url, quality = "best" } = body;

    if (!url) {
      console.log("[DOWNLOAD] No URL provided");
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    console.log("[DOWNLOAD] Extracted video ID:", videoId);

    if (!videoId) {
      console.log("[DOWNLOAD] Invalid YouTube URL");
      return NextResponse.json(
        { success: false, error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    // Create a job in the database
    const job = await prisma.youTubeDownloadJob.create({
      data: {
        userId: session.user.email,
        url,
        videoId,
        status: "PENDING",
        progress: 0,
        debug: [`[${new Date().toISOString()}] Job created (Python service)`],
      },
    });

    console.log("[DOWNLOAD] Created job:", job.id);

    // Run download synchronously (don't return until done)
    // This keeps the serverless function alive for the full download
    console.log("[DOWNLOAD] Starting synchronous download process...");

    try {
      await processDownload(job.id, url, videoId, quality, session.user.email);
      console.log("[DOWNLOAD] Download completed successfully");
    } catch (error) {
      console.error("[DOWNLOAD] Download process error:", error);
      await prisma.youTubeDownloadJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Download failed",
          debug: {
            push: `[${new Date().toISOString()}] ERROR: ${error instanceof Error ? error.message : String(error)}`,
          },
        },
      });
    }

    // Fetch updated job
    const updatedJob = await prisma.youTubeDownloadJob.findUnique({
      where: { id: job.id },
    });

    console.log("[DOWNLOAD] Returning response with status:", updatedJob?.status);

    // Return job in the format expected by the frontend
    return NextResponse.json({
      success: true,
      job: {
        id: updatedJob?.id || job.id,
        url: updatedJob?.url || job.url,
        status: (updatedJob?.status || job.status).toLowerCase(),
        progress: updatedJob?.progress || job.progress,
        blobUrl: updatedJob?.blobUrl,
        fileSize: updatedJob?.fileSize,
        title: updatedJob?.title,
        thumbnail: updatedJob?.thumbnail,
        createdAt: (updatedJob?.createdAt || job.createdAt).toISOString(),
        updatedAt: (updatedJob?.updatedAt || job.updatedAt).toISOString(),
        debug: updatedJob?.debug || job.debug,
      },
    });
  } catch (error) {
    console.error("[DOWNLOAD] Error starting download:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start download" },
      { status: 500 }
    );
  }
}

async function processDownload(
  jobId: string,
  url: string,
  videoId: string,
  quality: "best" | "720p" | "480p" | "360p",
  userId: string
) {
  console.log(`[PROCESS] Starting download for job ${jobId}`);

  const addDebug = async (msg: string) => {
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        debug: { push: `[${new Date().toISOString()}] ${msg}` },
      },
    });
    console.log(`[PROCESS:${jobId.slice(0, 8)}] ${msg}`);
  };

  try {
    // Update status to downloading
    await addDebug("Starting download process (Python service)");
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        status: "DOWNLOADING",
        progress: 5,
      },
    });

    // Get video info from Python service
    await addDebug(`Fetching video info from Python service...`);
    const info = await getVideoInfoFromPython(url);
    await addDebug(`Got video info: "${info.title}"`);

    // Update job with video info
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        title: info.title || "Unknown Title",
        description: info.description || "",
        thumbnail: info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: info.duration || 0,
        uploadDate: "Unknown",
        viewCount: info.view_count || 0,
        channel: info.uploader || "Unknown",
        channelUrl: "",
        progress: 10,
      },
    });

    // Download video via Python service (Railway downloads from YouTube)
    await addDebug(`Downloading video via Railway (quality: ${quality})...`);
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: { progress: 15 },
    });

    // This calls Railway which downloads from YouTube and sends us the file
    const { buffer: videoBuffer, filename } = await downloadVideoFromPython(url, quality, "mp4");
    const fileSize = videoBuffer.length;

    await addDebug(`Download complete: ${(fileSize / 1024 / 1024).toFixed(2)} MB - ${filename}`);

    // Update status to processing
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        progress: 85,
      },
    });

    await addDebug(`Buffer ready for upload: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: { progress: 90 },
    });

    // Get current job for title
    const currentJob = await prisma.youTubeDownloadJob.findUnique({
      where: { id: jobId },
    });

    // Upload to Vercel Blob
    const safeTitle = (currentJob?.title || "video")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);

    const blobPath = `youtube-downloads/${userId}/${safeTitle}-${videoId}.mp4`;
    await addDebug(`Uploading to Vercel Blob: ${blobPath}`);

    const blob = await put(blobPath, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
    });

    await addDebug(`Upload complete! Blob URL: ${blob.url}`);

    // Update job with completed status
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        blobUrl: blob.url,
        fileSize,
      },
    });

    await addDebug("Job completed successfully!");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[PROCESS:${jobId.slice(0, 8)}] ERROR:`, error);

    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: errorMsg,
        debug: { push: `[${new Date().toISOString()}] FATAL ERROR: ${errorMsg}` },
      },
    });
  }
}
