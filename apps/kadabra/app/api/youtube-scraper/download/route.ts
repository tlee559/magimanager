import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { prisma } from "@magimanager/database";
import {
  extractVideoId,
  getVideoInfo,
  selectBestFormat,
  downloadStream,
} from "../../../../lib/youtube-scraper/youtube-client";

export const maxDuration = 300; // 5 minutes

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
        debug: [`[${new Date().toISOString()}] Job created (standalone client)`],
      },
    });

    console.log("[DOWNLOAD] Created job:", job.id);

    // Start download in background (non-blocking)
    processDownload(job.id, videoId, quality, session.user.email).catch((error) => {
      console.error("[DOWNLOAD] Background process error:", error);
      prisma.youTubeDownloadJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Download failed",
          debug: {
            push: `[${new Date().toISOString()}] ERROR: ${error instanceof Error ? error.message : String(error)}`,
          },
        },
      }).catch(console.error);
    });

    console.log("[DOWNLOAD] Returning success response");

    // Return job in the format expected by the frontend
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        url: job.url,
        status: job.status.toLowerCase(),
        progress: job.progress,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        debug: job.debug,
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
    await addDebug("Starting download process (standalone client)");
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        status: "DOWNLOADING",
        progress: 5,
      },
    });

    // Get video info using standalone client
    await addDebug(`Fetching video info for: ${videoId}`);
    const info = await getVideoInfo(videoId);
    await addDebug(`Got video info: "${info.title}"`);
    await addDebug(`Available formats: ${info.formats.length} muxed, ${info.adaptiveFormats.length} adaptive`);

    // Update job with video info
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        title: info.title || "Unknown Title",
        description: info.description || "",
        thumbnail: info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: info.duration || 0,
        uploadDate: "Unknown",
        viewCount: info.viewCount || 0,
        channel: info.author || "Unknown",
        channelUrl: "",
        progress: 10,
      },
    });

    // Select best format
    await addDebug("Selecting best format...");
    const { video, audio } = selectBestFormat(info, { quality, preferMuxed: true });

    if (!video?.url) {
      throw new Error("No downloadable format found");
    }

    await addDebug(`Selected format: ${video.qualityLabel || video.quality} (${video.mimeType})`);

    if (audio && !video.hasAudio) {
      await addDebug(`Note: Separate audio format available: ${audio.audioQuality}`);
    }

    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: { progress: 15 },
    });

    // Download the video stream
    await addDebug("Starting video download...");

    let lastProgressUpdate = 0;
    const buffer = await downloadStream(video.url, async (downloaded, total) => {
      const progressPercent = total
        ? Math.round(15 + (downloaded / total) * 65) // 15-80%
        : Math.min(15 + Math.floor(downloaded / 1000000) * 5, 80);

      // Update progress every 5%
      if (progressPercent >= lastProgressUpdate + 5) {
        lastProgressUpdate = progressPercent;
        const downloadedMB = (downloaded / 1024 / 1024).toFixed(2);
        const totalMB = total ? (total / 1024 / 1024).toFixed(2) : "?";
        await addDebug(`Download progress: ${downloadedMB} / ${totalMB} MB`);

        await prisma.youTubeDownloadJob.update({
          where: { id: jobId },
          data: { progress: progressPercent },
        });
      }
    });

    const fileSize = buffer.length;
    await addDebug(`Download complete: ${(fileSize / 1024 / 1024).toFixed(2)} MB total`);

    // Update status to processing
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        progress: 85,
      },
    });

    // Convert to Buffer for Vercel Blob
    const videoBuffer = Buffer.from(buffer);
    await addDebug(`Buffer created: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

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
