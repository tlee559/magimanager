import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { extractVideoId, getVideoInfo } from "../../../../lib/youtube-scraper/youtube-client";

export const maxDuration = 30;

interface VideoInfoResponse {
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
  console.log("[INFO] POST request received");

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url } = await req.json();
    console.log("[INFO] URL:", url);

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    console.log("[INFO] Video ID:", videoId);

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    // Use our standalone YouTube client
    console.log("[INFO] Fetching video info with standalone client...");
    const info = await getVideoInfo(videoId);
    console.log("[INFO] Got video info:", info.title);

    const video: VideoInfoResponse = {
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: info.title || "Unknown Title",
      description: info.description || "",
      thumbnail: info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: info.duration || 0,
      uploadDate: "Unknown", // Not available from player API
      viewCount: info.viewCount || 0,
      likeCount: undefined,
      channel: info.author || "Unknown",
      channelUrl: "", // Not available from player API
    };

    console.log("[INFO] Returning video info");
    return NextResponse.json({ success: true, video });
  } catch (error: unknown) {
    console.error("[INFO] Error fetching video info:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { success: false, error: `Failed to fetch video info: ${errorMessage}` },
      { status: 500 }
    );
  }
}
