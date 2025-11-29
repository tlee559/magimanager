import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ad, allAdsInGroup } = await req.json();

    if (!ad) {
      return NextResponse.json({ error: "Ad data required" }, { status: 400 });
    }

    // Calculate if ad is winner/underperformer
    const isWinner = ad.score?.tier === "gold" || ad.score?.tier === "silver";

    // Build context about the ad and its ad group
    const adGroupContext = allAdsInGroup?.map((a: { headlines?: string[]; name?: string; score?: { overall: number; tier: string }; ctr: number; conversions: number; cost: number }) => ({
      headline: a.headlines?.[0] || a.name,
      score: a.score?.overall,
      tier: a.score?.tier,
      ctr: a.ctr,
      conversions: a.conversions,
      cost: a.cost,
    })) || [];

    // Build prompt for Gemini
    const prompt = isWinner
      ? buildWinnerPrompt(ad, adGroupContext)
      : buildUnderperformerPrompt(ad, adGroupContext);

    // Only call AI if we have an API key
    if (GEMINI_API_KEY) {
      try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

          // Parse the JSON response from Gemini
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return NextResponse.json(analysis);
          }
        }
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
      }
    }

    // Return fallback analysis if AI fails or no API key
    return NextResponse.json(getFallbackAnalysis(isWinner, ad));
  } catch (error) {
    console.error("Error analyzing ad:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze ad" },
      { status: 500 }
    );
  }
}

function buildWinnerPrompt(ad: { headlines?: string[]; name?: string; score?: { overall: number; tier: string; ctrScore: number; conversionScore: number; costScore: number; impressionScore: number }; ctr: number; conversions: number; cost: number; impressions: number }, adGroupContext: Array<{ headline?: string; score?: number; tier?: string; ctr: number; conversions: number; cost: number }>) {
  const headline = ad.headlines?.[0] || ad.name || "Ad";
  const avgCtr = adGroupContext.length > 0 ? adGroupContext.reduce((sum, a) => sum + a.ctr, 0) / adGroupContext.length : 0;

  return `Analyze this winning Google Ad and explain why it's successful.

AD DETAILS:
- Headline: "${headline}"
- Score: ${ad.score?.overall}/100 (${ad.score?.tier})
- CTR: ${(ad.ctr * 100).toFixed(2)}% (Ad Group Avg: ${(avgCtr * 100).toFixed(2)}%)
- Conversions: ${ad.conversions}
- Cost: $${(ad.cost / 1_000_000).toFixed(2)}

COMPARISON (${adGroupContext.length} ads in group):
${adGroupContext.map(a => `- "${a.headline}": Score ${a.score}, CTR ${(a.ctr * 100).toFixed(2)}%`).join('\n')}

Respond with JSON only:
{
  "whyItWins": ["3-4 specific reasons why this ad outperforms others, referencing the headline elements, metrics, and patterns"],
  "scalingTips": ["3 actionable recommendations for scaling this winning ad"]
}

Be specific about what words/phrases in the headline drive success.`;
}

function buildUnderperformerPrompt(ad: { headlines?: string[]; name?: string; score?: { overall: number; tier: string }; ctr: number; conversions: number; cost: number }, adGroupContext: Array<{ headline?: string; score?: number; tier?: string; ctr: number; conversions: number; cost: number }>) {
  const headline = ad.headlines?.[0] || ad.name || "Ad";
  const topPerformers = adGroupContext.filter(a => a.tier === "gold" || a.tier === "silver");
  const avgCtr = adGroupContext.length > 0 ? adGroupContext.reduce((sum, a) => sum + a.ctr, 0) / adGroupContext.length : 0;

  return `Analyze this underperforming Google Ad and suggest improvements.

AD DETAILS:
- Headline: "${headline}"
- Score: ${ad.score?.overall}/100 (${ad.score?.tier})
- CTR: ${(ad.ctr * 100).toFixed(2)}% (Ad Group Avg: ${(avgCtr * 100).toFixed(2)}%)
- Conversions: ${ad.conversions}
- Cost: $${(ad.cost / 1_000_000).toFixed(2)}

TOP PERFORMERS IN AD GROUP:
${topPerformers.length > 0 ? topPerformers.map(a => `- "${a.headline}": Score ${a.score}, CTR ${(a.ctr * 100).toFixed(2)}%`).join('\n') : 'No top performers yet'}

Respond with JSON only:
{
  "problems": ["3-4 specific problems with this ad compared to better performers"],
  "suggestedRewrites": ["3 new headline variations that incorporate patterns from the top performers. Keep them under 30 characters each."]
}

Be specific about what's missing compared to the winners.`;
}

function getFallbackAnalysis(isWinner: boolean, ad: { headlines?: string[]; name?: string }) {
  const headline = ad.headlines?.[0] || ad.name || "Ad";
  const firstWord = headline.split(" ")[0];

  if (isWinner) {
    return {
      whyItWins: [
        "Strong headline with clear value proposition",
        "CTR above ad group average indicates compelling messaging",
        "Good conversion rate shows effective targeting",
      ],
      scalingTips: [
        "Create 2-3 variations keeping the winning structure",
        "Test this ad pattern in other relevant ad groups",
        "Consider increasing budget by 50-100% gradually",
      ],
    };
  } else {
    return {
      problems: [
        "Headline may lack urgency or clear call-to-action",
        "CTR below average suggests messaging doesn't resonate",
        "Consider reviewing what top performers in your account do differently",
      ],
      suggestedRewrites: [
        `"${firstWord} - 40% Off Today"`,
        `"Top-Rated ${firstWord} - Free Shipping"`,
        `"${firstWord} Sale - Limited Time"`,
      ],
    };
  }
}
