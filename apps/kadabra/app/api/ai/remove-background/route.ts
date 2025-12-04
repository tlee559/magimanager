import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";

export const maxDuration = 60;

// Remove background using Replicate's RMBG model
async function removeBackground(imageUrl: string): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  const model = "cjwbw/rembg";
  const endpoint = `https://api.replicate.com/v1/models/${model}/predictions`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      input: {
        image: imageUrl,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Background removal failed");
  }

  const data = await response.json();

  // If completed immediately
  if (data.status === "succeeded" && data.output) {
    return data.output;
  }

  // Poll for completion
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
      return result.output;
    }

    throw new Error(result.error || "Background removal timed out");
  }

  throw new Error("Background removal failed");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // If base64, upload to Vercel Blob first
    let processableUrl = imageUrl;
    if (imageUrl.startsWith("data:")) {
      const base64Data = imageUrl.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      const blob = await put(
        `ai-images/products/${session.user.id}/${Date.now()}-original.png`,
        buffer,
        {
          access: "public",
          contentType: "image/png",
        }
      );
      processableUrl = blob.url;
    }

    // Remove background
    const transparentUrl = await removeBackground(processableUrl);

    // Upload the result to our blob storage for persistence
    const transparentResponse = await fetch(transparentUrl);
    const transparentBuffer = Buffer.from(await transparentResponse.arrayBuffer());
    const savedBlob = await put(
      `ai-images/products/${session.user.id}/${Date.now()}-transparent.png`,
      transparentBuffer,
      {
        access: "public",
        contentType: "image/png",
      }
    );

    return NextResponse.json({
      success: true,
      originalUrl: processableUrl,
      transparentUrl: savedBlob.url,
    });
  } catch (error) {
    console.error("Background removal error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to remove background",
      },
      { status: 500 }
    );
  }
}
