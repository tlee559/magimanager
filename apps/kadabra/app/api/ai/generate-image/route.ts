import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";

export const maxDuration = 60;

type Provider = "google-imagen" | "replicate-flux";
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

interface GenerateImageRequest {
  prompt: string;
  provider: Provider;
  aspectRatio?: AspectRatio;
  imageCount?: number;
  rawMode?: boolean; // FLUX only - more photorealistic
}

// Google Imagen 4 API
async function generateWithGoogleImagen(
  prompt: string,
  aspectRatio: AspectRatio = "1:1",
  imageCount: number = 1
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  const model = "imagen-4.0-generate-001";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: Math.min(imageCount, 4), // Max 4 images
        aspectRatio,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Google Imagen API error");
  }

  const data = await response.json();

  if (!data.predictions?.length) {
    throw new Error("No image data in response");
  }

  // Return all images as data URLs
  return data.predictions
    .filter((p: { bytesBase64Encoded?: string }) => p.bytesBase64Encoded)
    .map((p: { bytesBase64Encoded: string }) => `data:image/png;base64,${p.bytesBase64Encoded}`);
}

// Replicate FLUX 1.1 Pro API
async function generateWithReplicateFlux(
  prompt: string,
  aspectRatio: AspectRatio = "1:1",
  imageCount: number = 1,
  rawMode: boolean = false
): Promise<string[]> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  // Use Ultra model for raw mode (more photorealistic)
  const model = rawMode
    ? "black-forest-labs/flux-1.1-pro-ultra"
    : "black-forest-labs/flux-1.1-pro";
  const endpoint = `https://api.replicate.com/v1/models/${model}/predictions`;

  // Generate images sequentially (FLUX doesn't support batch in one call)
  const images: string[] = [];

  for (let i = 0; i < Math.min(imageCount, 4); i++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Prefer: "wait", // Wait for result synchronously
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          output_format: "png",
          output_quality: 90,
          ...(rawMode && { raw: true }), // Enable raw mode for ultra model
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Replicate API error");
    }

    const data = await response.json();

    // If prediction completed immediately
    if (data.status === "succeeded" && data.output) {
      const url = typeof data.output === "string" ? data.output : data.output[0];
      images.push(url);
      continue;
    }

    // If still processing, poll for result
    if (data.status === "processing" || data.status === "starting") {
      let result = data;
      let attempts = 0;
      const maxAttempts = 60;

      while (
        result.status !== "succeeded" &&
        result.status !== "failed" &&
        attempts < maxAttempts
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;

        const pollResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${data.id}`,
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
            },
          }
        );
        result = await pollResponse.json();
      }

      if (result.status === "succeeded" && result.output) {
        const url = typeof result.output === "string" ? result.output : result.output[0];
        images.push(url);
        continue;
      }

      throw new Error(result.error || "Generation timed out");
    }
  }

  if (images.length === 0) {
    throw new Error("No images generated");
  }

  return images;
}

const VALID_ASPECT_RATIOS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: GenerateImageRequest = await req.json();
    const {
      prompt,
      provider,
      aspectRatio = "1:1",
      imageCount = 1,
      rawMode = false
    } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!provider || !["google-imagen", "replicate-flux"].includes(provider)) {
      return NextResponse.json(
        { error: "Valid provider is required (google-imagen or replicate-flux)" },
        { status: 400 }
      );
    }

    if (!VALID_ASPECT_RATIOS.includes(aspectRatio)) {
      return NextResponse.json(
        { error: "Invalid aspect ratio" },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(1, imageCount), 4); // Clamp between 1-4

    let imageUrls: string[];

    if (provider === "google-imagen") {
      imageUrls = await generateWithGoogleImagen(prompt, aspectRatio, count);
    } else {
      imageUrls = await generateWithReplicateFlux(prompt, aspectRatio, count, rawMode);
    }

    return NextResponse.json({
      success: true,
      imageUrls,
      provider,
      prompt,
      aspectRatio,
      imageCount: imageUrls.length,
      rawMode: provider === "replicate-flux" ? rawMode : undefined,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate image",
      },
      { status: 500 }
    );
  }
}
