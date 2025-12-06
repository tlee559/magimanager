import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { prisma } from "@magimanager/database";
import { Innertube } from "youtubei.js";

export const maxDuration = 300; // 5 minutes

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
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
    const { url } = body;

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
        debug: [`[${new Date().toISOString()}] Job created`],
      },
    });

    console.log("[DOWNLOAD] Created job:", job.id);

    // Start download in background (non-blocking)
    processDownload(job.id, url, videoId, session.user.email).catch((error) => {
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
  url: string,
  videoId: string,
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
    await addDebug("Starting download process");
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        status: "DOWNLOADING",
        progress: 5,
      },
    });

    // Create Innertube instance
    await addDebug("Creating Innertube instance...");
    const yt = await Innertube.create();
    await addDebug("Innertube created successfully");

    // Get video info
    await addDebug(`Fetching video info for: ${videoId}`);
    const info = await yt.getBasicInfo(videoId);
    await addDebug(`Got video info: "${info.basic_info.title}"`);

    // Update job with video info
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        title: info.basic_info.title || "Unknown Title",
        description: info.basic_info.short_description || "",
        thumbnail: info.basic_info.thumbnail?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: info.basic_info.duration || 0,
        uploadDate: info.basic_info.start_timestamp?.toISOString().split("T")[0] || "Unknown",
        viewCount: info.basic_info.view_count || 0,
        channel: info.basic_info.author || "Unknown",
        channelUrl: info.basic_info.channel?.url || "",
        progress: 10,
      },
    });

    // Download the video
    await addDebug("Starting video download...");

    // Get full info for download
    const fullInfo = await yt.getInfo(videoId);
    await addDebug(`Got full info, streaming formats available: ${fullInfo.streaming_data?.formats?.length || 0}`);

    // Choose best format with video and audio
    const format = fullInfo.chooseFormat({ type: "video+audio", quality: "best" });
    await addDebug(`Selected format: ${format.quality_label || "unknown"} (${format.mime_type})`);

    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: { progress: 20 },
    });

    // Download the video stream
    await addDebug("Downloading video stream...");
    const stream = await yt.download(videoId, {
      type: "video+audio",
      quality: "best",
    });

    // Collect chunks
    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      downloadedBytes += value.length;

      // Update progress periodically (20-80%)
      const progress = Math.min(20 + (downloadedBytes / 50000000) * 60, 80); // Assume ~50MB max
      if (Math.floor(progress) % 10 === 0) {
        await addDebug(`Download progress: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
      }

      await prisma.youTubeDownloadJob.update({
        where: { id: jobId },
        data: { progress: Math.round(progress) },
      });
    }

    await addDebug(`Download complete: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB total`);

    // Update status to processing
    await prisma.youTubeDownloadJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        progress: 85,
      },
    });

    // Combine chunks into buffer
    await addDebug("Combining chunks into buffer...");
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const uint8Array = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      uint8Array.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to Buffer for Vercel Blob
    const videoBuffer = Buffer.from(uint8Array);
    const fileSize = videoBuffer.length;
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
