import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

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
    const { url, quality = "best", format = "mp4" } = await req.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
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

    // Start download in background
    processDownload(jobId, url, quality, format, session.user.email).catch(
      (error) => {
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
      }
    );

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
  quality: string,
  format: string,
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

    // Get video info first
    const { stdout: infoJson } = await execAsync(`yt-dlp --dump-json --no-download "${url}"`, {
      timeout: 30000,
    });
    const videoData = JSON.parse(infoJson);

    const videoInfo = {
      id: videoData.id,
      url: videoData.webpage_url || url,
      title: videoData.title || "Unknown Title",
      description: videoData.description || "",
      thumbnail: videoData.thumbnail || videoData.thumbnails?.[0]?.url || "",
      duration: videoData.duration || 0,
      uploadDate: videoData.upload_date
        ? `${videoData.upload_date.slice(0, 4)}-${videoData.upload_date.slice(4, 6)}-${videoData.upload_date.slice(6, 8)}`
        : "Unknown",
      viewCount: videoData.view_count || 0,
      likeCount: videoData.like_count,
      channel: videoData.uploader || videoData.channel || "Unknown",
      channelUrl: videoData.uploader_url || videoData.channel_url || "",
    };

    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      videoInfo,
      progress: 10,
      updatedAt: new Date().toISOString(),
    });

    // Create temp file path
    const tempFile = join(tmpdir(), `yt-${jobId}.${format}`);

    // Download video using yt-dlp
    const formatArg = quality === "best"
      ? "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
      : `bestvideo[height<=${quality.replace("p", "")}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality.replace("p", "")}][ext=mp4]/best`;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("yt-dlp", [
        "-f",
        formatArg,
        "--merge-output-format",
        format,
        "-o",
        tempFile,
        "--no-playlist",
        "--progress",
        url,
      ]);

      let lastProgress = 10;

      proc.stdout.on("data", (data) => {
        const output = data.toString();
        // Parse progress from yt-dlp output
        const match = output.match(/(\d+\.?\d*)%/);
        if (match) {
          const downloadProgress = parseFloat(match[1]);
          // Map download progress to 10-80%
          lastProgress = 10 + (downloadProgress * 0.7);
          jobs.set(jobId, {
            ...jobs.get(jobId)!,
            progress: Math.round(lastProgress),
            updatedAt: new Date().toISOString(),
          });
        }
      });

      proc.stderr.on("data", (data) => {
        const output = data.toString();
        const match = output.match(/(\d+\.?\d*)%/);
        if (match) {
          const downloadProgress = parseFloat(match[1]);
          lastProgress = 10 + (downloadProgress * 0.7);
          jobs.set(jobId, {
            ...jobs.get(jobId)!,
            progress: Math.round(lastProgress),
            updatedAt: new Date().toISOString(),
          });
        }
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });

      proc.on("error", reject);
    });

    // Update status to processing
    jobs.set(jobId, {
      ...jobs.get(jobId)!,
      status: "processing",
      progress: 85,
      updatedAt: new Date().toISOString(),
    });

    // Read the file and upload to Vercel Blob
    const fileBuffer = await readFile(tempFile);
    const fileSize = fileBuffer.length;

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

    const blob = await put(`youtube-downloads/${userId}/${safeTitle}-${videoInfo.id}.${format}`, fileBuffer, {
      access: "public",
      contentType: format === "mp4" ? "video/mp4" : "video/webm",
    });

    // Clean up temp file
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }

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
