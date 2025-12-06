import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import ytdl from "ytdl-core";

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

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      return NextResponse.json(
        { success: false, error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    // Get video info using ytdl-core
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;

    const video: VideoInfo = {
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

    return NextResponse.json({ success: true, video });
  } catch (error: unknown) {
    console.error("Error fetching video info:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("Video unavailable") || errorMessage.includes("Private video")) {
      return NextResponse.json(
        { success: false, error: "This video is unavailable or private" },
        { status: 400 }
      );
    }

    if (errorMessage.includes("age-restricted")) {
      return NextResponse.json(
        { success: false, error: "This video is age-restricted and cannot be accessed" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch video info. The video may be restricted or unavailable." },
      { status: 500 }
    );
  }
}
