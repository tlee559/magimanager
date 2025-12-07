import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { getVideoInfoFromPython } from "../../../../lib/youtube-scraper/python-service";

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

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
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

    // Use Python service (Railway) for video info
    console.log("[INFO] Fetching video info from Python service...");
    const info = await getVideoInfoFromPython(url);
    console.log("[INFO] Got video info:", info.title);

    const video: VideoInfoResponse = {
      id: info.id,
      url: `https://www.youtube.com/watch?v=${info.id}`,
      title: info.title || "Unknown Title",
      description: info.description || "",
      thumbnail: info.thumbnail || `https://img.youtube.com/vi/${info.id}/maxresdefault.jpg`,
      duration: info.duration || 0,
      uploadDate: "Unknown",
      viewCount: info.view_count || 0,
      likeCount: undefined,
      channel: info.uploader || "Unknown",
      channelUrl: "",
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
