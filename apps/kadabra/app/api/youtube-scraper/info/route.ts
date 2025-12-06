import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { Innertube } from "youtubei.js";

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

    // Create Innertube instance
    console.log("[INFO] Creating Innertube instance...");
    const yt = await Innertube.create();
    console.log("[INFO] Innertube created");

    // Get video info
    console.log("[INFO] Fetching video info...");
    const info = await yt.getBasicInfo(videoId);
    console.log("[INFO] Got video info:", info.basic_info.title);

    const video: VideoInfo = {
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
