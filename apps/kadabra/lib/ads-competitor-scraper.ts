/**
 * Ads Competitor Scraper
 * Scrapes competitor ads from Meta Ad Library and Google Ads Transparency Center
 * Uses Gemini to analyze scraped ads and extract marketing insights
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// TYPES
// ============================================================================

interface CompetitorAd {
  id: string;
  platform: "meta" | "google";
  advertiserName: string;
  imageUrl?: string;
  videoUrl?: string;
  headline?: string;
  bodyText?: string;
  ctaText?: string;
  landingPageUrl?: string;
  startDate?: string;
  isActive: boolean;
  impressions?: string;
  regions?: string[];
}

interface CompetitorAnalysis {
  advertiserName: string;
  domain: string;
  totalAdsFound: number;
  ads: CompetitorAd[];
  insights: {
    primaryAngles: string[];
    commonHeadlines: string[];
    ctaPatterns: string[];
    visualStyles: string[];
    targetAudience: string;
    uniqueSellingPoints: string[];
    emotionalTriggers: string[];
    urgencyTactics: string[];
  };
  counterPositioning: {
    weaknesses: string[];
    opportunities: string[];
    suggestedAngles: string[];
    differentiators: string[];
  };
}

interface ScrapeOptions {
  domain: string;
  platforms?: ("meta" | "google")[];
  maxAds?: number;
  activeOnly?: boolean;
}

// ============================================================================
// META AD LIBRARY SCRAPER
// ============================================================================

/**
 * Scrape ads from Meta Ad Library
 * Note: Meta Ad Library has official API access, but requires approval
 * This implementation uses web scraping as a fallback
 */
async function scrapeMetaAdLibrary(
  domain: string,
  maxAds: number = 20
): Promise<CompetitorAd[]> {
  const LOG_PREFIX = "[MetaAdLibrary]";

  try {
    // Extract advertiser name from domain
    const advertiserName = domain
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .replace(/\.[a-z]+$/, "")
      .split(".")[0];

    console.log(`${LOG_PREFIX} Searching for ads from: ${advertiserName}`);

    // Meta Ad Library search URL
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${encodeURIComponent(advertiserName)}&search_type=keyword_unordered&media_type=all`;

    // For actual implementation, you would:
    // 1. Use Meta Marketing API (requires approval)
    // 2. Use a service like Apify or SerpApi for scraping
    // 3. Use Puppeteer/Playwright for browser automation

    // For now, return empty array - this will be enhanced with actual scraping
    console.log(`${LOG_PREFIX} Meta Ad Library URL: ${searchUrl}`);
    console.log(`${LOG_PREFIX} Note: Full Meta Ad Library scraping requires API access or browser automation`);

    return [];
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return [];
  }
}

// ============================================================================
// GOOGLE ADS TRANSPARENCY CENTER SCRAPER
// ============================================================================

/**
 * Scrape ads from Google Ads Transparency Center
 * This uses the publicly accessible transparency center
 */
async function scrapeGoogleAdsTransparency(
  domain: string,
  maxAds: number = 20
): Promise<CompetitorAd[]> {
  const LOG_PREFIX = "[GoogleAdsTransparency]";

  try {
    // Clean domain for search
    const cleanDomain = domain
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .split("/")[0];

    console.log(`${LOG_PREFIX} Searching for ads from: ${cleanDomain}`);

    // Google Ads Transparency Center URL
    const searchUrl = `https://adstransparency.google.com/?domain=${encodeURIComponent(cleanDomain)}`;

    // For actual implementation, you would:
    // 1. Use SerpApi's Google Ads Transparency API
    // 2. Use Puppeteer/Playwright for browser automation
    // 3. Use Apify for managed scraping

    console.log(`${LOG_PREFIX} Google Ads Transparency URL: ${searchUrl}`);
    console.log(`${LOG_PREFIX} Note: Full Google Ads Transparency scraping requires API service or browser automation`);

    return [];
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return [];
  }
}

// ============================================================================
// SERPAPI INTEGRATION (OPTIONAL - REQUIRES API KEY)
// ============================================================================

interface SerpApiResponse {
  ads?: Array<{
    advertiser?: string;
    image?: string;
    link?: string;
    title?: string;
    description?: string;
    started?: string;
  }>;
}

/**
 * Use SerpApi for Google Ads Transparency (if API key available)
 */
async function scrapeViaSerpApi(
  domain: string,
  apiKey: string
): Promise<CompetitorAd[]> {
  const LOG_PREFIX = "[SerpApi]";

  try {
    const cleanDomain = domain
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .split("/")[0];

    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_ads_transparency");
    url.searchParams.set("advertiser_domain", cleanDomain);
    url.searchParams.set("api_key", apiKey);

    console.log(`${LOG_PREFIX} Fetching ads for: ${cleanDomain}`);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`SerpApi error: ${response.statusText}`);
    }

    const data = (await response.json()) as SerpApiResponse;
    const ads: CompetitorAd[] = [];

    if (data.ads && Array.isArray(data.ads)) {
      for (const ad of data.ads) {
        ads.push({
          id: `serpapi-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          platform: "google",
          advertiserName: ad.advertiser || cleanDomain,
          imageUrl: ad.image,
          headline: ad.title,
          bodyText: ad.description,
          landingPageUrl: ad.link,
          startDate: ad.started,
          isActive: true,
        });
      }
    }

    console.log(`${LOG_PREFIX} Found ${ads.length} ads`);
    return ads;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return [];
  }
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

/**
 * Analyze competitor ads using Gemini AI
 */
async function analyzeCompetitorAds(
  ads: CompetitorAd[],
  domain: string
): Promise<CompetitorAnalysis["insights"] & { counterPositioning: CompetitorAnalysis["counterPositioning"] }> {
  const LOG_PREFIX = "[CompetitorAnalysis]";

  if (!process.env.GEMINI_API_KEY) {
    console.log(`${LOG_PREFIX} No GEMINI_API_KEY - using default analysis`);
    return {
      primaryAngles: ["Value proposition", "Problem/Solution"],
      commonHeadlines: [],
      ctaPatterns: ["Learn More", "Shop Now", "Get Started"],
      visualStyles: ["Product focused", "Lifestyle imagery"],
      targetAudience: "General consumers",
      uniqueSellingPoints: [],
      emotionalTriggers: ["Trust", "Urgency"],
      urgencyTactics: ["Limited time", "Act now"],
      counterPositioning: {
        weaknesses: [],
        opportunities: ["Differentiate on value", "Focus on unique benefits"],
        suggestedAngles: ["Comparison", "Authority", "Social proof"],
        differentiators: [],
      },
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prepare ad summaries for analysis
    const adSummaries = ads.map((ad, i) => `
Ad ${i + 1}:
- Headline: ${ad.headline || "N/A"}
- Body: ${ad.bodyText || "N/A"}
- CTA: ${ad.ctaText || "N/A"}
- Landing Page: ${ad.landingPageUrl || "N/A"}
`).join("\n");

    const prompt = `You are an expert marketing strategist and media buyer. Analyze these competitor ads from ${domain}:

${adSummaries || "No ads available - provide general analysis based on the domain."}

Domain: ${domain}

Provide a comprehensive analysis in JSON format:

{
  "primaryAngles": ["List the main marketing angles used (e.g., 'problem/solution', 'social proof', 'urgency', 'authority')"],
  "commonHeadlines": ["List common headline patterns or themes"],
  "ctaPatterns": ["List CTA text patterns used"],
  "visualStyles": ["Describe visual style patterns if observable"],
  "targetAudience": "Describe the apparent target audience",
  "uniqueSellingPoints": ["List USPs they emphasize"],
  "emotionalTriggers": ["List emotional triggers used"],
  "urgencyTactics": ["List urgency/scarcity tactics"],
  "counterPositioning": {
    "weaknesses": ["Identify weaknesses in their approach"],
    "opportunities": ["Identify opportunities they're missing"],
    "suggestedAngles": ["Suggest counter-positioning angles"],
    "differentiators": ["Suggest ways to differentiate"]
  }
}

Return ONLY valid JSON, no markdown or explanation.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const analysis = JSON.parse(jsonMatch[0]);
    console.log(`${LOG_PREFIX} Analysis complete`);

    return {
      primaryAngles: analysis.primaryAngles || [],
      commonHeadlines: analysis.commonHeadlines || [],
      ctaPatterns: analysis.ctaPatterns || [],
      visualStyles: analysis.visualStyles || [],
      targetAudience: analysis.targetAudience || "",
      uniqueSellingPoints: analysis.uniqueSellingPoints || [],
      emotionalTriggers: analysis.emotionalTriggers || [],
      urgencyTactics: analysis.urgencyTactics || [],
      counterPositioning: analysis.counterPositioning || {
        weaknesses: [],
        opportunities: [],
        suggestedAngles: [],
        differentiators: [],
      },
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      primaryAngles: [],
      commonHeadlines: [],
      ctaPatterns: [],
      visualStyles: [],
      targetAudience: "",
      uniqueSellingPoints: [],
      emotionalTriggers: [],
      urgencyTactics: [],
      counterPositioning: {
        weaknesses: [],
        opportunities: [],
        suggestedAngles: [],
        differentiators: [],
      },
    };
  }
}

// ============================================================================
// MAIN SCRAPER FUNCTION
// ============================================================================

/**
 * Scrape and analyze competitor ads
 */
export async function scrapeCompetitorAds(options: ScrapeOptions): Promise<CompetitorAnalysis> {
  const LOG_PREFIX = "[CompetitorScraper]";
  const {
    domain,
    platforms = ["meta", "google"],
    maxAds = 20,
    activeOnly = true,
  } = options;

  console.log(`${LOG_PREFIX} ========== STARTING COMPETITOR ANALYSIS ==========`);
  console.log(`${LOG_PREFIX} Domain: ${domain}`);
  console.log(`${LOG_PREFIX} Platforms: ${platforms.join(", ")}`);

  const allAds: CompetitorAd[] = [];

  // Scrape from each platform
  if (platforms.includes("meta")) {
    const metaAds = await scrapeMetaAdLibrary(domain, maxAds);
    allAds.push(...metaAds);
  }

  if (platforms.includes("google")) {
    // Try SerpApi if key available
    if (process.env.SERPAPI_KEY) {
      const googleAds = await scrapeViaSerpApi(domain, process.env.SERPAPI_KEY);
      allAds.push(...googleAds);
    } else {
      const googleAds = await scrapeGoogleAdsTransparency(domain, maxAds);
      allAds.push(...googleAds);
    }
  }

  console.log(`${LOG_PREFIX} Total ads found: ${allAds.length}`);

  // Filter active only if requested
  const filteredAds = activeOnly
    ? allAds.filter((ad) => ad.isActive)
    : allAds;

  // Analyze ads with AI
  const analysisResult = await analyzeCompetitorAds(filteredAds, domain);

  // Extract advertiser name from domain
  const advertiserName = domain
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .split(".")[0]
    .charAt(0).toUpperCase() + domain.replace(/^(https?:\/\/)?(www\.)?/, "").split(".")[0].slice(1);

  const analysis: CompetitorAnalysis = {
    advertiserName,
    domain: domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0],
    totalAdsFound: filteredAds.length,
    ads: filteredAds.slice(0, maxAds),
    insights: {
      primaryAngles: analysisResult.primaryAngles,
      commonHeadlines: analysisResult.commonHeadlines,
      ctaPatterns: analysisResult.ctaPatterns,
      visualStyles: analysisResult.visualStyles,
      targetAudience: analysisResult.targetAudience,
      uniqueSellingPoints: analysisResult.uniqueSellingPoints,
      emotionalTriggers: analysisResult.emotionalTriggers,
      urgencyTactics: analysisResult.urgencyTactics,
    },
    counterPositioning: analysisResult.counterPositioning,
  };

  console.log(`${LOG_PREFIX} ========== ANALYSIS COMPLETE ==========`);

  return analysis;
}

// ============================================================================
// LANDING PAGE ANALYZER
// ============================================================================

/**
 * Analyze a competitor's landing page for ad insights
 */
export async function analyzeLandingPage(url: string): Promise<{
  title: string;
  description: string;
  headlines: string[];
  ctaTexts: string[];
  valuePropositions: string[];
  socialProof: string[];
  urgencyElements: string[];
}> {
  const LOG_PREFIX = "[LandingPageAnalyzer]";

  try {
    console.log(`${LOG_PREFIX} Analyzing: ${url}`);

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract basic meta info
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

    // For full analysis, use Gemini
    if (!process.env.GEMINI_API_KEY) {
      return {
        title: titleMatch?.[1] || "",
        description: descMatch?.[1] || "",
        headlines: [],
        ctaTexts: [],
        valuePropositions: [],
        socialProof: [],
        urgencyElements: [],
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Truncate HTML to avoid token limits
    const truncatedHtml = html.slice(0, 15000);

    const prompt = `Analyze this landing page HTML and extract marketing elements. Return JSON only:

HTML (truncated):
${truncatedHtml}

Return:
{
  "title": "Page title",
  "description": "Meta description",
  "headlines": ["Main headlines on the page"],
  "ctaTexts": ["CTA button texts"],
  "valuePropositions": ["Value propositions mentioned"],
  "socialProof": ["Testimonials, reviews, trust badges"],
  "urgencyElements": ["Urgency/scarcity elements"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const analysis = JSON.parse(jsonMatch[0]);
    console.log(`${LOG_PREFIX} Analysis complete`);

    return {
      title: analysis.title || titleMatch?.[1] || "",
      description: analysis.description || descMatch?.[1] || "",
      headlines: analysis.headlines || [],
      ctaTexts: analysis.ctaTexts || [],
      valuePropositions: analysis.valuePropositions || [],
      socialProof: analysis.socialProof || [],
      urgencyElements: analysis.urgencyElements || [],
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      title: "",
      description: "",
      headlines: [],
      ctaTexts: [],
      valuePropositions: [],
      socialProof: [],
      urgencyElements: [],
    };
  }
}
