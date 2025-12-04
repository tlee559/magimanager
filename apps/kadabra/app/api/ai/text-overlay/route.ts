import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import sharp from "sharp";

export const maxDuration = 30;

type TextPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type FontWeight = "normal" | "bold";

interface TextOverlayRequest {
  imageUrl: string;
  text: string;
  position?: TextPosition;
  fontSize?: number; // 12-120
  fontWeight?: FontWeight;
  color?: string; // hex color
  backgroundColor?: string; // hex color with optional alpha
  padding?: number;
  maxWidth?: number; // percentage of image width (0.5 to 1.0)
}

// Convert hex color to RGBA
function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const cleanHex = hex.replace("#", "");

  if (cleanHex.length === 8) {
    // RGBA format
    return {
      r: parseInt(cleanHex.slice(0, 2), 16),
      g: parseInt(cleanHex.slice(2, 4), 16),
      b: parseInt(cleanHex.slice(4, 6), 16),
      a: parseInt(cleanHex.slice(6, 8), 16) / 255,
    };
  }

  // RGB format
  return {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16),
    a: 1,
  };
}

// Calculate text position
function getTextPosition(
  position: TextPosition,
  imageWidth: number,
  imageHeight: number,
  textWidth: number,
  textHeight: number,
  padding: number
): { x: number; y: number } {
  const margin = Math.floor(imageWidth * 0.05);

  let x: number;
  let y: number;

  // Horizontal position
  if (position.includes("left")) {
    x = margin;
  } else if (position.includes("right")) {
    x = imageWidth - textWidth - margin;
  } else {
    x = Math.floor((imageWidth - textWidth) / 2);
  }

  // Vertical position
  if (position.startsWith("top")) {
    y = margin;
  } else if (position.startsWith("bottom")) {
    y = imageHeight - textHeight - margin;
  } else {
    y = Math.floor((imageHeight - textHeight) / 2);
  }

  return { x, y };
}

// Create text SVG overlay
function createTextSvg(
  text: string,
  fontSize: number,
  fontWeight: FontWeight,
  color: string,
  backgroundColor: string | undefined,
  padding: number,
  maxWidth: number
): { svg: string; width: number; height: number } {
  // Estimate character width (rough approximation)
  const avgCharWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.3;

  // Word wrap
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = testLine.length * avgCharWidth;

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  // Calculate dimensions
  const textWidth = Math.max(...lines.map((line) => line.length * avgCharWidth));
  const textHeight = lines.length * lineHeight;

  const boxWidth = Math.ceil(textWidth + padding * 2);
  const boxHeight = Math.ceil(textHeight + padding * 2);

  // Build SVG
  const textColor = hexToRgba(color);
  const bgColor = backgroundColor ? hexToRgba(backgroundColor) : null;

  let svgContent = `<svg width="${boxWidth}" height="${boxHeight}" xmlns="http://www.w3.org/2000/svg">`;

  // Background rectangle
  if (bgColor) {
    svgContent += `<rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="8" ry="8" fill="rgba(${bgColor.r},${bgColor.g},${bgColor.b},${bgColor.a})"/>`;
  }

  // Text lines
  svgContent += `<text
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="${fontSize}"
    font-weight="${fontWeight === "bold" ? "700" : "400"}"
    fill="rgba(${textColor.r},${textColor.g},${textColor.b},${textColor.a})"
  >`;

  lines.forEach((line, index) => {
    const yPos = padding + fontSize + index * lineHeight;
    svgContent += `<tspan x="${padding}" y="${yPos}">${escapeXml(line)}</tspan>`;
  });

  svgContent += "</text></svg>";

  return { svg: svgContent, width: boxWidth, height: boxHeight };
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: TextOverlayRequest = await req.json();
    const {
      imageUrl,
      text,
      position = "bottom-center",
      fontSize = 48,
      fontWeight = "bold",
      color = "#FFFFFF",
      backgroundColor = "#00000080",
      padding = 20,
      maxWidth = 0.8,
    } = body;

    if (!imageUrl || !text) {
      return NextResponse.json(
        { error: "Image URL and text are required" },
        { status: 400 }
      );
    }

    // Validate font size
    const clampedFontSize = Math.min(Math.max(fontSize, 12), 120);

    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Get image dimensions
    const imageMeta = await sharp(imageBuffer).metadata();
    const imgWidth = imageMeta.width || 1024;
    const imgHeight = imageMeta.height || 1024;

    // Calculate max text width based on image width
    const maxTextWidth = imgWidth * Math.min(Math.max(maxWidth, 0.5), 1.0);

    // Create text SVG
    const { svg, width: textWidth, height: textHeight } = createTextSvg(
      text,
      clampedFontSize,
      fontWeight,
      color,
      backgroundColor,
      padding,
      maxTextWidth
    );

    // Calculate position
    const { x, y } = getTextPosition(
      position,
      imgWidth,
      imgHeight,
      textWidth,
      textHeight,
      padding
    );

    // Composite text onto image
    const textBuffer = Buffer.from(svg);
    const composited = await sharp(imageBuffer)
      .composite([
        {
          input: textBuffer,
          left: Math.max(0, x),
          top: Math.max(0, y),
        },
      ])
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
        error: error instanceof Error ? error.message : "Failed to add text overlay",
      },
      { status: 500 }
    );
  }
}
