import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";

export const maxDuration = 30;

const COBALT_INSTANCES = [
  "https://cobalt-api.meowing.de",
  "https://cobalt-api.kwiatekmiki.com",
  "https://capi.3kh0.net",
];

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

async function fetchFromCobalt(url: string): Promise<Response | null> {
  for (const instance of COBALT_INSTANCES) {
    try {
      const response = await fetch(instance, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          videoQuality: "1080",
          youtubeVideoCodec: "h264",
        }),
      });

      if (response.ok) {
        return response;
      }
    } catch (error) {
      console.error(`Cobalt instance ${instance} failed:`, error);
      continue;
    }
  }
  return null;
}

async function getYouTubeVideoInfo(videoId: string): Promise<VideoInfo | null> {
  // Use YouTube's oEmbed API for basic info (no API key needed)
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
      duration: 0, // oEmbed doesn't provide duration
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

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    // Get basic video info from YouTube oEmbed
    const videoInfo = await getYouTubeVideoInfo(videoId);

    if (!videoInfo) {
      return NextResponse.json(
        { success: false, error: "Could not fetch video info. The video may be private or unavailable." },
        { status: 400 }
      );
    }

    // Verify Cobalt can handle this video
    const cobaltResponse = await fetchFromCobalt(url);

    if (!cobaltResponse) {
      return NextResponse.json(
        { success: false, error: "Download service unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const cobaltData = await cobaltResponse.json();

    if (cobaltData.status === "error") {
      return NextResponse.json(
        { success: false, error: cobaltData.error?.code || "Video cannot be downloaded" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, video: videoInfo });
  } catch (error: unknown) {
    console.error("Error fetching video info:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch video info. Please try again." },
      { status: 500 }
    );
  }
}
