import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";

export const maxDuration = 300; // 5 minutes

const COBALT_INSTANCES = [
  "https://cobalt-api.meowing.de",
  "https://cobalt-api.kwiatekmiki.com",
  "https://capi.3kh0.net",
];

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

interface CobaltResponse {
  status: "tunnel" | "redirect" | "picker" | "error";
  url?: string;
  filename?: string;
  error?: {
    code: string;
  };
}

async function fetchFromCobalt(url: string, addDebug: (msg: string) => void): Promise<CobaltResponse | null> {
  for (const instance of COBALT_INSTANCES) {
    addDebug(`[COBALT] Trying instance: ${instance}`);
    try {
      const response = await fetch(instance, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          videoQuality: "1080",
          youtubeVideoCodec: "h264",
        }),
      });

      addDebug(`[COBALT] Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        addDebug(`[COBALT] Response data: ${JSON.stringify(data)}`);
        return data;
      } else {
        const errorText = await response.text();
        addDebug(`[COBALT] Error response: ${errorText}`);
      }
    } catch (error) {
      addDebug(`[COBALT] Instance ${instance} failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`Cobalt instance ${instance} failed:`, error);
      continue;
    }
  }
  addDebug("[COBALT] All instances failed");
  return null;
}

async function getYouTubeVideoInfo(videoId: string, addDebug: (msg: string) => void) {
  addDebug(`[OEMBED] Fetching info for video: ${videoId}`);
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);

    addDebug(`[OEMBED] Response status: ${response.status}`);

    if (!response.ok) {
      addDebug(`[OEMBED] Failed to fetch video info`);
      return null;
    }

    const data = await response.json();
    addDebug(`[OEMBED] Got video title: ${data.title}`);

    return {
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: data.title || "Unknown Title",
      description: "",
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 0,
      uploadDate: "Unknown",
      viewCount: 0,
      likeCount: undefined,
      channel: data.author_name || "Unknown",
      channelUrl: data.author_url || "",
    };
  } catch (error) {
    addDebug(`[OEMBED] Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error("oEmbed fetch failed:", error);
    return null;
  }
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

    // Get video info
    addDebug("Fetching video info from YouTube oEmbed");
    const videoInfo = await getYouTubeVideoInfo(videoId, addDebug);

    if (videoInfo) {
      addDebug(`Got video info: "${videoInfo.title}" by ${videoInfo.channel}`);
      jobs.set(jobId, {
        ...jobs.get(jobId)!,
        videoInfo,
        progress: 10,
        updatedAt: new Date().toISOString(),
      });
    } else {
      addDebug("Warning: Could not get video info, continuing anyway");
    }

    // Get download URL from Cobalt
    addDebug("Requesting download URL from Cobalt API");
    const cobaltData = await fetchFromCobalt(url, addDebug);

    if (!cobaltData) {
      addDebug("ERROR: All Cobalt instances failed");
      throw new Error("Download service unavailable - all Cobalt instances failed");
    }

    addDebug(`Cobalt response status: ${cobaltData.status}`);

    if (cobaltData.status === "error") {
      addDebug(`ERROR: Cobalt returned error: ${cobaltData.error?.code}`);
      throw new Error(cobaltData.error?.code || "Video cannot be downloaded");
    }

    if (!cobaltData.url) {
      addDebug("ERROR: No download URL in Cobalt response");
      throw new Error("No download URL returned from Cobalt");
    }

    addDebug(`Got download URL: ${cobaltData.url.substring(0, 100)}...`);

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      progress: 20,
      updatedAt: new Date().toISOString(),
    });

    // Download the video from Cobalt's tunnel/redirect URL
    addDebug("Starting video download from Cobalt URL");
    const videoResponse = await fetch(cobaltData.url);

    addDebug(`Video download response status: ${videoResponse.status}`);

    if (!videoResponse.ok) {
      addDebug(`ERROR: Video download failed with status ${videoResponse.status}`);
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    // Get content length for progress tracking
    const contentLength = parseInt(
      videoResponse.headers.get("content-length") || "0"
    );
    addDebug(`Content-Length: ${contentLength} bytes (${(contentLength / 1024 / 1024).toFixed(2)} MB)`);

    // Stream the response to a buffer
    const reader = videoResponse.body?.getReader();
    if (!reader) {
      addDebug("ERROR: Cannot get reader from response body");
      throw new Error("Cannot read video stream");
    }

    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    let lastProgressLog = 0;

    addDebug("Starting to read video stream...");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      downloadedBytes += value.length;

      // Update progress (20-80%)
      if (contentLength > 0) {
        const progress = 20 + (downloadedBytes / contentLength) * 60;
        const roundedProgress = Math.round(progress);

        // Log every 10%
        if (roundedProgress >= lastProgressLog + 10) {
          lastProgressLog = roundedProgress;
          addDebug(`Download progress: ${roundedProgress}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB)`);
        }

        jobs.set(jobId, {
          ...jobs.get(jobId)!,
          progress: roundedProgress,
          updatedAt: new Date().toISOString(),
        });
      }
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
    const safeTitle = (videoInfo?.title || "video")
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
