/**
 * AI Services for Website Generator
 *
 * Integrates with Google's Gemini (text) and Imagen (images) APIs.
 */

import { NicheType, ColorTheme } from "./presets";
import { GeneratedContent } from "./assembler";

// ============================================================================
// Types
// ============================================================================

export interface GenerateContentOptions {
  apiKey: string;
  niche: NicheType;
  description: string;
  domain: string;
  featureCount?: number; // 2-5 features, defaults to random
}

export interface GenerateImagesOptions {
  apiKey: string;
  niche: NicheType;
  description: string;
  siteName: string;
  colors: ColorTheme;
  featureCount?: number; // 2-5 features
}

// ============================================================================
// Gemini Content Generation
// ============================================================================

// Use latest Gemini 2.0 Flash model
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Copywriting style variations for more unique content
const COPYWRITING_STYLES = [
  {
    name: "bold",
    tone: "Bold, confident, and exciting. Use powerful action words and create urgency.",
    adjectives: "epic, legendary, ultimate, massive, incredible"
  },
  {
    name: "elegant",
    tone: "Sophisticated, refined, and luxurious. Use elegant language that conveys exclusivity.",
    adjectives: "exquisite, refined, premium, distinguished, exceptional"
  },
  {
    name: "playful",
    tone: "Fun, energetic, and casual. Use playful language with a sense of adventure.",
    adjectives: "amazing, awesome, fantastic, thrilling, exciting"
  },
  {
    name: "professional",
    tone: "Trustworthy, reliable, and straightforward. Use clear, professional language.",
    adjectives: "trusted, reliable, secure, proven, quality"
  },
  {
    name: "edgy",
    tone: "Modern, bold, and slightly rebellious. Use punchy, memorable phrases.",
    adjectives: "bold, fierce, unstoppable, elite, next-level"
  }
];

function buildContentPrompt(niche: NicheType, description: string, domain: string, featureCount: number): string {
  const siteName = domain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  const style = COPYWRITING_STYLES[Math.floor(Math.random() * COPYWRITING_STYLES.length)];

  // Build dynamic feature fields based on count
  const featureFields: string[] = [];
  const featureDescriptions: string[] = [];

  for (let i = 1; i <= featureCount; i++) {
    featureFields.push(`  "feature${i}Title": "Feature ${i} title (3-5 words)"`);
    featureFields.push(`  "feature${i}Description": "Feature ${i} description (20-30 words)"`);

    if (niche === "social-casino") {
      if (i === 1) featureDescriptions.push(`Feature 1: About the games/slots`);
      else if (i === 2) featureDescriptions.push(`Feature 2: About free play/no cost`);
      else if (i === 3) featureDescriptions.push(`Feature 3: About the experience/fun`);
      else if (i === 4) featureDescriptions.push(`Feature 4: About bonuses/rewards`);
      else if (i === 5) featureDescriptions.push(`Feature 5: About community/social`);
    }
  }

  if (niche === "social-casino") {
    return `You are a professional copywriter for social gaming websites. Create compelling, unique marketing copy for a FREE-TO-PLAY social casino website.

COPYWRITING STYLE: ${style.name.toUpperCase()}
- Tone: ${style.tone}
- Use words like: ${style.adjectives}

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
- Number of features to generate: ${featureCount}

Feature themes:
${featureDescriptions.join("\n")}

Generate a JSON response with these exact fields (all strings):
{
  "siteName": "${siteName}",
  "tagline": "A short, catchy tagline (5-8 words)",
  "metaDescription": "SEO meta description (150-160 chars)",
  "heroHeadline": "Main headline that excites visitors (6-10 words)",
  "heroSubheadline": "Supporting text that explains the fun (15-25 words)",
  "heroCtaText": "Call to action button text (2-4 words)",
  "featuresTitle": "Section title for features (3-5 words)",
${featureFields.join(",\n")},
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

COPYWRITING STYLE: ${style.name.toUpperCase()}
- Tone: ${style.tone}

Website Details:
- Domain: ${domain}
- Site Name: ${siteName}
- Description: ${description}
- Number of features to generate: ${featureCount}

Generate a JSON response with these exact fields (all strings):
{
  "siteName": "${siteName}",
  "tagline": "A short, catchy tagline",
  "metaDescription": "SEO meta description",
  "heroHeadline": "Main headline",
  "heroSubheadline": "Supporting text",
  "heroCtaText": "Call to action text",
  "featuresTitle": "Features section title",
${featureFields.join(",\n")},
  "aboutTitle": "About section title",
  "aboutDescription": "About section content",
  "footerTagline": "Footer tagline"
}

Return ONLY valid JSON, no markdown code blocks or extra text.`;
}

export async function generateContent(options: GenerateContentOptions): Promise<GeneratedContent> {
  const { apiKey, niche, description, domain } = options;
  // Random feature count between 2-5 if not specified
  const featureCount = options.featureCount || Math.floor(Math.random() * 4) + 2;

  const prompt = buildContentPrompt(niche, description, domain, featureCount);

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

// Use Imagen 4 model (Imagen 3 was deprecated)
const IMAGEN_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict";

function buildImagePrompt(
  type: "hero" | "feature",
  featureIndex: number,
  niche: NicheType,
  description: string,
  siteName: string,
  colors: ColorTheme
): string {
  // Extract the theme from the description to make images match the user's vision
  const theme = description.trim();
  const colorDesc = `Color palette: ${colors.name} theme with ${colors.primary} as primary color and ${colors.secondary} as accent`;

  if (niche === "social-casino") {
    if (type === "hero") {
      return `Professional casino website hero image themed around "${theme}".
Create a stunning, immersive scene that captures the essence of ${theme} combined with casino excitement.
The image should feature: slot machines or casino elements stylized to match the ${theme} theme, dramatic lighting effects, sparkling coins and gems, magical atmosphere.
${colorDesc}. Dark luxurious background with glowing neon accents.
Style: High-end digital art, cinematic lighting, 16:9 aspect ratio.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`;
    }

    // Feature image prompts with variety
    const featurePrompts = [
      `Casino slot machine reels themed around "${theme}".
Design unique slot symbols inspired by ${theme} - creative icons that match this theme (not generic fruit symbols).
The symbols should glow with magical light effects, sparkles and particles floating around.
${colorDesc}. Dark moody background with depth.
Style: Professional digital illustration, game art quality.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,

      `Treasure and rewards themed around "${theme}".
A pile of golden virtual coins, gems, and treasures styled to match ${theme}.
Include themed elements related to ${theme} mixed with classic casino rewards (chips, coins, gems).
Sparkling magical effects, rays of light, luxurious feel.
${colorDesc}. Dark background with dramatic lighting.
Style: High quality 3D render, game art aesthetic.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,

      `Exciting casino jackpot moment themed around "${theme}".
A dynamic scene showing a winning moment with themed symbols, golden light rays, and celebration effects.
Include elements from ${theme} in the celebration.
${colorDesc}. Dramatic lighting with energy and excitement.
Style: Dynamic digital art, vibrant and energetic.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,

      `VIP lounge atmosphere themed around "${theme}".
An elegant scene showing premium gaming environment with ${theme} elements.
Luxurious setting with velvet, gold accents, and sophisticated atmosphere.
${colorDesc}. Rich, premium feel with ambient lighting.
Style: High-end photography style, luxury aesthetic.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,

      `Social gaming community themed around "${theme}".
An abstract representation of community and connection with ${theme} elements.
Multiple glowing orbs or avatars connected by golden light streams.
${colorDesc}. Warm, welcoming atmosphere.
Style: Modern digital art, social and inclusive feel.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,
    ];

    return featurePrompts[featureIndex % featurePrompts.length];
  }

  // Default prompts for other niches
  if (type === "hero") {
    return `Professional website hero image themed around "${theme}".
Create an elegant, modern scene that captures the essence of ${theme}.
${colorDesc}. Clean, premium aesthetic with subtle gradients.
Style: High quality digital art, 16:9 aspect ratio.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`;
  }

  const defaultFeaturePrompts = [
    `Feature illustration themed around "${theme}".
Create an icon or scene representing a key aspect of ${theme}.
${colorDesc}. Professional, modern style.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,

    `Feature illustration themed around "${theme}".
Create an icon or scene representing value and benefits related to ${theme}.
${colorDesc}. Professional, modern style.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,

    `Feature illustration themed around "${theme}".
Create an icon or scene representing innovation and quality related to ${theme}.
${colorDesc}. Professional, modern style.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,

    `Feature illustration themed around "${theme}".
Create an icon or scene representing trust and reliability related to ${theme}.
${colorDesc}. Professional, modern style.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,

    `Feature illustration themed around "${theme}".
Create an icon or scene representing growth and success related to ${theme}.
${colorDesc}. Professional, modern style.
IMPORTANT: No text, no logos, no words, no letters. Pure visual imagery only.`,
  ];

  return defaultFeaturePrompts[featureIndex % defaultFeaturePrompts.length];
}

async function generateSingleImage(
  apiKey: string,
  prompt: string
): Promise<Buffer> {
  console.log("[Imagen] Generating image with prompt:", prompt.substring(0, 100) + "...");

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
    console.error("[Imagen] API error status:", response.status);
    console.error("[Imagen] API error:", errorText);

    // If Imagen fails, generate a placeholder
    return generatePlaceholderImage();
  }

  const data = await response.json();
  console.log("[Imagen] Response keys:", Object.keys(data));

  // Extract base64 image from response
  const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64Image) {
    console.warn("[Imagen] No bytesBase64Encoded in response:", JSON.stringify(data).substring(0, 500));
    return generatePlaceholderImage();
  }

  const imageBuffer = Buffer.from(base64Image, "base64");
  console.log("[Imagen] Generated image size:", imageBuffer.length, "bytes");
  return imageBuffer;
}

function generatePlaceholderImage(): Buffer {
  // Return a minimal valid PNG - a 100x56 dark gradient placeholder (16:9 aspect)
  // This is a pre-encoded PNG with a dark purple-to-blue gradient
  // Created to ensure images always render, even when Imagen API fails
  const placeholderPngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAGQAAAA4CAYAAAALrl8OAAAA" +
    "GXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAA" +
    "AhRJREFUeNrs2zFuwzAMBVB7yNl6g57AR+gNeoIeIUfI0KFD" +
    "hwwdMnRI0aFDh87pUBQxYkn+JKUkgPBBQBL8+EdZdnZ9fX1+" +
    "fn5+gYiIiIiIiIiIiEh0fXl+fn5+fn4GAAAAAAAAAGi4urq6" +
    "vr6+vgYAAAAAAACgob+/v7+/v78HAAAAAAAAoOHy8vLy8vLy" +
    "EgAAAAAAAICP/v7+/v7+/h4AAAAAAACAj76+vr6+vr4GAAAA" +
    "AAAAoKG7u7u7u7u7BwAAAAAAAODf/f39/f39/QMAAAAAAADg" +
    "35eXl5eXl5cHAAAAAAAA4N/d3d3d3d3dAwAAAAAAAPDv5ubm" +
    "5ubm5gEAAAAAAADg393d3d3d3d0DAAAAAAAA8O/m5ubm5ubm" +
    "AQAAAAAAANC8u7u7u7u7uwcAAAAAAADg393d3d3d3d0DAAAA" +
    "AAAA8G9vb29vb29vDwAAAAAAACj6/Pz8/Pz8/AIAAAAAAABo" +
    "6O3t7e3t7e0BAAAAAAAAaDg7Ozs7Ozs7AwAAAAAAAGg4PT09" +
    "PT09PQMAAAAAAAC0ury8vLy8vLwEAAAAAAAAoOHk5OTk5OTk" +
    "BAAAAAAAAKDh+Pj4+Pj4+AIAAAAAAAC06u7u7u7u7u4OAAAA" +
    "AAAAoOH09PT09PT0BAAAAAAAAKB5d3d3d3d3dw8AAAAAAABQ" +
    "9PHx8fHx8fEFAAAAAAAAoOHq6urq6urqCgAAAAAAAGheXl5e" +
    "Xl5eXgIAAAAqKioqAgAAAA==";

  return Buffer.from(placeholderPngBase64, "base64");
}

export interface GeneratedImagesResult {
  hero: Buffer;
  features: Buffer[];
}

export async function generateImages(options: GenerateImagesOptions): Promise<GeneratedImagesResult> {
  const { apiKey, niche, description, siteName, colors } = options;
  const featureCount = options.featureCount || 3;

  // Generate hero image
  const heroPromise = generateSingleImage(
    apiKey,
    buildImagePrompt("hero", 0, niche, description, siteName, colors)
  );

  // Generate feature images in parallel
  const featurePromises = [];
  for (let i = 0; i < featureCount; i++) {
    featurePromises.push(
      generateSingleImage(
        apiKey,
        buildImagePrompt("feature", i, niche, description, siteName, colors)
      )
    );
  }

  const [hero, ...features] = await Promise.all([heroPromise, ...featurePromises]);

  return { hero, features };
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
  featureCount?: number; // 2-5, defaults to random
  onProgress?: (stage: string, percentage: number) => void;
}

export interface GeneratedWebsiteContent {
  content: GeneratedContent;
  images: GeneratedImagesResult;
  featureCount: number;
}

export async function generateWebsiteContent(
  options: GenerateWebsiteContentOptions
): Promise<GeneratedWebsiteContent> {
  const { apiKey, niche, description, domain, colors, onProgress } = options;
  // Random feature count between 2-5 if not specified
  const featureCount = options.featureCount || Math.floor(Math.random() * 4) + 2;

  // Stage 1: Generate copy
  onProgress?.("Generating copy...", 10);
  const content = await generateContent({
    apiKey,
    niche,
    description,
    domain,
    featureCount,
  });

  // Stage 2: Generate hero image
  onProgress?.("Creating hero image...", 30);
  const heroPrompt = buildImagePrompt("hero", 0, niche, description, content.siteName, colors);
  const hero = await generateSingleImage(apiKey, heroPrompt);

  // Stage 3: Generate feature images in parallel
  onProgress?.("Creating feature images...", 50);
  const featurePromises = [];
  for (let i = 0; i < featureCount; i++) {
    featurePromises.push(
      generateSingleImage(
        apiKey,
        buildImagePrompt("feature", i, niche, description, content.siteName, colors)
      )
    );
  }
  const features = await Promise.all(featurePromises);

  onProgress?.("Assembling website...", 90);

  return {
    content,
    images: { hero, features },
    featureCount,
  };
}
