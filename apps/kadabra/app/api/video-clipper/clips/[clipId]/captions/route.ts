import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { put } from "@vercel/blob";

// Configure route for caption generation (can take a while)
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

type RouteParams = { params: Promise<{ clipId: string }> };

// POST /api/video-clipper/clips/[clipId]/captions
// Body: { captionStyle: "modern" | "minimal" | "bold" | "branded" }
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { clipId } = await params;
    const body = await req.json();
    const { captionStyle = "modern" } = body;

    // Validate caption style
    const validStyles = ["modern", "minimal", "bold", "branded"];
    if (!validStyles.includes(captionStyle)) {
      return NextResponse.json(
        { error: "Invalid caption style. Must be one of: modern, minimal, bold, branded" },
        { status: 400 }
      );
    }

    // Get clip and verify ownership
    const clip = await prisma.videoClip.findFirst({
      where: { id: clipId },
      include: { job: true },
    });

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    if (clip.job.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!clip.clipUrl) {
      return NextResponse.json(
        { error: "Clip has no video URL. Cannot add captions." },
        { status: 400 }
      );
    }

    // Check if captions already exist
    if (clip.clipWithCaptionsUrl) {
      return NextResponse.json({
        clip: {
          id: clip.id,
          clipWithCaptionsUrl: clip.clipWithCaptionsUrl,
        },
        message: "Captions already exist for this clip",
      });
    }

    // Update clip status to indicate captioning in progress
    await prisma.videoClip.update({
      where: { id: clipId },
      data: { status: "CAPTIONING" },
    });

    // Generate captions
    console.log(`[Video Clipper] Generating ${captionStyle} captions for clip ${clipId}`);
    const captionedUrl = await generateCaptionedVideo(
      clip.clipUrl,
      captionStyle,
      userId,
      clipId
    );

    if (!captionedUrl) {
      await prisma.videoClip.update({
        where: { id: clipId },
        data: { status: "COMPLETED" },
      });
      return NextResponse.json(
        { error: "Failed to generate captions" },
        { status: 500 }
      );
    }

    // Update clip with captioned video URL
    const updatedClip = await prisma.videoClip.update({
      where: { id: clipId },
      data: {
        clipWithCaptionsUrl: captionedUrl,
        status: "COMPLETED",
      },
    });

    console.log(`[Video Clipper] Captions generated successfully for clip ${clipId}`);

    return NextResponse.json({
      clip: {
        id: updatedClip.id,
        clipUrl: updatedClip.clipUrl,
        clipWithCaptionsUrl: updatedClip.clipWithCaptionsUrl,
      },
    });
  } catch (error) {
    console.error("[Video Clipper] Caption generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate captions" },
      { status: 500 }
    );
  }
}

// ============================================================================
// REPLICATE API HELPERS (copied from jobs/route.ts)
// ============================================================================

const REPLICATE_API_URL = "https://api.replicate.com/v1";

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error?: string;
}

async function callReplicate(
  modelVersion: string,
  input: Record<string, unknown>
): Promise<ReplicatePrediction> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  // Start the prediction
  const createResponse = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: modelVersion,
      input,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await createResponse.json();

  // Poll for completion
  const pollIntervalMs = 3000;
  const maxPolls = 100; // ~5 minutes

  let result = prediction;
  let pollCount = 0;

  while (
    (result.status === "starting" || result.status === "processing") &&
    pollCount < maxPolls
  ) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    pollCount++;

    const statusResponse = await fetch(
      `${REPLICATE_API_URL}/predictions/${prediction.id}`,
      {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      }
    );

    result = await statusResponse.json();

    if (pollCount % 10 === 0) {
      console.log(`[Video Clipper] Caption poll ${pollCount}/${maxPolls}: ${result.status}`);
    }
  }

  if (result.status === "failed") {
    throw new Error(`Replicate prediction failed: ${result.error}`);
  }

  if (result.status !== "succeeded") {
    throw new Error(`Replicate prediction timed out`);
  }

  return result;
}

async function downloadAndUploadToBlob(
  sourceUrl: string,
  filename: string
): Promise<{ url: string; size: number }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();

  const blob = await put(filename, Buffer.from(buffer), {
    access: "public",
    addRandomSuffix: true,
  });

  return {
    url: blob.url,
    size: buffer.byteLength,
  };
}

// ============================================================================
// CAPTION GENERATION
// ============================================================================

async function generateCaptionedVideo(
  videoUrl: string,
  captionStyle: string,
  userId: string,
  clipId: string
): Promise<string | null> {
  // Caption style configurations for fictions-ai/autocaption model
  const styleConfigs: Record<string, {
    font: string;
    caption_color: string;
    highlight_color: string;
    stroke_color: string;
    stroke_width: number;
    font_size: number;
  }> = {
    minimal: {
      font: "Poppins-Regular",
      caption_color: "white",
      highlight_color: "white",
      stroke_color: "black",
      stroke_width: 1.5,
      font_size: 5,
    },
    modern: {
      font: "Poppins-ExtraBold",
      caption_color: "white",
      highlight_color: "yellow",
      stroke_color: "black",
      stroke_width: 2.6,
      font_size: 4,
    },
    bold: {
      font: "Poppins-Black",
      caption_color: "yellow",
      highlight_color: "white",
      stroke_color: "black",
      stroke_width: 4,
      font_size: 5,
    },
    branded: {
      font: "Poppins-Bold",
      caption_color: "#8B5CF6",
      highlight_color: "#EC4899",
      stroke_color: "black",
      stroke_width: 3,
      font_size: 4,
    },
  };

  const config = styleConfigs[captionStyle] || styleConfigs.modern;

  console.log(`[Video Clipper] Adding ${captionStyle} captions to video`);

  try {
    const captionResult = await callReplicate(
      "fictions-ai/autocaption:18a45ff0d95feb4449d192bbdc06b4a6df168fa33def76dfc51b78ae224b599b",
      {
        video_file_input: videoUrl,
        font: config.font,
        caption_color: config.caption_color,
        highlight_color: config.highlight_color,
        stroke_color: config.stroke_color,
        stroke_width: config.stroke_width,
        font_size: config.font_size,
        max_characters: 10,
        subs_position: "bottom75",
        output_video: true,
        output_transcript: false,
      }
    );

    // autocaption returns an array: [video_url, transcript_url] or just the video URL
    const output = captionResult.output;
    let captionedUrl: string | null = null;

    if (Array.isArray(output) && output.length > 0) {
      captionedUrl = output[0];
    } else if (typeof output === "string") {
      captionedUrl = output;
    }

    if (captionedUrl) {
      const captionedBlob = await downloadAndUploadToBlob(
        captionedUrl,
        `video-clipper/${userId}/${clipId}/clip_captioned.mp4`
      );
      return captionedBlob.url;
    }
  } catch (e) {
    console.error("[Video Clipper] Caption generation failed:", e);
  }

  return null;
}
