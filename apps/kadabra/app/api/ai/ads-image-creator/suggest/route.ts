import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export const runtime = "nodejs";
export const maxDuration = 30;

// =============================================================================
// GEMINI MODEL CONFIGURATION
// IMPORTANT: Always use the latest stable Gemini model.
// Update this constant when Google releases newer versions.
// Check: https://ai.google.dev/gemini-api/docs/models/gemini
// =============================================================================
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface SuggestRequest {
  type: "headlines" | "enhance_description" | "cta";
  productDescription: string;
  goal?: string;
  angle?: string;
}

// POST /api/ai/ads-image-creator/suggest - Get AI suggestions
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SuggestRequest = await req.json();
    const { type, productDescription, goal = "ctr", angle = "benefit_focused" } = body;

    if (!productDescription || productDescription.trim().length < 10) {
      return NextResponse.json(
        { error: "Product description must be at least 10 characters" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Please add GOOGLE_API_KEY." },
        { status: 500 }
      );
    }

    let prompt = "";
    let suggestions: string[] = [];

    switch (type) {
      case "headlines":
        prompt = buildHeadlinesPrompt(productDescription, goal, angle);
        suggestions = await callGemini(apiKey, prompt, "headlines");
        break;

      case "enhance_description":
        prompt = buildEnhancePrompt(productDescription);
        suggestions = await callGemini(apiKey, prompt, "description");
        break;

      case "cta":
        prompt = buildCtaPrompt(productDescription, goal);
        suggestions = await callGemini(apiKey, prompt, "cta");
        break;

      default:
        return NextResponse.json({ error: "Invalid suggestion type" }, { status: 400 });
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[AI Suggest] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}

function buildHeadlinesPrompt(product: string, goal: string, angle: string): string {
  const goalDescription = {
    ctr: "maximize click-through rate - make people curious and want to click",
    conversions: "drive conversions - focus on value and urgency",
    awareness: "build brand awareness - be memorable and shareable",
  }[goal] || "maximize engagement";

  const angleDescription = {
    problem_solution: "highlight the problem and position the product as the solution",
    social_proof: "leverage social proof, numbers, testimonials",
    urgency_scarcity: "create urgency with limited time/availability",
    benefit_focused: "lead with the transformation and benefits",
    curiosity: "create curiosity and pattern interrupts",
    comparison: "compare before/after or vs competitors",
    authority: "establish authority and expertise",
  }[angle] || "highlight benefits";

  return `You are an expert copywriter for digital ads. Generate 5 scroll-stopping headlines for this product.

PRODUCT: ${product}

GOAL: ${goalDescription}
ANGLE: ${angleDescription}

Requirements:
- Each headline should be 3-8 words
- Make them punchy and attention-grabbing
- Focus on benefits, not features
- Use power words that evoke emotion
- Each headline should be unique and different
- No hashtags or emojis

Return ONLY a JSON array of 5 strings, nothing else:
["headline 1", "headline 2", "headline 3", "headline 4", "headline 5"]`;
}

function buildEnhancePrompt(product: string): string {
  return `You are a marketing strategist. Take this basic product description and enhance it with:
- Clear target audience identification
- Key pain points the product solves
- Main benefits and transformation
- Unique selling proposition

ORIGINAL: ${product}

Return ONLY a JSON object with one key "enhanced" containing the improved description (2-3 sentences max):
{"enhanced": "Your enhanced description here"}`;
}

function buildCtaPrompt(product: string, goal: string): string {
  const goalFocus = {
    ctr: "curiosity-driven CTAs that make people want to learn more",
    conversions: "action-oriented CTAs that drive immediate action",
    awareness: "soft CTAs that invite exploration",
  }[goal] || "action-oriented CTAs";

  return `Generate 5 call-to-action button texts for this product.

PRODUCT: ${product}
GOAL: ${goalFocus}

Requirements:
- Each CTA should be 2-4 words
- Use action verbs
- Create urgency where appropriate
- Mix between soft and hard CTAs

Return ONLY a JSON array of 5 strings:
["CTA 1", "CTA 2", "CTA 3", "CTA 4", "CTA 5"]`;
}

async function callGemini(
  apiKey: string,
  prompt: string,
  type: "headlines" | "description" | "cta"
): Promise<string[]> {
  const response = await fetch(
    `${GEMINI_API_URL}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse JSON from response
  if (type === "description") {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return [parsed.enhanced || parsed.description || text];
    }
    return [text.trim()];
  }

  // For headlines and CTAs, expect an array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const parsed = JSON.parse(arrayMatch[0]);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 5);
    }
  }

  // Fallback: split by newlines
  return text
    .split("\n")
    .map((line: string) => line.replace(/^[\d\.\-\*]+\s*/, "").trim())
    .filter((line: string) => line.length > 0)
    .slice(0, 5);
}
