import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
  /youtube\.com\/embed\/([^&\n?#]+)/,
  /youtube\.com\/v\/([^&\n?#]+)/,
  /youtube\.com\/shorts\/([^&\n?#]+)/,
];

function extractYouTubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

interface YouTubeOEmbedResponse {
  title: string;
  author_name: string;
  thumbnail_url: string;
  html: string;
}

interface NoEmbedResponse {
  title: string;
  author_name: string;
  thumbnail_url: string;
  duration?: number;
}

// GET /api/video-clipper/validate-youtube?url=...
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Extract video ID
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return NextResponse.json({
        valid: false,
        error: "Invalid YouTube URL. Please use a valid YouTube video link.",
      });
    }

    // Try oEmbed first (most reliable for checking if video exists)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

    try {
      const oembedResponse = await fetch(oembedUrl, {
        headers: { "Accept": "application/json" },
      });

      if (!oembedResponse.ok) {
        if (oembedResponse.status === 401 || oembedResponse.status === 403) {
          return NextResponse.json({
            valid: false,
            error: "This video is private or restricted.",
          });
        }
        if (oembedResponse.status === 404) {
          return NextResponse.json({
            valid: false,
            error: "Video not found. Please check the URL.",
          });
        }
        throw new Error(`oEmbed failed: ${oembedResponse.status}`);
      }

      const oembedData: YouTubeOEmbedResponse = await oembedResponse.json();

      // Try noembed for additional info (duration)
      let duration: number | null = null;
      try {
        const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
        const noembedResponse = await fetch(noembedUrl);
        if (noembedResponse.ok) {
          const noembedData: NoEmbedResponse = await noembedResponse.json();
          duration = noembedData.duration || null;
        }
      } catch {
        // Duration is optional, continue without it
      }

      // Get higher quality thumbnail
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      const fallbackThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      // Check if maxres thumbnail exists
      let finalThumbnail = fallbackThumbnail;
      try {
        const thumbCheck = await fetch(thumbnailUrl, { method: "HEAD" });
        if (thumbCheck.ok) {
          finalThumbnail = thumbnailUrl;
        }
      } catch {
        // Use fallback
      }

      return NextResponse.json({
        valid: true,
        videoId,
        title: oembedData.title,
        author: oembedData.author_name,
        thumbnail: finalThumbnail,
        duration, // null if unavailable
      });

    } catch (fetchError) {
      console.error("[YouTube Validate] Fetch error:", fetchError);
      return NextResponse.json({
        valid: false,
        error: "Could not validate video. Please check the URL and try again.",
      });
    }

  } catch (error) {
    console.error("[YouTube Validate] Error:", error);
    return NextResponse.json(
      { error: "Failed to validate YouTube URL" },
      { status: 500 }
    );
  }
}
