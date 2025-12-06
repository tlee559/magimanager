import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import ytdl from "ytdl-core";

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
  }
>();

// Export for use in other routes
export { jobs };

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

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
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
    processDownload(jobId, url, session.user.email).catch((error) => {
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

async function processDownload(jobId: string, url: string, userId: string) {
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

    // Get video info first
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;

    const videoInfo = {
      id: videoDetails.videoId,
      url: videoDetails.video_url,
      title: videoDetails.title || "Unknown Title",
      description: videoDetails.description || "",
      thumbnail: videoDetails.thumbnails?.[videoDetails.thumbnails.length - 1]?.url || "",
      duration: parseInt(videoDetails.lengthSeconds) || 0,
      uploadDate: videoDetails.publishDate || "Unknown",
      viewCount: parseInt(videoDetails.viewCount) || 0,
      likeCount: undefined,
      channel: videoDetails.author?.name || "Unknown",
      channelUrl: videoDetails.author?.channel_url || "",
    };

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      videoInfo,
      progress: 10,
      updatedAt: new Date().toISOString(),
    });

    // Download video using ytdl-core
    // Get the best format with both video and audio
    const format = ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: (format) => format.container === "mp4" && format.hasVideo && format.hasAudio,
    });

    // If no combined format, try to get best video
    const selectedFormat = format || ytdl.chooseFormat(info.formats, {
      quality: "highestvideo",
      filter: "videoandaudio",
    });

    if (!selectedFormat) {
      throw new Error("No suitable video format found");
    }

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      progress: 20,
      updatedAt: new Date().toISOString(),
    });

    // Download as a stream and collect chunks
    const chunks: Buffer[] = [];
    let downloadedBytes = 0;
    const totalBytes = parseInt(selectedFormat.contentLength || "0") || 10000000; // Default 10MB estimate

    const stream = ytdl.downloadFromInfo(info, { format: selectedFormat });

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        downloadedBytes += chunk.length;
        const progress = Math.min(20 + (downloadedBytes / totalBytes) * 60, 80);
        jobs.set(jobId, {
          ...jobs.get(jobId)!,
          progress: Math.round(progress),
          updatedAt: new Date().toISOString(),
        });
      });

      stream.on("end", () => resolve());
      stream.on("error", (err) => reject(err));
    });

    // Update status to processing
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: "processing",
      progress: 85,
      updatedAt: new Date().toISOString(),
    });

    // Combine chunks into buffer
    const videoBuffer = Buffer.concat(chunks);
    const fileSize = videoBuffer.length;

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      progress: 90,
      updatedAt: new Date().toISOString(),
    });

    // Upload to Vercel Blob
    const safeTitle = videoInfo.title
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);

    const blob = await put(
      `youtube-downloads/${userId}/${safeTitle}-${videoInfo.id}.mp4`,
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
