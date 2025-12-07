import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { prisma } from "@magimanager/database";

export const maxDuration = 60; // 1 minute for AI analysis

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface AnalyzeRequest {
  jobId: string;
  businessContext?: string;
}

export async function POST(req: NextRequest) {
  console.log("[ADSPY:ANALYZE] POST request received");

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body: AnalyzeRequest = await req.json();
    const { jobId, businessContext } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Get the job
    const job = await prisma.adSpyJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.userId !== session.user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!job.ads || (job.ads as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: "No ads to analyze" },
        { status: 400 }
      );
    }

    // Update status
    await prisma.adSpyJob.update({
      where: { id: jobId },
      data: {
        status: "ANALYZING",
        debug: { push: `[${new Date().toISOString()}] Starting AI analysis...` },
      },
    });

    // Build the prompt
    const prompt = buildAnalysisPrompt(
      job.keyword,
      job.ads as any[],
      businessContext || job.businessContext || undefined
    );

    console.log("[ADSPY:ANALYZE] Calling Gemini API...");

    // Call Gemini
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("No response from Gemini");
    }

    // Parse the JSON response
    let analysis;
    try {
      // Extract JSON from response (Gemini sometimes wraps it in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[ADSPY:ANALYZE] JSON parse error:", parseError);
      console.log("[ADSPY:ANALYZE] Raw response:", responseText);

      // Return the raw text as a fallback
      analysis = {
        marketOverview: responseText,
        competitorInsights: [],
        winningPatterns: {},
        recommendations: {},
        differentiationOpportunities: [],
        _parseError: true,
      };
    }

    // Update job with analysis
    await prisma.adSpyJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        aiAnalysis: analysis,
        businessContext: businessContext || job.businessContext,
        debug: { push: `[${new Date().toISOString()}] AI analysis completed` },
      },
    });

    console.log("[ADSPY:ANALYZE] Analysis completed");

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("[ADSPY:ANALYZE] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}

function buildAnalysisPrompt(
  keyword: string,
  ads: any[],
  businessContext?: string
): string {
  // Clean up ads for the prompt (remove large base64 data)
  const cleanAds = ads.map((ad, index) => ({
    position: ad.position || index + 1,
    block_position: ad.block_position,
    title: ad.title,
    description: ad.description,
    displayed_link: ad.displayed_link,
    link: ad.link,
    source: ad.source,
    sitelinks: ad.sitelinks,
    extensions: ad.extensions,
    rating: ad.rating,
    reviews: ad.reviews,
    price: ad.price,
  }));

  return `You are an expert Google Ads copywriter and competitive analyst. Your job is to analyze competitor ads and provide actionable copywriting recommendations.

KEYWORD: "${keyword}"

COMPETITOR ADS FOUND:
${JSON.stringify(cleanAds, null, 2)}

${businessContext ? `OUR BUSINESS CONTEXT: ${businessContext}` : ""}

Analyze these competitor ads and provide a comprehensive analysis. Be specific and actionable.

Your response MUST be valid JSON matching this exact structure:
{
  "marketOverview": "2-3 sentence overview of the competitive landscape for this keyword",

  "competitorInsights": [
    {
      "advertiser": "Company name",
      "strengths": ["Specific strength 1", "Specific strength 2"],
      "weaknesses": ["Specific weakness 1", "Specific weakness 2"],
      "copyTactics": ["Tactic they use 1", "Tactic they use 2"]
    }
  ],

  "winningPatterns": {
    "headlines": ["Pattern 1 that works", "Pattern 2 that works"],
    "descriptions": ["What makes descriptions effective"],
    "extensions": ["Extension patterns that stand out"]
  },

  "recommendations": {
    "headlines": [
      "Ready-to-use headline 1 (max 30 chars)",
      "Ready-to-use headline 2 (max 30 chars)",
      "Ready-to-use headline 3 (max 30 chars)"
    ],
    "descriptions": [
      "Ready-to-use description 1 (max 90 chars)",
      "Ready-to-use description 2 (max 90 chars)"
    ],
    "sitelinks": ["Sitelink 1", "Sitelink 2", "Sitelink 3", "Sitelink 4"],
    "extensions": ["Callout 1", "Callout 2", "Callout 3"]
  },

  "differentiationOpportunities": [
    "Specific opportunity 1 to stand out",
    "Specific opportunity 2 to stand out",
    "Specific opportunity 3 to stand out"
  ]
}

IMPORTANT:
- Headlines must be under 30 characters
- Descriptions must be under 90 characters
- Be specific to this keyword and these competitors
- Make recommendations immediately usable (copy-paste ready)
- Return ONLY valid JSON, no markdown formatting`;
}
