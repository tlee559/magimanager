/**
 * Ads Image Compositor
 * Combines AI-generated backgrounds with text overlays using Sharp
 * Creates professional ad creatives with headlines, CTAs, and logos
 */

import sharp from "sharp";

// ============================================================================
// TYPES
// ============================================================================

interface TextOverlay {
  text: string;
  position: "top" | "center" | "bottom";
  style: "headline" | "subheadline" | "cta" | "body";
  alignment?: "left" | "center" | "right";
}

interface CompositeOptions {
  backgroundUrl: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  logoUrl?: string;
  logoPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  colorScheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    textColor?: string;
    ctaBackground?: string;
    ctaTextColor?: string;
  };
  outputFormat?: "jpeg" | "png" | "webp";
  outputWidth?: number;
  outputHeight?: number;
}

interface CompositeResult {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_COLORS = {
  primary: "#1a1a2e",
  secondary: "#16213e",
  accent: "#e94560",
  textColor: "#ffffff",
  ctaBackground: "#e94560",
  ctaTextColor: "#ffffff",
};

// Font sizes based on style
const FONT_SIZES = {
  headline: 48,
  subheadline: 28,
  cta: 24,
  body: 18,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch image from URL and return as buffer
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Create an SVG text element with proper styling
 */
function createTextSvg(
  text: string,
  style: "headline" | "subheadline" | "cta" | "body",
  width: number,
  color: string = "#ffffff",
  alignment: "left" | "center" | "right" = "center"
): string {
  const fontSize = FONT_SIZES[style];
  const fontWeight = style === "headline" || style === "cta" ? "bold" : "normal";
  const textAnchor = alignment === "left" ? "start" : alignment === "right" ? "end" : "middle";
  const x = alignment === "left" ? 40 : alignment === "right" ? width - 40 : width / 2;

  // Word wrap for long text
  const maxCharsPerLine = Math.floor((width - 80) / (fontSize * 0.6));
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;

  const textElements = lines
    .map((line, i) =>
      `<text x="${x}" y="${fontSize + i * lineHeight}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="${textAnchor}">${escapeXml(line)}</text>`
    )
    .join("\n");

  return `<svg width="${width}" height="${totalHeight + 20}">
    ${textElements}
  </svg>`;
}

/**
 * Create a CTA button SVG
 */
function createCtaSvg(
  text: string,
  width: number,
  bgColor: string = "#e94560",
  textColor: string = "#ffffff"
): string {
  const fontSize = FONT_SIZES.cta;
  const padding = 24;
  const buttonWidth = Math.min(text.length * fontSize * 0.7 + padding * 2, width - 80);
  const buttonHeight = fontSize + padding;
  const borderRadius = 8;
  const x = (width - buttonWidth) / 2;

  return `<svg width="${width}" height="${buttonHeight + 20}">
    <rect x="${x}" y="0" width="${buttonWidth}" height="${buttonHeight}" rx="${borderRadius}" fill="${bgColor}" />
    <text x="${width / 2}" y="${buttonHeight / 2 + fontSize / 3}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${textColor}" text-anchor="middle">${escapeXml(text)}</text>
  </svg>`;
}

/**
 * Create a gradient overlay SVG for better text readability
 */
function createGradientOverlay(width: number, height: number, position: "top" | "bottom" | "full"): string {
  let gradientDef = "";
  let rect = "";

  if (position === "top") {
    gradientDef = `<linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(0,0,0,0.7)"/>
      <stop offset="100%" style="stop-color:rgba(0,0,0,0)"/>
    </linearGradient>`;
    rect = `<rect width="${width}" height="${height * 0.4}" fill="url(#gradient)"/>`;
  } else if (position === "bottom") {
    gradientDef = `<linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(0,0,0,0)"/>
      <stop offset="100%" style="stop-color:rgba(0,0,0,0.7)"/>
    </linearGradient>`;
    rect = `<rect y="${height * 0.6}" width="${width}" height="${height * 0.4}" fill="url(#gradient)"/>`;
  } else {
    rect = `<rect width="${width}" height="${height}" fill="rgba(0,0,0,0.3)"/>`;
  }

  return `<svg width="${width}" height="${height}">
    <defs>${gradientDef}</defs>
    ${rect}
  </svg>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================================
// MAIN COMPOSITOR FUNCTION
// ============================================================================

/**
 * Composite ad creative from background image and text overlays
 */
export async function compositeAdImage(options: CompositeOptions): Promise<CompositeResult> {
  const {
    backgroundUrl,
    headline,
    subheadline,
    ctaText,
    logoUrl,
    logoPosition = "bottom-right",
    colorScheme = {},
    outputFormat = "jpeg",
    outputWidth,
    outputHeight,
  } = options;

  const colors = { ...DEFAULT_COLORS, ...colorScheme };

  // Fetch background image
  const backgroundBuffer = await fetchImageBuffer(backgroundUrl);

  // Get image metadata
  const metadata = await sharp(backgroundBuffer).metadata();
  const width = outputWidth || metadata.width || 1200;
  const height = outputHeight || metadata.height || 628;

  // Start with the background, resize if needed
  let composite = sharp(backgroundBuffer).resize(width, height, {
    fit: "cover",
    position: "center",
  });

  // Build composite layers
  const layers: { input: Buffer; top: number; left: number }[] = [];

  // Add gradient overlay for text readability
  if (headline || subheadline || ctaText) {
    const gradientPosition = ctaText ? "bottom" : headline ? "top" : "full";
    const gradientSvg = createGradientOverlay(width, height, gradientPosition);
    layers.push({
      input: Buffer.from(gradientSvg),
      top: 0,
      left: 0,
    });
  }

  // Add headline at top
  if (headline) {
    const headlineSvg = createTextSvg(headline, "headline", width, colors.textColor);
    const headlineBuffer = await sharp(Buffer.from(headlineSvg))
      .png()
      .toBuffer();
    const headlineMeta = await sharp(headlineBuffer).metadata();

    layers.push({
      input: headlineBuffer,
      top: 60,
      left: 0,
    });
  }

  // Add subheadline below headline
  if (subheadline) {
    const subheadlineSvg = createTextSvg(subheadline, "subheadline", width, colors.textColor);
    const subheadlineBuffer = await sharp(Buffer.from(subheadlineSvg))
      .png()
      .toBuffer();

    const topPosition = headline ? 160 : 60;
    layers.push({
      input: subheadlineBuffer,
      top: topPosition,
      left: 0,
    });
  }

  // Add CTA button at bottom
  if (ctaText) {
    const ctaSvg = createCtaSvg(ctaText, width, colors.ctaBackground, colors.ctaTextColor);
    const ctaBuffer = await sharp(Buffer.from(ctaSvg)).png().toBuffer();
    const ctaMeta = await sharp(ctaBuffer).metadata();

    layers.push({
      input: ctaBuffer,
      top: height - (ctaMeta.height || 60) - 40,
      left: 0,
    });
  }

  // Add logo if provided
  if (logoUrl) {
    try {
      const logoBuffer = await fetchImageBuffer(logoUrl);
      const logoSize = Math.min(width, height) * 0.12; // Logo is 12% of smaller dimension
      const resizedLogo = await sharp(logoBuffer)
        .resize(Math.round(logoSize), Math.round(logoSize), {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      const margin = 20;
      let logoTop = margin;
      let logoLeft = margin;

      switch (logoPosition) {
        case "top-right":
          logoLeft = width - Math.round(logoSize) - margin;
          break;
        case "bottom-left":
          logoTop = height - Math.round(logoSize) - margin;
          break;
        case "bottom-right":
          logoTop = height - Math.round(logoSize) - margin;
          logoLeft = width - Math.round(logoSize) - margin;
          break;
      }

      layers.push({
        input: resizedLogo,
        top: logoTop,
        left: logoLeft,
      });
    } catch (err) {
      console.warn("Failed to add logo:", err);
    }
  }

  // Apply all composite layers
  if (layers.length > 0) {
    composite = composite.composite(layers);
  }

  // Output in specified format
  let output: sharp.Sharp;
  switch (outputFormat) {
    case "png":
      output = composite.png({ quality: 90 });
      break;
    case "webp":
      output = composite.webp({ quality: 85 });
      break;
    default:
      output = composite.jpeg({ quality: 90 });
  }

  const buffer = await output.toBuffer();

  return {
    buffer,
    format: outputFormat,
    width,
    height,
  };
}

// ============================================================================
// BATCH COMPOSITING
// ============================================================================

interface BatchCompositeOptions {
  backgrounds: string[];
  headlines: string[];
  subheadlines?: string[];
  ctaTexts: string[];
  logoUrl?: string;
  colorScheme?: CompositeOptions["colorScheme"];
  formats?: Array<{ width: number; height: number; name: string }>;
}

interface BatchCompositeResult {
  variations: Array<{
    name: string;
    headline: string;
    cta: string;
    formats: Array<{
      name: string;
      width: number;
      height: number;
      buffer: Buffer;
    }>;
  }>;
}

/**
 * Generate multiple ad variations with different headlines, CTAs, and formats
 */
export async function batchComposite(options: BatchCompositeOptions): Promise<BatchCompositeResult> {
  const {
    backgrounds,
    headlines,
    subheadlines = [],
    ctaTexts,
    logoUrl,
    colorScheme,
    formats = [
      { width: 1200, height: 628, name: "facebook" },
      { width: 1080, height: 1080, name: "instagram-square" },
      { width: 300, height: 250, name: "gdn-medium-rectangle" },
      { width: 728, height: 90, name: "gdn-leaderboard" },
    ],
  } = options;

  const variations: BatchCompositeResult["variations"] = [];

  // Create variations by combining headlines and CTAs with backgrounds
  for (let i = 0; i < Math.min(headlines.length, backgrounds.length); i++) {
    const headline = headlines[i];
    const background = backgrounds[i % backgrounds.length];
    const subheadline = subheadlines[i % subheadlines.length] || undefined;
    const cta = ctaTexts[i % ctaTexts.length];

    const formatsOutput: BatchCompositeResult["variations"][0]["formats"] = [];

    // Generate each format
    for (const format of formats) {
      try {
        const result = await compositeAdImage({
          backgroundUrl: background,
          headline,
          subheadline,
          ctaText: cta,
          logoUrl,
          colorScheme,
          outputWidth: format.width,
          outputHeight: format.height,
        });

        formatsOutput.push({
          name: format.name,
          width: format.width,
          height: format.height,
          buffer: result.buffer,
        });
      } catch (err) {
        console.error(`Failed to generate ${format.name} format:`, err);
      }
    }

    variations.push({
      name: `variation-${i + 1}`,
      headline,
      cta,
      formats: formatsOutput,
    });
  }

  return { variations };
}

// ============================================================================
// STANDARD AD FORMATS
// ============================================================================

export const AD_FORMATS = {
  // Google Display Network
  "gdn-medium-rectangle": { width: 300, height: 250 },
  "gdn-large-rectangle": { width: 336, height: 280 },
  "gdn-leaderboard": { width: 728, height: 90 },
  "gdn-half-page": { width: 300, height: 600 },
  "gdn-large-mobile-banner": { width: 320, height: 100 },

  // Facebook/Meta
  "facebook-feed": { width: 1200, height: 628 },
  "facebook-story": { width: 1080, height: 1920 },
  "facebook-carousel": { width: 1080, height: 1080 },

  // Instagram
  "instagram-square": { width: 1080, height: 1080 },
  "instagram-portrait": { width: 1080, height: 1350 },
  "instagram-story": { width: 1080, height: 1920 },

  // LinkedIn
  "linkedin-single": { width: 1200, height: 627 },
  "linkedin-square": { width: 1200, height: 1200 },

  // Twitter/X
  "twitter-single": { width: 1200, height: 675 },
  "twitter-card": { width: 800, height: 418 },
};

export type AdFormatKey = keyof typeof AD_FORMATS;
