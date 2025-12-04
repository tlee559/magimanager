import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import sharp from "sharp";

export const maxDuration = 30;

interface CompositeRequest {
  backgroundUrl: string;
  productUrl: string; // Should be transparent PNG
  position?: "center" | "bottom" | "bottom-left" | "bottom-right";
  scale?: number; // 0.1 to 1.0, how much of the image the product takes up
  overlayColor?: string; // hex color for background overlay (e.g., "#000000")
  overlayOpacity?: number; // 0 to 1, opacity of the overlay
}

// Get dimensions for aspect ratio
function getDimensionsForAspectRatio(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
      return { width: 1080, height: 1920 };
    case "4:3":
      return { width: 1600, height: 1200 };
    case "3:4":
      return { width: 1200, height: 1600 };
    default:
      return { width: 1024, height: 1024 };
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CompositeRequest = await req.json();
    const {
      backgroundUrl,
      productUrl,
      position = "center",
      scale = 0.6,
      overlayColor,
      overlayOpacity = 0,
    } = body;

    if (!backgroundUrl || !productUrl) {
      return NextResponse.json(
        { error: "Background and product URLs are required" },
        { status: 400 }
      );
    }

    console.log("Compositing with:", {
      backgroundUrl: backgroundUrl.substring(0, 100),
      productUrl: productUrl.substring(0, 100),
      position,
      scale,
      overlayColor: overlayColor || "none",
      overlayOpacity,
    });

    // Helper to get image buffer from URL or base64 data URL
    async function getImageBuffer(urlOrDataUrl: string): Promise<Buffer> {
      if (urlOrDataUrl.startsWith("data:")) {
        // Handle base64 data URL
        const base64Data = urlOrDataUrl.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid base64 data URL");
        }
        return Buffer.from(base64Data, "base64");
      } else {
        // Fetch from URL
        const response = await fetch(urlOrDataUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        return Buffer.from(await response.arrayBuffer());
      }
    }

    // Get both images (handles both URLs and base64 data URLs)
    const [backgroundBuffer, productBuffer] = await Promise.all([
      getImageBuffer(backgroundUrl).catch((err) => {
        console.error("Failed to get background:", err.message);
        throw new Error("Failed to load background image");
      }),
      getImageBuffer(productUrl).catch((err) => {
        console.error("Failed to get product:", err.message);
        throw new Error("Failed to load product image");
      }),
    ]);

    console.log("Loaded images:", {
      backgroundSize: backgroundBuffer.length,
      productSize: productBuffer.length,
    });

    // Get background dimensions
    const backgroundMeta = await sharp(backgroundBuffer).metadata();
    const bgWidth = backgroundMeta.width || 1024;
    const bgHeight = backgroundMeta.height || 1024;

    // Resize product to fit within the background
    const maxProductWidth = Math.floor(bgWidth * scale);
    const maxProductHeight = Math.floor(bgHeight * scale);

    const resizedProduct = await sharp(productBuffer)
      .resize(maxProductWidth, maxProductHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();

    // Get resized product dimensions
    const productMeta = await sharp(resizedProduct).metadata();
    const prodWidth = productMeta.width || maxProductWidth;
    const prodHeight = productMeta.height || maxProductHeight;

    // Calculate position
    let left: number;
    let top: number;

    switch (position) {
      case "bottom":
        left = Math.floor((bgWidth - prodWidth) / 2);
        top = bgHeight - prodHeight - Math.floor(bgHeight * 0.05);
        break;
      case "bottom-left":
        left = Math.floor(bgWidth * 0.1);
        top = bgHeight - prodHeight - Math.floor(bgHeight * 0.05);
        break;
      case "bottom-right":
        left = bgWidth - prodWidth - Math.floor(bgWidth * 0.1);
        top = bgHeight - prodHeight - Math.floor(bgHeight * 0.05);
        break;
      case "center":
      default:
        left = Math.floor((bgWidth - prodWidth) / 2);
        top = Math.floor((bgHeight - prodHeight) / 2);
        break;
    }

    // Build composite layers
    const compositeLayers: sharp.OverlayOptions[] = [];

    // Add color overlay if specified (between background and product)
    if (overlayColor && overlayOpacity > 0) {
      // Parse hex color
      const hex = overlayColor.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const alpha = Math.round(overlayOpacity * 255);

      console.log("Creating color overlay:", { r, g, b, alpha, overlayOpacity });

      // Create semi-transparent color overlay using raw RGBA buffer
      const pixels = Buffer.alloc(bgWidth * bgHeight * 4);
      for (let i = 0; i < bgWidth * bgHeight; i++) {
        pixels[i * 4] = r;
        pixels[i * 4 + 1] = g;
        pixels[i * 4 + 2] = b;
        pixels[i * 4 + 3] = alpha;
      }

      const colorOverlay = await sharp(pixels, {
        raw: {
          width: bgWidth,
          height: bgHeight,
          channels: 4,
        },
      })
        .png()
        .toBuffer();

      compositeLayers.push({
        input: colorOverlay,
        top: 0,
        left: 0,
        blend: "over" as const,
      });
    }

    // Add product on top
    compositeLayers.push({
      input: resizedProduct,
      left,
      top,
    });

    // Composite the images onto the background
    const composited = await sharp(backgroundBuffer)
      .ensureAlpha()
      .composite(compositeLayers)
      .png()
      .toBuffer();

    // Upload to Vercel Blob
    const blob = await put(
      `ai-images/composites/${session.user.id}/${Date.now()}.png`,
      composited,
      {
        access: "public",
        contentType: "image/png",
      }
    );

    return NextResponse.json({
      success: true,
      compositeUrl: blob.url,
    });
  } catch (error) {
    console.error("Image compositing error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to composite images",
      },
      { status: 500 }
    );
  }
}
