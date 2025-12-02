/**
 * AI Ads Image Creator Agent
 *
 * This agent thinks like a media buyer + creative director.
 * It generates high-converting ad creatives using:
 * - Gemini for creative strategy and prompt generation
 * - Gemini Imagen 3 for image generation
 */

import { put } from "@vercel/blob";

// =============================================================================
// GEMINI MODEL CONFIGURATION
// IMPORTANT: Always use the latest stable Gemini model.
// Update this constant when Google releases newer versions.
// Check: https://ai.google.dev/gemini-api/docs/models/gemini
// =============================================================================
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Marketing angles with descriptions
export const MARKETING_ANGLES = {
  problem_solution: {
    name: "Problem/Solution",
    description: "Show the pain, then the fix",
    bestFor: "Services, SaaS",
    promptHints: "Show contrast between struggle and success. Use before/after visual metaphors.",
  },
  social_proof: {
    name: "Social Proof",
    description: "Reviews, testimonials, user counts",
    bestFor: "E-commerce, apps",
    promptHints: "Include visual elements suggesting community, trust badges, happy customers.",
  },
  urgency_scarcity: {
    name: "Urgency/Scarcity",
    description: "Limited time, countdown, 'Only X left'",
    bestFor: "Sales, launches",
    promptHints: "Dynamic, energetic visuals. Warm colors (red, orange). Suggest motion/action.",
  },
  benefit_focused: {
    name: "Benefit-Focused",
    description: "Lead with transformation/outcome",
    bestFor: "Health, coaching",
    promptHints: "Show the end result. Happy, successful imagery. Aspirational scenes.",
  },
  curiosity: {
    name: "Curiosity/Pattern Interrupt",
    description: "Unusual visuals, open loops",
    bestFor: "Cold traffic",
    promptHints: "Unexpected, eye-catching imagery. Something that makes people stop scrolling.",
  },
  comparison: {
    name: "Comparison",
    description: "Before/after, us vs them",
    bestFor: "Products with clear advantage",
    promptHints: "Split composition. Clear visual contrast between options.",
  },
  authority: {
    name: "Authority",
    description: "Expert endorsement, certifications",
    bestFor: "B2B, premium",
    promptHints: "Professional, clean aesthetic. Trust signals. Premium quality feel.",
  },
} as const;

export type MarketingAngle = keyof typeof MARKETING_ANGLES;

interface GenerateCreativesInput {
  productDescription: string;
  productUrl: string | null;
  productImageUrl: string | null;
  logoUrl: string | null;
  headlines: string[];
  ctaText: string | null;
  targetAudience: string | null;
  goal: string;
  angles: string[];
  referenceAnalysis: Record<string, unknown> | null;
  competitorAnalysis: Record<string, unknown> | null;
  variationCount: number;
  colorScheme: Record<string, string> | null;
}

interface GeneratedCreative {
  backgroundPrompt: string;
  headline: string;
  cta: string;
  angle: string;
  rationale: string;
  imageUrl: string;
  scores: {
    hook: number;
    clarity: number;
    cta: number;
    overall: number;
  };
}

// System prompt for the Creative Director AI
const CREATIVE_DIRECTOR_PROMPT = `You are an elite Creative Director with 15+ years in performance marketing.
You've managed $100M+ in ad spend and know exactly what makes ads convert.

Your expertise:
- Direct response advertising principles
- Pattern interrupts and scroll-stopping hooks
- Emotional triggers and psychological principles
- Platform-specific best practices (GDN small sizes, Meta native feel)
- A/B testing and iterative creative optimization

When creating ads, you consider:
1. First 0.5 seconds: Does this stop the scroll?
2. Next 2 seconds: Is the value prop crystal clear?
3. CTA: Is the next action obvious and compelling?
4. Trust: Are there signals that reduce friction?

You NEVER create generic, stock-photo-looking ads.
You ALWAYS have a strategic reason for every creative decision.`;

/**
 * Generate ad creative specifications using Gemini
 */
async function generateCreativeSpecs(
  input: GenerateCreativesInput
): Promise<Array<{
  backgroundPrompt: string;
  headline: string;
  cta: string;
  angle: string;
  rationale: string;
  scores: { hook: number; clarity: number; cta: number; overall: number };
}>> {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.log("[Ads Image Creator] No GOOGLE_API_KEY, using fallback specs");
    return generateFallbackSpecs(input);
  }

  const angleDescriptions = input.angles
    .map((a) => {
      const angle = MARKETING_ANGLES[a as MarketingAngle];
      return angle ? `- ${angle.name}: ${angle.description}. ${angle.promptHints}` : `- ${a}`;
    })
    .join("\n");

  const referenceContext = input.referenceAnalysis
    ? `\nReference Image Analysis:\n${JSON.stringify(input.referenceAnalysis, null, 2)}`
    : "";

  const competitorContext = input.competitorAnalysis
    ? `\nCompetitor Analysis:\n${JSON.stringify(input.competitorAnalysis, null, 2)}`
    : "";

  const colorContext = input.colorScheme
    ? `\nBrand Colors: Primary: ${input.colorScheme.primary || 'not specified'}, Secondary: ${input.colorScheme.secondary || 'not specified'}`
    : "";

  const prompt = `${CREATIVE_DIRECTOR_PROMPT}

## TASK
Generate ${input.variationCount} unique ad creative specifications for the following product.

## PRODUCT DETAILS
- Description: ${input.productDescription}
${input.productUrl ? `- URL: ${input.productUrl}` : ""}
${input.targetAudience ? `- Target Audience: ${input.targetAudience}` : ""}
- Goal: ${input.goal === "ctr" ? "Maximize click-through rate" : input.goal === "conversions" ? "Drive conversions" : "Build awareness"}
${colorContext}
${referenceContext}
${competitorContext}

## HEADLINES TO USE (one per variation)
${input.headlines.map((h, i) => `${i + 1}. "${h}"`).join("\n")}

## MARKETING ANGLES TO APPLY
${angleDescriptions}

## CTA
${input.ctaText || "Use an appropriate call-to-action"}

## OUTPUT FORMAT
Return ONLY valid JSON array. No markdown, no explanation:

[
  {
    "backgroundPrompt": "Detailed prompt for AI image generation. NO TEXT IN IMAGE. Describe scene, mood, colors, composition. Be specific about visual elements.",
    "headline": "The headline to overlay (from the provided list)",
    "cta": "Call-to-action text",
    "angle": "Which marketing angle this uses",
    "rationale": "2-3 sentences explaining why this creative should convert. Be specific about psychological triggers.",
    "scores": {
      "hook": 85,
      "clarity": 90,
      "cta": 88,
      "overall": 87
    }
  }
]

IMPORTANT:
- backgroundPrompt must NOT include any text, words, or letters - this will be overlaid separately
- Each variation should use a DIFFERENT headline and/or angle
- Scores should be realistic (most good ads are 75-90, exceptional are 90+)
- Focus on scroll-stopping visuals that work at small sizes`;

  try {
    console.log("[Ads Image Creator] Calling Gemini API...");
    console.log("[Ads Image Creator] Model:", GEMINI_MODEL);
    console.log("[Ads Image Creator] API Key present:", !!apiKey);

    const response = await fetch(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    console.log("[Ads Image Creator] Gemini response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Ads Image Creator] Gemini API error response:", errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("[Ads Image Creator] Gemini response length:", text.length);
    console.log("[Ads Image Creator] Gemini response preview:", text.substring(0, 200));

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("[Ads Image Creator] Parsed", parsed.length, "creative specs from Gemini");
      return parsed;
    }

    console.error("[Ads Image Creator] No valid JSON found in Gemini response");
    console.error("[Ads Image Creator] Full response:", text);
    throw new Error("No valid JSON in Gemini response");
  } catch (error) {
    console.error("[Ads Image Creator] Gemini error:", error);
    console.log("[Ads Image Creator] Falling back to default specs...");
    return generateFallbackSpecs(input);
  }
}

/**
 * Fallback specs when Gemini is not available
 */
function generateFallbackSpecs(input: GenerateCreativesInput): Array<{
  backgroundPrompt: string;
  headline: string;
  cta: string;
  angle: string;
  rationale: string;
  scores: { hook: number; clarity: number; cta: number; overall: number };
}> {
  const specs = [];
  const angles = input.angles.length > 0 ? input.angles : ["benefit_focused"];

  for (let i = 0; i < input.variationCount; i++) {
    const headline = input.headlines[i % input.headlines.length] || "Discover the difference";
    const angle = angles[i % angles.length];
    const angleInfo = MARKETING_ANGLES[angle as MarketingAngle];

    let backgroundPrompt = "";
    switch (angle) {
      case "problem_solution":
        backgroundPrompt = `Professional photography of a person experiencing a breakthrough moment, warm lighting, clean modern background, subtle gradient from dark to light symbolizing transformation, photorealistic, high quality advertising image, no text no words no letters`;
        break;
      case "social_proof":
        backgroundPrompt = `Diverse group of happy successful people, modern office or lifestyle setting, warm natural lighting, premium quality feel, clean composition with space for text overlay, professional advertising photography, no text no words no letters`;
        break;
      case "urgency_scarcity":
        backgroundPrompt = `Dynamic action shot with motion blur, vibrant warm colors orange and red accents, energetic composition, professional advertising photography, sense of movement and urgency, clean background with space for text, no text no words no letters`;
        break;
      case "benefit_focused":
        backgroundPrompt = `Aspirational lifestyle scene, person achieving success or enjoying life, bright optimistic lighting, premium quality photography, clean modern aesthetic, soft background blur, space for text overlay, no text no words no letters`;
        break;
      case "curiosity":
        backgroundPrompt = `Unexpected eye-catching scene, unusual perspective or composition, bold colors, pattern interrupt visual, intriguing imagery that makes people stop scrolling, professional quality, no text no words no letters`;
        break;
      case "comparison":
        backgroundPrompt = `Split composition showing contrast, left side darker/worse, right side brighter/better, clean division line, professional advertising photography, clear visual hierarchy, space for text overlay, no text no words no letters`;
        break;
      case "authority":
        backgroundPrompt = `Professional corporate setting, premium quality aesthetic, clean minimal design, trust-inspiring imagery, sophisticated color palette, expert professional environment, high-end advertising photography, no text no words no letters`;
        break;
      default:
        backgroundPrompt = `Professional advertising photography, clean modern aesthetic, premium quality, suitable for digital ads, clear composition with space for text overlay, no text no words no letters`;
    }

    specs.push({
      backgroundPrompt,
      headline,
      cta: input.ctaText || "Learn More",
      angle,
      rationale: `This creative uses the ${angleInfo?.name || angle} approach to capture attention and drive ${input.goal === "ctr" ? "clicks" : input.goal === "conversions" ? "conversions" : "awareness"}.`,
      scores: {
        hook: 75 + Math.floor(Math.random() * 15),
        clarity: 78 + Math.floor(Math.random() * 12),
        cta: 76 + Math.floor(Math.random() * 14),
        overall: 76 + Math.floor(Math.random() * 14),
      },
    });
  }

  return specs;
}

/**
 * Generate image using Gemini Imagen 3
 * Uses the same GOOGLE_API_KEY as the text generation
 */
async function generateImage(prompt: string, userId: string, imageId: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;

  console.log("[Ads Image Creator] generateImage called");
  console.log("[Ads Image Creator] GOOGLE_API_KEY present:", !!apiKey);
  console.log("[Ads Image Creator] Prompt preview:", prompt.substring(0, 100));

  if (!apiKey) {
    console.log("[Ads Image Creator] No GOOGLE_API_KEY, returning placeholder");
    return "https://placehold.co/1080x1080/1a1a2e/ffffff?text=Ad+Creative";
  }

  console.log("[Ads Image Creator] Generating image with Gemini Imagen 3...");

  // Use Imagen 3 for image generation
  // API endpoint: https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict
  const imagenApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

  const response = await fetch(imagenApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [
        {
          prompt: prompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        personGeneration: "allow_adult",
        safetyFilterLevel: "block_only_high",
      },
    }),
  });

  console.log("[Ads Image Creator] Imagen API response status:", response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error("[Ads Image Creator] Imagen API error:", error);
    throw new Error(`Imagen API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log("[Ads Image Creator] Imagen response:", JSON.stringify(data).substring(0, 300));

  // Extract base64 image from response
  const predictions = data.predictions;
  if (!predictions || predictions.length === 0) {
    console.error("[Ads Image Creator] No predictions in response:", JSON.stringify(data));
    throw new Error("No image generated from Imagen API");
  }

  const base64Image = predictions[0].bytesBase64Encoded;
  if (!base64Image) {
    console.error("[Ads Image Creator] No base64 image in prediction:", JSON.stringify(predictions[0]));
    throw new Error("No image data in Imagen response");
  }

  console.log("[Ads Image Creator] Got base64 image, length:", base64Image.length);

  // Convert base64 to buffer
  const imageBuffer = Buffer.from(base64Image, "base64");
  console.log("[Ads Image Creator] Image buffer size:", imageBuffer.byteLength, "bytes");

  // Upload to Vercel Blob for persistence
  console.log("[Ads Image Creator] Uploading to Vercel Blob...");
  const blob = await put(
    `ads-image-creator/${userId}/${imageId}/image.png`,
    imageBuffer,
    { access: "public", addRandomSuffix: true }
  );

  console.log("[Ads Image Creator] Uploaded to Vercel Blob:", blob.url);
  return blob.url;
}

/**
 * Main function to generate ad creatives
 */
export async function generateAdCreatives(
  input: GenerateCreativesInput
): Promise<GeneratedCreative[]> {
  console.log("[Ads Image Creator] ========== generateAdCreatives START ==========");
  console.log("[Ads Image Creator] Input:", JSON.stringify({
    productDescription: input.productDescription?.substring(0, 50),
    headlines: input.headlines,
    angles: input.angles,
    variationCount: input.variationCount,
    goal: input.goal,
  }));

  // Step 1: Generate creative specifications using Gemini
  console.log("[Ads Image Creator] Step 1: Calling generateCreativeSpecs...");
  const specs = await generateCreativeSpecs(input);
  console.log(`[Ads Image Creator] Step 1 complete: Got ${specs.length} specs`);

  if (specs.length === 0) {
    console.error("[Ads Image Creator] No specs generated! Returning empty array.");
    return [];
  }

  // Log each spec
  specs.forEach((spec, i) => {
    console.log(`[Ads Image Creator] Spec ${i + 1}:`, {
      headline: spec.headline,
      cta: spec.cta,
      angle: spec.angle,
      promptPreview: spec.backgroundPrompt?.substring(0, 80),
    });
  });

  // Step 2: Generate images for each spec using Gemini Imagen 3
  console.log("[Ads Image Creator] Step 2: Generating images with Gemini Imagen 3...");
  const creatives: GeneratedCreative[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    console.log(`[Ads Image Creator] Generating image ${i + 1}/${specs.length}...`);

    try {
      const imageId = `${Date.now()}-${i}`;
      const imageUrl = await generateImage(
        spec.backgroundPrompt,
        "system", // Will be replaced with actual userId
        imageId
      );

      console.log(`[Ads Image Creator] Image ${i + 1} generated successfully:`, imageUrl?.substring(0, 60));

      creatives.push({
        backgroundPrompt: spec.backgroundPrompt,
        headline: spec.headline,
        cta: spec.cta,
        angle: spec.angle,
        rationale: spec.rationale,
        imageUrl,
        scores: spec.scores,
      });
    } catch (error) {
      console.error(`[Ads Image Creator] Failed to generate image ${i + 1}:`, error);
      // Continue with other images
    }
  }

  console.log(`[Ads Image Creator] ========== generateAdCreatives COMPLETE ==========`);
  console.log(`[Ads Image Creator] Returning ${creatives.length} creatives`);
  return creatives;
}

/**
 * Analyze a reference image using Gemini Vision
 */
export async function analyzeReferenceImage(imageUrl: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      error: "Gemini API not configured",
      layout: "unknown",
      colors: [],
      hook: "unknown",
      ctaStyle: "unknown",
      whyItConverts: "Unable to analyze without API key",
    };
  }

  const prompt = `Analyze this ad image and explain:
1. Layout structure (where is text, product, CTA positioned)
2. Visual hierarchy (what draws attention first, second, third)
3. Color psychology (mood, feelings evoked, brand colors used)
4. Hook mechanism (why would someone stop scrolling for this)
5. CTA approach (hard sell vs soft, urgency vs benefit)
6. WHY this likely converts (psychological principles at play)

Be specific and tactical, not generic. Return JSON:
{
  "layout": {
    "textPosition": "top/center/bottom",
    "productPosition": "left/center/right",
    "ctaPosition": "bottom/corner/overlay",
    "composition": "description of overall layout"
  },
  "visualHierarchy": ["first element noticed", "second", "third"],
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "mood": "description of emotional impact"
  },
  "hookMechanism": "description of what stops the scroll",
  "ctaStyle": "description of CTA approach",
  "whyItConverts": "2-3 sentences on conversion psychology",
  "suggestedImprovements": ["improvement 1", "improvement 2"]
}`;

  try {
    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const mimeType = imageUrl.includes(".png") ? "image/png" : "image/jpeg";

    const response = await fetch(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { error: "Failed to parse analysis", rawResponse: text };
  } catch (error) {
    console.error("[Ads Image Creator] Reference analysis error:", error);
    return {
      error: error instanceof Error ? error.message : "Analysis failed",
    };
  }
}
