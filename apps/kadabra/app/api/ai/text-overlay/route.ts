import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { createFontFaceCSS, type FontWeight } from "../../../../lib/fonts/inter-base64";
import type { TextLayer } from "../../../../lib/text-overlay/types";

export const maxDuration = 60;

interface TextOverlayRequest {
  imageUrl: string;
  layers: TextLayer[];
}

// Convert hex color to RGBA
function hexToRgba(hex: string, opacity: number = 1): string {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Word wrap text to fit within max width
function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number
): string[] {
  // Estimate character width (rough approximation for Inter font)
  const avgCharWidth = fontSize * 0.55;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    // Handle explicit line breaks
    const parts = word.split("\n");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i > 0) {
        // New line from explicit break
        if (currentLine) lines.push(currentLine);
        currentLine = part;
      } else {
        const testLine = currentLine ? `${currentLine} ${part}` : part;
        if (testLine.length > maxCharsPerLine && currentLine) {
          lines.push(currentLine);
          currentLine = part;
        } else {
          currentLine = testLine;
        }
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Get text anchor for alignment
function getTextAnchor(align: "left" | "center" | "right"): string {
  switch (align) {
    case "left":
      return "start";
    case "right":
      return "end";
    default:
      return "middle";
  }
}

// Create SVG for a single text layer
function createTextLayerSvg(
  layer: TextLayer,
  imageWidth: number,
  imageHeight: number
): { svg: string; width: number; height: number } {
  const scaledFontSize = layer.fontSize * layer.scale;
  const lineHeight = scaledFontSize * 1.3;
  const padding = layer.backgroundPadding;

  // Calculate max text width (80% of image by default)
  const maxTextWidth = imageWidth * 0.8;
  const lines = wrapText(layer.text, scaledFontSize, maxTextWidth);

  // Calculate dimensions
  const avgCharWidth = scaledFontSize * 0.55;
  const textWidth = Math.max(...lines.map((line) => line.length * avgCharWidth));
  const textHeight = lines.length * lineHeight;

  const boxWidth = Math.ceil(textWidth + padding * 2);
  const boxHeight = Math.ceil(textHeight + padding * 2);

  // Get font CSS
  const fontWeight = layer.fontWeight as FontWeight;
  const fontCSS = createFontFaceCSS(fontWeight);

  // Build SVG
  let svg = `<svg width="${boxWidth}" height="${boxHeight}" xmlns="http://www.w3.org/2000/svg">`;

  // Add font styles
  svg += `<style>${fontCSS}</style>`;

  // Background rectangle
  if (layer.backgroundColor) {
    const bgColor = hexToRgba(layer.backgroundColor, layer.backgroundOpacity);
    svg += `<rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="${layer.backgroundRadius}" ry="${layer.backgroundRadius}" fill="${bgColor}"/>`;
  }

  // Text element
  const textColor = layer.color;
  const hasStroke = layer.strokeColor && layer.strokeWidth > 0;

  svg += `<text
    font-family="'Inter', system-ui, -apple-system, sans-serif"
    font-size="${scaledFontSize}"
    font-weight="${layer.fontWeight}"
    text-anchor="${getTextAnchor(layer.textAlign)}"
    fill="${textColor}"
    ${hasStroke ? `stroke="${layer.strokeColor}" stroke-width="${layer.strokeWidth}" paint-order="stroke"` : ""}
  >`;

  // Position text lines
  lines.forEach((line, index) => {
    const yPos = padding + scaledFontSize + index * lineHeight;
    let xPos: number;

    switch (layer.textAlign) {
      case "left":
        xPos = padding;
        break;
      case "right":
        xPos = boxWidth - padding;
        break;
      default:
        xPos = boxWidth / 2;
    }

    svg += `<tspan x="${xPos}" y="${yPos}">${escapeXml(line)}</tspan>`;
  });

  svg += "</text></svg>";

  return { svg, width: boxWidth, height: boxHeight };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: TextOverlayRequest = await req.json();
    const { imageUrl, layers } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    if (!layers || layers.length === 0) {
      return NextResponse.json(
        { error: "At least one text layer is required" },
        { status: 400 }
      );
    }

    // Fetch the source image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Get image dimensions
    const imageMeta = await sharp(imageBuffer).metadata();
    const imgWidth = imageMeta.width || 1024;
    const imgHeight = imageMeta.height || 1024;

    // Sort layers by zIndex
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    // Build composite operations for each layer
    const compositeOperations: sharp.OverlayOptions[] = [];

    for (const layer of sortedLayers) {
      if (!layer.text.trim()) continue;

      // Create SVG for this layer
      const { svg, width: svgWidth, height: svgHeight } = createTextLayerSvg(
        layer,
        imgWidth,
        imgHeight
      );

      // Convert SVG to buffer
      let layerBuffer: Buffer = Buffer.from(svg);

      // Apply rotation if needed
      if (layer.rotation !== 0) {
        layerBuffer = await sharp(layerBuffer)
          .rotate(layer.rotation, {
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
      }

      // Get final layer dimensions
      const layerMeta = await sharp(layerBuffer).metadata();
      const finalWidth = layerMeta.width || svgWidth;
      const finalHeight = layerMeta.height || svgHeight;

      // Calculate position (layer x,y is center point as percentage)
      const centerX = (layer.x / 100) * imgWidth;
      const centerY = (layer.y / 100) * imgHeight;
      const left = Math.round(centerX - finalWidth / 2);
      const top = Math.round(centerY - finalHeight / 2);

      compositeOperations.push({
        input: layerBuffer,
        left: Math.max(0, Math.min(left, imgWidth - finalWidth)),
        top: Math.max(0, Math.min(top, imgHeight - finalHeight)),
        blend: "over" as const,
      });
    }

    // Composite all layers onto the image
    const composited = await sharp(imageBuffer)
      .composite(compositeOperations)
      .png()
      .toBuffer();

    // Upload to Vercel Blob
    const blob = await put(
      `ai-images/text-overlay/${session.user.id}/${Date.now()}.png`,
      composited,
      {
        access: "public",
        contentType: "image/png",
      }
    );

    return NextResponse.json({
      success: true,
      imageUrl: blob.url,
    });
  } catch (error) {
    console.error("Text overlay error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to add text overlay",
      },
      { status: 500 }
    );
  }
}
