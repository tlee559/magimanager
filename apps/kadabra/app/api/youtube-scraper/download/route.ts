import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { Innertube } from "youtubei.js";

export const maxDuration = 300; // 5 minutes

// In-memory job store (in production, use a database)
const jobs = new Map<
  string,
  {
    id: string;
    url: string;
    status: "pending" | "downloading" | "processing" | "completed" | "failed";
    progress: number;
    videoInfo?: {
      id: string;
      url: string;
      title: string;
      description: string;
      thumbnail: string;
      duration: number;
      uploadDate: string;
      viewCount: number;
      likeCount?: number;
      channel: string;
      channelUrl: string;
    };
    downloadUrl?: string;
    blobUrl?: string;
    fileSize?: number;
    error?: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    debug?: string[];
  }
>();

// Export for use in other routes
export { jobs };

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

    // Create a job
    const jobId = randomUUID();
    const now = new Date().toISOString();
    console.log("[DOWNLOAD] Created job:", jobId);

    const job = {
      id: jobId,
      url,
      status: "pending" as const,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      userId: session.user.email,
      debug: [`[${now}] Job created`],
    };

    jobs.set(jobId, job);
    console.log("[DOWNLOAD] Job stored in memory, total jobs:", jobs.size);

    // Start download in background (non-blocking)
    processDownload(jobId, url, videoId, session.user.email).catch((error) => {
      console.error("[DOWNLOAD] Background process error:", error);
      const existingJob = jobs.get(jobId);
      if (existingJob) {
        jobs.set(jobId, {
          ...existingJob,
          status: "failed",
          error: error instanceof Error ? error.message : "Download failed",
          debug: [...(existingJob.debug || []), `[ERROR] ${error instanceof Error ? error.message : String(error)}`],
          updatedAt: new Date().toISOString(),
        });
      }
    });

    console.log("[DOWNLOAD] Returning success response");
    return NextResponse.json({ success: true, job });
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

  const job = jobs.get(jobId);
  if (!job) {
    console.log(`[PROCESS] Job ${jobId} not found!`);
    return;
  }

  const addDebug = (msg: string) => {
    const currentJob = jobs.get(jobId);
    if (currentJob) {
      const debug = currentJob.debug || [];
      debug.push(`[${new Date().toISOString()}] ${msg}`);
      jobs.set(jobId, { ...currentJob, debug });
    }
    console.log(`[PROCESS:${jobId.slice(0, 8)}] ${msg}`);
  };

  try {
    // Update status to downloading
    addDebug("Starting download process");
    jobs.set(jobId, {
      ...job,
      status: "downloading",
      progress: 5,
      updatedAt: new Date().toISOString(),
    });

    // Create Innertube instance
    addDebug("Creating Innertube instance...");
    const yt = await Innertube.create();
    addDebug("Innertube created successfully");

    // Get video info
    addDebug(`Fetching video info for: ${videoId}`);
    const info = await yt.getBasicInfo(videoId);
    addDebug(`Got video info: "${info.basic_info.title}"`);

    const videoInfo = {
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: info.basic_info.title || "Unknown Title",
      description: info.basic_info.short_description || "",
      thumbnail: info.basic_info.thumbnail?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: info.basic_info.duration || 0,
      uploadDate: info.basic_info.start_timestamp?.toISOString().split("T")[0] || "Unknown",
      viewCount: info.basic_info.view_count || 0,
      likeCount: undefined,
      channel: info.basic_info.author || "Unknown",
      channelUrl: info.basic_info.channel?.url || "",
    };

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      videoInfo,
      progress: 10,
      updatedAt: new Date().toISOString(),
    });

    // Download the video
    addDebug("Starting video download...");

    // Get full info for download
    const fullInfo = await yt.getInfo(videoId);
    addDebug(`Got full info, streaming formats available: ${fullInfo.streaming_data?.formats?.length || 0}`);

    // Choose best format with video and audio
    const format = fullInfo.chooseFormat({ type: "video+audio", quality: "best" });
    addDebug(`Selected format: ${format.quality_label || "unknown"} (${format.mime_type})`);

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      progress: 20,
      updatedAt: new Date().toISOString(),
    });

    // Download the video stream
    addDebug("Downloading video stream...");
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
        addDebug(`Download progress: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
      }

      jobs.set(jobId, {
        ...jobs.get(jobId)!,
        progress: Math.round(progress),
        updatedAt: new Date().toISOString(),
      });
    }

    addDebug(`Download complete: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB total`);

    // Update status to processing
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: "processing",
      progress: 85,
      updatedAt: new Date().toISOString(),
    });

    // Combine chunks into buffer
    addDebug("Combining chunks into buffer...");
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
    addDebug(`Buffer created: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      progress: 90,
      updatedAt: new Date().toISOString(),
    });

    // Upload to Vercel Blob
    const safeTitle = (videoInfo.title || "video")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);

    const blobPath = `youtube-downloads/${userId}/${safeTitle}-${videoId}.mp4`;
    addDebug(`Uploading to Vercel Blob: ${blobPath}`);

    const blob = await put(blobPath, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
    });

    addDebug(`Upload complete! Blob URL: ${blob.url}`);

    // Update job with completed status
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: "completed",
      progress: 100,
      blobUrl: blob.url,
      fileSize,
      updatedAt: new Date().toISOString(),
    });

    addDebug("Job completed successfully!");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[PROCESS:${jobId.slice(0, 8)}] ERROR:`, error);

    const currentJob = jobs.get(jobId);
    const debug = currentJob?.debug || [];
    debug.push(`[${new Date().toISOString()}] FATAL ERROR: ${errorMsg}`);

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: "failed",
      error: errorMsg,
      debug,
      updatedAt: new Date().toISOString(),
    });
  }
}
