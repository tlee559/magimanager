/**
 * AI Services for Website Generator
 *
 * Integrates with Google's Gemini (text) and Imagen (images) APIs.
 */

import { NicheType, ColorTheme } from "./presets";
import { GeneratedContent, GeneratedImages } from "./assembler";

// ============================================================================
// Types
// ============================================================================

export interface GenerateContentOptions {
  apiKey: string;
  niche: NicheType;
  description: string;
  domain: string;
}

export interface GenerateImagesOptions {
  apiKey: string;
  niche: NicheType;
  description: string;
  siteName: string;
  colors: ColorTheme;
}

// ============================================================================
// Gemini Content Generation
// ============================================================================

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

function buildContentPrompt(niche: NicheType, description: string, domain: string): string {
  const siteName = domain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  if (niche === "social-casino") {
    return `You are a professional copywriter for social gaming websites. Create compelling, unique marketing copy for a FREE-TO-PLAY social casino website.

IMPORTANT REQUIREMENTS:
- This is NOT real gambling - emphasize it's for entertainment only
- No real money is involved - virtual credits only
- Must be 18+ appropriate but fun and exciting
- Avoid generic phrases - be creative and unique
- Make the copy feel premium and trustworthy

Website Details:
- Domain: ${domain}
- Site Name: ${siteName}
- User's Description: ${description}

Generate a JSON response with these exact fields (all strings):
{
  "siteName": "${siteName}",
  "tagline": "A short, catchy tagline (5-8 words)",
  "metaDescription": "SEO meta description (150-160 chars)",
  "heroHeadline": "Main headline that excites visitors (6-10 words)",
  "heroSubheadline": "Supporting text that explains the fun (15-25 words)",
  "heroCtaText": "Call to action button text (2-4 words)",
  "featuresTitle": "Section title for features (3-5 words)",
  "feature1Title": "First feature title about the games (3-5 words)",
  "feature1Description": "Description of games/slots available (20-30 words)",
  "feature2Title": "Second feature title about free play (3-5 words)",
  "feature2Description": "Description emphasizing no cost/risk (20-30 words)",
  "feature3Title": "Third feature about experience/fun (3-5 words)",
  "feature3Description": "Description of the entertainment value (20-30 words)",
  "aboutTitle": "About section title (3-5 words)",
  "aboutDescription": "About the site and its entertainment value (40-60 words)",
  "footerTagline": "Short footer tagline (5-10 words)",
  "gameName": "Name for the slot machine game (2-4 words)",
  "gameTagline": "Short game tagline (5-8 words)"
}

Return ONLY valid JSON, no markdown code blocks or extra text.`;
  }

  // Default prompt for other niches (future expansion)
  return `You are a professional copywriter. Create compelling marketing copy for a website.

Website Details:
- Domain: ${domain}
- Site Name: ${siteName}
- Description: ${description}

Generate a JSON response with these exact fields (all strings):
{
  "siteName": "${siteName}",
  "tagline": "A short, catchy tagline",
  "metaDescription": "SEO meta description",
  "heroHeadline": "Main headline",
  "heroSubheadline": "Supporting text",
  "heroCtaText": "Call to action text",
  "featuresTitle": "Features section title",
  "feature1Title": "First feature title",
  "feature1Description": "First feature description",
  "feature2Title": "Second feature title",
  "feature2Description": "Second feature description",
  "feature3Title": "Third feature title",
  "feature3Description": "Third feature description",
  "aboutTitle": "About section title",
  "aboutDescription": "About section content",
  "footerTagline": "Footer tagline"
}

Return ONLY valid JSON, no markdown code blocks or extra text.`;
}

export async function generateContent(options: GenerateContentOptions): Promise<GeneratedContent> {
  const { apiKey, niche, description, domain } = options;

  const prompt = buildContentPrompt(niche, description, domain);

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract text from response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No content generated from Gemini");
  }

  // Clean up the response (remove markdown code blocks if present)
  let jsonText = text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```\n?$/g, "");
  }

  try {
    const content = JSON.parse(jsonText) as GeneratedContent;
    return content;
  } catch (parseError) {
    console.error("Failed to parse Gemini response:", jsonText);
    throw new Error(`Failed to parse content: ${parseError}`);
  }
}

// ============================================================================
// Imagen Image Generation
// ============================================================================

const IMAGEN_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict";

function buildImagePrompt(
  type: "hero" | "feature1" | "feature2",
  niche: NicheType,
  description: string,
  siteName: string,
  colors: ColorTheme
): string {
  const colorDesc = `with ${colors.name.toLowerCase()} color scheme featuring ${colors.primary} purple and ${colors.secondary} gold tones`;

  if (niche === "social-casino") {
    switch (type) {
      case "hero":
        return `Professional casino website hero image, ${colorDesc}. Glamorous slot machines with glowing lights, sparkling gold coins and gems floating in the air, dramatic lighting effects, luxury casino atmosphere. Dark background with neon accents. No text or logos. High quality digital art, 16:9 aspect ratio.`;

      case "feature1":
        return `Detailed slot machine reels showing colorful fruit symbols and lucky 7s, ${colorDesc}. Cherries, lemons, diamonds, and stars glowing with golden light. Sparkles and light effects. Dark moody background. No text. Professional digital illustration.`;

      case "feature2":
        return `Pile of golden virtual coins and colorful casino chips, ${colorDesc}. Treasure chest overflowing with gems and gold. Sparkling magical effect, rays of light. Dark luxurious background. Represents free credits and rewards. No text. High quality 3D render style.`;
    }
  }

  // Default prompts for other niches
  switch (type) {
    case "hero":
      return `Professional website hero image, ${colorDesc}. Modern, clean design. Abstract shapes and gradients. No text. High quality digital art, 16:9 aspect ratio.`;

    case "feature1":
      return `Feature illustration, ${colorDesc}. Professional, modern style. Abstract representation of technology or service. No text.`;

    case "feature2":
      return `Feature illustration, ${colorDesc}. Professional, modern style. Abstract representation of value or benefits. No text.`;
  }

  return "";
}

async function generateSingleImage(
  apiKey: string,
  prompt: string
): Promise<Buffer> {
  const response = await fetch(`${IMAGEN_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        safetyFilterLevel: "block_some",
        personGeneration: "dont_allow",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Imagen API error:", errorText);

    // If Imagen fails, generate a placeholder
    return generatePlaceholderImage();
  }

  const data = await response.json();

  // Extract base64 image from response
  const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64Image) {
    console.warn("No image generated, using placeholder");
    return generatePlaceholderImage();
  }

  return Buffer.from(base64Image, "base64");
}

function generatePlaceholderImage(): Buffer {
  // Generate a simple SVG placeholder that can be used as PNG
  // In production, you might want to use a proper placeholder image
  const svg = `
    <svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#16213e"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <circle cx="600" cy="337" r="100" fill="#6B21A8" opacity="0.5"/>
      <circle cx="500" cy="400" r="60" fill="#F59E0B" opacity="0.3"/>
      <circle cx="700" cy="280" r="80" fill="#10B981" opacity="0.3"/>
    </svg>
  `;

  // Convert SVG to PNG would require additional library
  // For now, return SVG as buffer (frontend can handle both)
  return Buffer.from(svg);
}

export async function generateImages(options: GenerateImagesOptions): Promise<GeneratedImages> {
  const { apiKey, niche, description, siteName, colors } = options;

  // Generate all three images in parallel
  const [hero, feature1, feature2] = await Promise.all([
    generateSingleImage(
      apiKey,
      buildImagePrompt("hero", niche, description, siteName, colors)
    ),
    generateSingleImage(
      apiKey,
      buildImagePrompt("feature1", niche, description, siteName, colors)
    ),
    generateSingleImage(
      apiKey,
      buildImagePrompt("feature2", niche, description, siteName, colors)
    ),
  ]);

  return { hero, feature1, feature2 };
}

// ============================================================================
// Combined Generation
// ============================================================================

export interface GenerateWebsiteContentOptions {
  apiKey: string;
  niche: NicheType;
  description: string;
  domain: string;
  colors: ColorTheme;
  onProgress?: (stage: string, percentage: number) => void;
}

export interface GeneratedWebsiteContent {
  content: GeneratedContent;
  images: GeneratedImages;
}

export async function generateWebsiteContent(
  options: GenerateWebsiteContentOptions
): Promise<GeneratedWebsiteContent> {
  const { apiKey, niche, description, domain, colors, onProgress } = options;

  // Stage 1: Generate copy
  onProgress?.("Generating copy...", 10);
  const content = await generateContent({
    apiKey,
    niche,
    description,
    domain,
  });

  // Stage 2: Generate images
  onProgress?.("Creating hero image...", 30);
  const heroPrompt = buildImagePrompt("hero", niche, description, content.siteName, colors);
  const hero = await generateSingleImage(apiKey, heroPrompt);

  onProgress?.("Creating feature images...", 60);
  const [feature1, feature2] = await Promise.all([
    generateSingleImage(
      apiKey,
      buildImagePrompt("feature1", niche, description, content.siteName, colors)
    ),
    generateSingleImage(
      apiKey,
      buildImagePrompt("feature2", niche, description, content.siteName, colors)
    ),
  ]);

  onProgress?.("Assembling website...", 90);

  return {
    content,
    images: { hero, feature1, feature2 },
  };
}
