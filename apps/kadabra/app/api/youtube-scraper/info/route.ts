import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const maxDuration = 30;

interface VideoInfo {
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
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
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

    // Use yt-dlp to get video info (JSON only, no download)
    const command = `yt-dlp --dump-json --no-download "${url}"`;

    const { stdout } = await execAsync(command, {
      timeout: 25000, // 25 second timeout
    });

    const data = JSON.parse(stdout);

    const video: VideoInfo = {
      id: data.id,
      url: data.webpage_url || url,
      title: data.title || "Unknown Title",
      description: data.description || "",
      thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || "",
      duration: data.duration || 0,
      uploadDate: data.upload_date
        ? `${data.upload_date.slice(0, 4)}-${data.upload_date.slice(4, 6)}-${data.upload_date.slice(6, 8)}`
        : "Unknown",
      viewCount: data.view_count || 0,
      likeCount: data.like_count,
      channel: data.uploader || data.channel || "Unknown",
      channelUrl: data.uploader_url || data.channel_url || "",
    };

    return NextResponse.json({ success: true, video });
  } catch (error: unknown) {
    console.error("Error fetching video info:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check for common errors
    if (errorMessage.includes("command not found") || errorMessage.includes("yt-dlp")) {
      return NextResponse.json(
        {
          success: false,
          error: "yt-dlp is not installed on the server. Please install it with: brew install yt-dlp",
        },
        { status: 500 }
      );
    }

    if (errorMessage.includes("Video unavailable") || errorMessage.includes("Private video")) {
      return NextResponse.json(
        { success: false, error: "This video is unavailable or private" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch video info" },
      { status: 500 }
    );
  }
}
