import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";

export const maxDuration = 60;

type Provider = "google-imagen" | "replicate-flux";

interface GenerateImageRequest {
  prompt: string;
  provider: Provider;
}

// Google Imagen 4 API
async function generateWithGoogleImagen(prompt: string): Promise<string> {
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
        sampleCount: 1,
        aspectRatio: "1:1",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Google Imagen API error");
  }

  const data = await response.json();

  if (!data.predictions?.[0]?.bytesBase64Encoded) {
    throw new Error("No image data in response");
  }

  // Return as data URL
  return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
}

// Replicate FLUX 1.1 Pro API
async function generateWithReplicateFlux(prompt: string): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  const model = "black-forest-labs/flux-1.1-pro";
  const endpoint = `https://api.replicate.com/v1/models/${model}/predictions`;

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
        aspect_ratio: "1:1",
        output_format: "png",
        output_quality: 90,
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
    return typeof data.output === "string" ? data.output : data.output[0];
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
      return typeof result.output === "string" ? result.output : result.output[0];
    }

    throw new Error(result.error || "Generation timed out");
  }

  throw new Error("Unexpected response from Replicate");
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: GenerateImageRequest = await req.json();
    const { prompt, provider } = body;

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

    let imageUrl: string;

    if (provider === "google-imagen") {
      imageUrl = await generateWithGoogleImagen(prompt);
    } else {
      imageUrl = await generateWithReplicateFlux(prompt);
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      provider,
      prompt,
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
