import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";

export const maxDuration = 120; // Increased for reference image processing

type Provider = "google-imagen" | "replicate-flux";
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

interface GenerateImageRequest {
  prompt: string;
  provider: Provider;
  aspectRatio?: AspectRatio;
  imageCount?: number;
  rawMode?: boolean; // FLUX only - more photorealistic
  referenceImageUrl?: string; // URL or base64 of reference image
}

// Upload base64 image to Vercel Blob and return URL
async function uploadReferenceImage(base64OrUrl: string, userId: string): Promise<string> {
  // If already a URL, return as-is
  if (base64OrUrl.startsWith("http")) {
    return base64OrUrl;
  }

  // Upload base64 to Vercel Blob
  if (base64OrUrl.startsWith("data:")) {
    const base64Data = base64OrUrl.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    const blob = await put(
      `ai-images/references/${userId}/${Date.now()}.png`,
      buffer,
      {
        access: "public",
        contentType: "image/png",
      }
    );
    return blob.url;
  }

  throw new Error("Invalid reference image format");
}

// Google Imagen 4 API - text-to-image only (reference not supported via simple API)
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
        sampleCount: Math.min(imageCount, 4),
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

  return data.predictions
    .filter((p: { bytesBase64Encoded?: string }) => p.bytesBase64Encoded)
    .map((p: { bytesBase64Encoded: string }) => `data:image/png;base64,${p.bytesBase64Encoded}`);
}

// Replicate FLUX 1.1 Pro API - text-to-image
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

  const model = rawMode
    ? "black-forest-labs/flux-1.1-pro-ultra"
    : "black-forest-labs/flux-1.1-pro";
  const endpoint = `https://api.replicate.com/v1/models/${model}/predictions`;

  const images: string[] = [];

  for (let i = 0; i < Math.min(imageCount, 4); i++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          output_format: "png",
          output_quality: 90,
          ...(rawMode && { raw: true }),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Replicate API error");
    }

    const data = await response.json();

    if (data.status === "succeeded" && data.output) {
      const url = typeof data.output === "string" ? data.output : data.output[0];
      images.push(url);
      continue;
    }

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

// FLUX Redux - Generate variations from a reference image
async function generateWithFluxRedux(
  referenceImageUrl: string,
  aspectRatio: AspectRatio = "1:1",
  imageCount: number = 1
): Promise<string[]> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  const model = "black-forest-labs/flux-redux-dev";
  const endpoint = `https://api.replicate.com/v1/models/${model}/predictions`;

  const images: string[] = [];

  for (let i = 0; i < Math.min(imageCount, 4); i++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          redux_image: referenceImageUrl,
          aspect_ratio: aspectRatio,
          num_inference_steps: 28,
          guidance: 3,
          output_format: "png",
          output_quality: 90,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Replicate FLUX Redux API error");
    }

    const data = await response.json();

    if (data.status === "succeeded" && data.output) {
      const urls = Array.isArray(data.output) ? data.output : [data.output];
      images.push(...urls);
      continue;
    }

    if (data.status === "processing" || data.status === "starting") {
      let result = data;
      let attempts = 0;
      const maxAttempts = 90;

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
        const urls = Array.isArray(result.output) ? result.output : [result.output];
        images.push(...urls);
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
      rawMode = false,
      referenceImageUrl,
    } = body;

    // Reference image mode - use FLUX Redux
    if (referenceImageUrl) {
      // Upload reference image if it's base64
      const uploadedRefUrl = await uploadReferenceImage(referenceImageUrl, session.user.id);

      const imageUrls = await generateWithFluxRedux(
        uploadedRefUrl,
        aspectRatio,
        Math.min(Math.max(1, imageCount), 4)
      );

      return NextResponse.json({
        success: true,
        imageUrls,
        provider: "replicate-flux-redux",
        prompt: "Reference image variation",
        aspectRatio,
        imageCount: imageUrls.length,
        referenceMode: true,
      });
    }

    // Normal text-to-image mode
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

    const count = Math.min(Math.max(1, imageCount), 4);

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
