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

async function fetchFromCobalt(url: string): Promise<CobaltResponse | null> {
  for (const instance of COBALT_INSTANCES) {
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

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error(`Cobalt instance ${instance} failed:`, error);
      continue;
    }
  }
  return null;
}

async function getYouTubeVideoInfo(videoId: string) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

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
    console.error("oEmbed fetch failed:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    // Create a job
    const jobId = randomUUID();
    const now = new Date().toISOString();

    const job = {
      id: jobId,
      url,
      status: "pending" as const,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      userId: session.user.email,
    };

    jobs.set(jobId, job);

    // Start download in background (non-blocking)
    processDownload(jobId, url, videoId, session.user.email).catch((error) => {
      console.error("Download error:", error);
      const existingJob = jobs.get(jobId);
      if (existingJob) {
        jobs.set(jobId, {
          ...existingJob,
          status: "failed",
          error: error instanceof Error ? error.message : "Download failed",
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("Error starting download:", error);
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
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Update status to downloading
    jobs.set(jobId, {
      ...job,
      status: "downloading",
      progress: 5,
      updatedAt: new Date().toISOString(),
    });

    // Get video info
    const videoInfo = await getYouTubeVideoInfo(videoId);

    if (videoInfo) {
      jobs.set(jobId, {
        ...jobs.get(jobId)!,
        videoInfo,
        progress: 10,
        updatedAt: new Date().toISOString(),
      });
    }

    // Get download URL from Cobalt
    const cobaltData = await fetchFromCobalt(url);

    if (!cobaltData) {
      throw new Error("Download service unavailable");
    }

    if (cobaltData.status === "error") {
      throw new Error(cobaltData.error?.code || "Video cannot be downloaded");
    }

    if (!cobaltData.url) {
      throw new Error("No download URL returned");
    }

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      progress: 20,
      updatedAt: new Date().toISOString(),
    });

    // Download the video from Cobalt's tunnel/redirect URL
    const videoResponse = await fetch(cobaltData.url);

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    // Get content length for progress tracking
    const contentLength = parseInt(
      videoResponse.headers.get("content-length") || "0"
    );

    // Stream the response to a buffer
    const reader = videoResponse.body?.getReader();
    if (!reader) {
      throw new Error("Cannot read video stream");
    }

    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      downloadedBytes += value.length;

      // Update progress (20-80%)
      if (contentLength > 0) {
        const progress = 20 + (downloadedBytes / contentLength) * 60;
        jobs.set(jobId, {
          ...jobs.get(jobId)!,
          progress: Math.round(progress),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Update status to processing
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: "processing",
      progress: 85,
      updatedAt: new Date().toISOString(),
    });

    // Combine chunks into buffer
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

    const blob = await put(
      `youtube-downloads/${userId}/${safeTitle}-${videoId}.mp4`,
      videoBuffer,
      {
        access: "public",
        contentType: "video/mp4",
      }
    );

    // Update job with completed status
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: "completed",
      progress: 100,
      blobUrl: blob.url,
      fileSize,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Download processing error:", error);
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: "failed",
      error: error instanceof Error ? error.message : "Download failed",
      updatedAt: new Date().toISOString(),
    });
  }
}
