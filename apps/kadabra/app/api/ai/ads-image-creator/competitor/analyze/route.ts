import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { scrapeCompetitorAds, analyzeLandingPage } from "@/lib/ads-competitor-scraper";

// POST /api/ai/ads-image-creator/competitor/analyze - Analyze competitor ads
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { domain, analyzeLandingPageOnly } = body as {
      domain: string;
      analyzeLandingPageOnly?: boolean;
    };

    if (!domain) {
      return NextResponse.json(
        { error: "Domain is required" },
        { status: 400 }
      );
    }

    console.log("[Competitor Analysis] Starting analysis for:", domain);

    // If only landing page analysis requested
    if (analyzeLandingPageOnly) {
      const landingPageAnalysis = await analyzeLandingPage(domain);
      return NextResponse.json({
        success: true,
        type: "landing_page",
        analysis: landingPageAnalysis,
      });
    }

    // Full competitor ad scraping and analysis
    const analysis = await scrapeCompetitorAds({
      domain,
      platforms: ["meta", "google"],
      maxAds: 20,
      activeOnly: true,
    });

    // Also analyze their landing page
    let landingPageAnalysis = null;
    try {
      const fullUrl = domain.startsWith("http") ? domain : `https://${domain}`;
      landingPageAnalysis = await analyzeLandingPage(fullUrl);
    } catch (err) {
      console.warn("[Competitor Analysis] Landing page analysis failed:", err);
    }

    return NextResponse.json({
      success: true,
      type: "full",
      analysis: {
        ...analysis,
        landingPage: landingPageAnalysis,
      },
    });
  } catch (error) {
    console.error("[Competitor Analysis] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
