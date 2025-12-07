import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { prisma } from "@magimanager/database";
import {
  getVideoInfoFromPython,
  getDownloadUrlFromPython,
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

    // Get download URL from Python service
    await addDebug(`Getting download URL (quality: ${quality})...`);
    const downloadInfo = await getDownloadUrlFromPython(url, quality, "mp4");
    await addDebug(`Got download URL for format: ${downloadInfo.format_id}`);

    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: { progress: 15 },
    });

    // Download the video from the direct URL
    await addDebug("Starting video download from YouTube CDN...");

    const response = await fetch(downloadInfo.url, {
      redirect: "follow", // Follow 302 redirects
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.youtube.com/",
        "Origin": "https://www.youtube.com",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    await addDebug(`Response OK - Status: ${response.status}`);

    await addDebug("Downloading video stream...");

    // Get content length for progress tracking
    const contentLength = response.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : null;
    await addDebug(`Content-Length: ${totalSize ? `${(totalSize / 1024 / 1024).toFixed(2)} MB` : "unknown"}`);

    // Read the stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    let lastProgressUpdate = 15;
    let lastDebugUpdate = Date.now();
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      downloadedBytes += value.length;

      // Update progress
      const progressPercent = totalSize
        ? Math.round(15 + (downloadedBytes / totalSize) * 65) // 15-80%
        : Math.min(15 + Math.floor(downloadedBytes / 1000000) * 5, 80);

      const now = Date.now();
      // Update every 2% or every 3 seconds
      if (progressPercent >= lastProgressUpdate + 2 || now - lastDebugUpdate > 3000) {
        lastProgressUpdate = progressPercent;
        lastDebugUpdate = now;
        const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
        const totalMB = totalSize ? (totalSize / 1024 / 1024).toFixed(2) : "?";
        const elapsedSec = ((now - startTime) / 1000).toFixed(1);
        const speedMbps = (downloadedBytes / 1024 / 1024 / ((now - startTime) / 1000)).toFixed(2);
        await addDebug(`Downloading: ${downloadedMB}/${totalMB} MB (${progressPercent}%) - ${speedMbps} MB/s - ${elapsedSec}s`);

        await prisma.youTubeDownloadJob.update({
          where: { id: jobId },
          data: { progress: progressPercent },
        });
      }
    }

    // Combine chunks into buffer
    const fileSize = downloadedBytes;
    const buffer = new Uint8Array(fileSize);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

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
