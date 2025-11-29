/**
 * Campaign Planner AI Agent
 *
 * Uses Gemini to analyze product/service information and generate
 * a complete Google Ads campaign plan including:
 * - Campaign structure
 * - Keyword research with estimated volumes
 * - Ad copy suggestions (headlines + descriptions)
 * - Budget recommendations
 * - Target audience insights
 */

import { prisma } from "@magimanager/database";

// ============================================================================
// TYPES
// ============================================================================

export interface CampaignPlanInput {
  productUrl?: string;
  productDescription?: string;
  targetAudience?: string;
  monthlyBudget?: string | number;
  goals?: string;
  documents?: string[]; // Vercel Blob URLs
  // v2 Enhancement fields
  competitorUrl?: string;
  industry?: string;
}

export interface KeywordGroup {
  theme: string;
  keywords: {
    keyword: string;
    matchType: "EXACT" | "PHRASE" | "BROAD";
    estimatedVolume: string; // "Low", "Medium", "High"
    competition: string; // "Low", "Medium", "High"
    estimatedCpc: string; // "$0.50 - $2.00"
    intent: string; // "Transactional", "Informational", "Commercial"
  }[];
}

export interface AdCopyVariation {
  headlines: string[]; // Up to 15
  descriptions: string[]; // Up to 4
  callToAction: string;
  landingPagePath?: string;
}

export interface CampaignStructure {
  campaignName: string;
  campaignType: "SEARCH" | "DISPLAY" | "PERFORMANCE_MAX";
  biddingStrategy: string;
  targetCpa?: number;
  dailyBudget: number;
  adGroups: {
    name: string;
    theme: string;
    keywords: KeywordGroup;
    ads: AdCopyVariation[];
  }[];
}

// v2 Enhancement types
export interface CompetitorAnalysis {
  valueProposition: string;
  targetAudience: string;
  keyOffers: string[];
  likelyKeywords: string[];
  differentiationStrategy: string;
  competitiveAdvantages: string[];
}

export interface IndustryBenchmarks {
  industry: string;
  expectedCpa: { low: number; high: number; target: number };
  expectedCtr: number;
  expectedCvr: number;
  planVsBenchmark: string;
}

export interface ImplementationStep {
  phase: number;
  title: string;
  description: string;
  substeps: {
    action: string;
    details: string;
    copyValue?: string;
  }[];
}

export interface GeneratedPlan {
  summary: {
    productAnalysis: string;
    targetMarket: string;
    uniqueSellingPoints: string[];
    competitiveAdvantages: string[];
  };
  campaigns: CampaignStructure[];
  budgetBreakdown: {
    recommendedMonthlyBudget: number;
    estimatedCpc: { min: number; max: number };
    estimatedClicksPerMonth: { min: number; max: number };
    estimatedConversions: { min: number; max: number };
  };
  timeline: {
    phase: string;
    duration: string;
    actions: string[];
  }[];
  nextSteps: string[];
  // v2 Enhancement fields
  competitorAnalysis?: CompetitorAnalysis;
  industryBenchmarks?: IndustryBenchmarks;
  implementationGuide?: ImplementationStep[];
}

// ============================================================================
// INDUSTRY BENCHMARKS DATA
// ============================================================================

export const INDUSTRY_BENCHMARKS: Record<string, {
  name: string;
  avgCpa: { min: number; max: number; typical: number };
  avgCtr: { search: number; display: number };
  avgCvr: { search: number; display: number };
  recommendedBudget: { min: number; ideal: number };
  notes: string;
}> = {
  'saas': {
    name: 'SaaS / Software',
    avgCpa: { min: 50, max: 200, typical: 100 },
    avgCtr: { search: 3.5, display: 0.5 },
    avgCvr: { search: 3.0, display: 0.5 },
    recommendedBudget: { min: 2000, ideal: 5000 },
    notes: 'Long sales cycles, focus on demo/trial conversions'
  },
  'ecommerce': {
    name: 'E-commerce / Retail',
    avgCpa: { min: 15, max: 80, typical: 35 },
    avgCtr: { search: 2.5, display: 0.4 },
    avgCvr: { search: 2.5, display: 0.3 },
    recommendedBudget: { min: 1000, ideal: 3000 },
    notes: 'Focus on ROAS, Shopping campaigns essential'
  },
  'local-services': {
    name: 'Local Services',
    avgCpa: { min: 30, max: 150, typical: 60 },
    avgCtr: { search: 4.0, display: 0.6 },
    avgCvr: { search: 5.0, display: 0.8 },
    recommendedBudget: { min: 500, ideal: 2000 },
    notes: 'High intent searches, call extensions crucial'
  },
  'legal': {
    name: 'Legal Services',
    avgCpa: { min: 100, max: 500, typical: 200 },
    avgCtr: { search: 2.0, display: 0.3 },
    avgCvr: { search: 2.5, display: 0.4 },
    recommendedBudget: { min: 3000, ideal: 10000 },
    notes: 'High CPC keywords, quality over quantity'
  },
  'healthcare': {
    name: 'Healthcare / Medical',
    avgCpa: { min: 50, max: 200, typical: 90 },
    avgCtr: { search: 3.0, display: 0.5 },
    avgCvr: { search: 3.5, display: 0.5 },
    recommendedBudget: { min: 2000, ideal: 5000 },
    notes: 'HIPAA considerations, location targeting important'
  },
  'finance': {
    name: 'Finance / Insurance',
    avgCpa: { min: 80, max: 300, typical: 150 },
    avgCtr: { search: 2.5, display: 0.4 },
    avgCvr: { search: 2.0, display: 0.3 },
    recommendedBudget: { min: 3000, ideal: 8000 },
    notes: 'Regulated industry, compliance in ad copy'
  },
  'education': {
    name: 'Education / Courses',
    avgCpa: { min: 40, max: 150, typical: 70 },
    avgCtr: { search: 3.5, display: 0.5 },
    avgCvr: { search: 3.0, display: 0.5 },
    recommendedBudget: { min: 1000, ideal: 3000 },
    notes: 'Seasonal patterns, lead gen focus'
  },
  'realestate': {
    name: 'Real Estate',
    avgCpa: { min: 30, max: 100, typical: 50 },
    avgCtr: { search: 3.5, display: 0.6 },
    avgCvr: { search: 2.5, display: 0.4 },
    recommendedBudget: { min: 1500, ideal: 4000 },
    notes: 'Location-based, high-value leads'
  },
  'fitness': {
    name: 'Fitness / Wellness',
    avgCpa: { min: 20, max: 80, typical: 40 },
    avgCtr: { search: 3.0, display: 0.5 },
    avgCvr: { search: 4.0, display: 0.6 },
    recommendedBudget: { min: 800, ideal: 2500 },
    notes: 'New Year spike, emotional triggers work well'
  },
  'b2b': {
    name: 'B2B Services',
    avgCpa: { min: 75, max: 250, typical: 120 },
    avgCtr: { search: 2.5, display: 0.4 },
    avgCvr: { search: 2.0, display: 0.3 },
    recommendedBudget: { min: 2500, ideal: 6000 },
    notes: 'LinkedIn may outperform, longer consideration'
  },
  'travel': {
    name: 'Travel / Hospitality',
    avgCpa: { min: 25, max: 100, typical: 45 },
    avgCtr: { search: 4.0, display: 0.6 },
    avgCvr: { search: 3.0, display: 0.5 },
    recommendedBudget: { min: 1000, ideal: 3500 },
    notes: 'Highly seasonal, remarketing essential'
  },
  'food': {
    name: 'Food & Restaurant',
    avgCpa: { min: 10, max: 40, typical: 20 },
    avgCtr: { search: 5.0, display: 0.8 },
    avgCvr: { search: 5.0, display: 0.7 },
    recommendedBudget: { min: 500, ideal: 1500 },
    notes: 'Local focus, mobile-first, call/direction extensions'
  }
};

// ============================================================================
// GEMINI API CONFIG
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function generateCampaignPlan(
  planId: string,
  input: CampaignPlanInput
): Promise<void> {
  console.log(`[Campaign Planner] Starting plan generation for ${planId}`);

  try {
    // Build the prompt
    const prompt = buildCampaignPlannerPrompt(input);

    // Call Gemini API
    const generatedPlan = await callGeminiForPlan(prompt);

    // Update the plan in database
    await prisma.campaignPlan.update({
      where: { id: planId },
      data: {
        status: "COMPLETED",
        plan: generatedPlan as object,
      },
    });

    console.log(`[Campaign Planner] Plan ${planId} completed successfully`);
  } catch (error) {
    console.error(`[Campaign Planner] Error generating plan ${planId}:`, error);

    await prisma.campaignPlan.update({
      where: { id: planId },
      data: {
        status: "FAILED",
        processingError: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildCampaignPlannerPrompt(input: CampaignPlanInput): string {
  const industryData = input.industry ? INDUSTRY_BENCHMARKS[input.industry] : null;

  let prompt = `You are an expert Google Ads media buyer with 10+ years of experience creating high-performing campaigns.

Analyze the following product/service and create a comprehensive Google Ads campaign plan.

## Product/Service Information:
`;

  if (input.productUrl) {
    prompt += `\nProduct URL: ${input.productUrl}`;
  }

  if (input.productDescription) {
    prompt += `\n\nProduct Description:\n${input.productDescription}`;
  }

  if (input.targetAudience) {
    prompt += `\n\nTarget Audience:\n${input.targetAudience}`;
  }

  if (input.goals) {
    prompt += `\n\nCampaign Goals:\n${input.goals}`;
  }

  if (input.monthlyBudget) {
    prompt += `\n\nMonthly Budget: $${input.monthlyBudget}`;
  }

  // v2 Enhancement: Competitor URL analysis
  if (input.competitorUrl) {
    prompt += `\n\n## COMPETITOR ANALYSIS REQUEST:
Analyze this competitor's landing page: ${input.competitorUrl}
Based on typical patterns for this type of business, infer:
- What is their main value proposition?
- What audience are they targeting?
- What offers/pricing might they have?
- What keywords are they likely bidding on?
- How can we differentiate from them?`;
  }

  // v2 Enhancement: Industry benchmarks context
  if (industryData) {
    prompt += `\n\n## INDUSTRY CONTEXT:
This is a ${industryData.name} business.
Industry benchmarks to reference:
- Typical CPA: $${industryData.avgCpa.min} - $${industryData.avgCpa.max} (average: $${industryData.avgCpa.typical})
- Expected Search CTR: ${industryData.avgCtr.search}%
- Expected Search CVR: ${industryData.avgCvr.search}%
- Recommended starting budget: $${industryData.recommendedBudget.ideal}/month
- Industry notes: ${industryData.notes}

Use these benchmarks to set realistic expectations and compare your plan against them.`;
  }

  prompt += `

## Your Task:
Create a detailed campaign plan in JSON format with the following structure:

{
  "summary": {
    "productAnalysis": "Brief analysis of the product/service",
    "targetMarket": "Primary target market description",
    "uniqueSellingPoints": ["USP 1", "USP 2", "USP 3"],
    "competitiveAdvantages": ["Advantage 1", "Advantage 2"]
  },
  "campaigns": [
    {
      "campaignName": "Descriptive campaign name",
      "campaignType": "SEARCH",
      "biddingStrategy": "Maximize Conversions or Target CPA",
      "targetCpa": 50,
      "dailyBudget": 100,
      "adGroups": [
        {
          "name": "Ad Group Name",
          "theme": "Keyword theme description",
          "keywords": {
            "theme": "Theme name",
            "keywords": [
              {
                "keyword": "keyword phrase",
                "matchType": "EXACT",
                "estimatedVolume": "Medium",
                "competition": "Medium",
                "estimatedCpc": "$1.50 - $3.00",
                "intent": "Commercial"
              }
            ]
          },
          "ads": [
            {
              "headlines": [
                "Headline 1 (max 30 chars)",
                "Headline 2",
                "Headline 3"
              ],
              "descriptions": [
                "Description 1 (max 90 chars)",
                "Description 2"
              ],
              "callToAction": "Shop Now"
            }
          ]
        }
      ]
    }
  ],
  "budgetBreakdown": {
    "recommendedMonthlyBudget": 3000,
    "estimatedCpc": { "min": 1.5, "max": 4.0 },
    "estimatedClicksPerMonth": { "min": 750, "max": 2000 },
    "estimatedConversions": { "min": 30, "max": 100 }
  },
  "timeline": [
    {
      "phase": "Launch Phase",
      "duration": "Weeks 1-2",
      "actions": ["Action 1", "Action 2"]
    }
  ],
  "nextSteps": [
    "Step 1: Set up conversion tracking",
    "Step 2: Create campaigns in Google Ads"
  ]${input.competitorUrl ? `,
  "competitorAnalysis": {
    "valueProposition": "Their main value prop",
    "targetAudience": "Who they target",
    "keyOffers": ["Offer 1", "Offer 2"],
    "likelyKeywords": ["keyword1", "keyword2"],
    "differentiationStrategy": "How to position against them",
    "competitiveAdvantages": ["Our advantage 1", "Our advantage 2"]
  }` : ''}${industryData ? `,
  "industryBenchmarks": {
    "industry": "${industryData.name}",
    "expectedCpa": { "low": ${industryData.avgCpa.min}, "high": ${industryData.avgCpa.max}, "target": ${industryData.avgCpa.typical} },
    "expectedCtr": ${industryData.avgCtr.search},
    "expectedCvr": ${industryData.avgCvr.search},
    "planVsBenchmark": "on par"
  }` : ''},
  "implementationGuide": [
    {
      "phase": 1,
      "title": "Create Campaign",
      "description": "Set up your Search campaign with optimal settings",
      "substeps": [
        {
          "action": "Go to Google Ads",
          "details": "Navigate to Campaigns > + New Campaign",
          "copyValue": null
        },
        {
          "action": "Select campaign goal",
          "details": "Choose 'Leads' or 'Sales' based on your objective",
          "copyValue": null
        },
        {
          "action": "Name your campaign",
          "details": "Use the campaign name from this plan",
          "copyValue": "Campaign name from the plan"
        }
      ]
    },
    {
      "phase": 2,
      "title": "Set Up Ad Groups",
      "description": "Create ad groups for each keyword theme",
      "substeps": [
        {
          "action": "Create ad group",
          "details": "Name it according to the theme",
          "copyValue": "Ad group name"
        },
        {
          "action": "Add keywords",
          "details": "Copy all keywords for this ad group",
          "copyValue": "All keywords formatted for paste"
        }
      ]
    },
    {
      "phase": 3,
      "title": "Create Ads",
      "description": "Add responsive search ads with the suggested copy",
      "substeps": [
        {
          "action": "Add headlines",
          "details": "Copy all 15 headlines",
          "copyValue": "Headlines from plan"
        },
        {
          "action": "Add descriptions",
          "details": "Copy all 4 descriptions",
          "copyValue": "Descriptions from plan"
        }
      ]
    },
    {
      "phase": 4,
      "title": "Configure Settings",
      "description": "Set budget, bidding, and targeting",
      "substeps": [
        {
          "action": "Set daily budget",
          "details": "Based on your monthly budget",
          "copyValue": "Daily budget amount"
        },
        {
          "action": "Set bidding strategy",
          "details": "Start with Maximize Conversions",
          "copyValue": null
        }
      ]
    }
  ]
}

## Requirements:
1. Generate 10-20 keyword ideas per ad group, covering different intents
2. Create at least 5-10 headline variations and 2-4 description variations per ad
3. Headlines must be 30 characters or less
4. Descriptions must be 90 characters or less
5. Include both exact and phrase match keywords
6. Estimate search volumes as "Low" (< 100/mo), "Medium" (100-1000/mo), or "High" (1000+/mo)
7. Provide realistic CPC estimates based on industry standards
8. Consider the user's budget when recommending daily spend
9. ${input.competitorUrl ? 'Include competitorAnalysis with positioning recommendations based on the competitor URL' : 'Skip competitorAnalysis if no competitor URL provided'}
10. ${industryData ? `Include industryBenchmarks and set planVsBenchmark to "above average", "on par", or "below average" based on your estimates vs the ${industryData.name} benchmarks` : 'Skip industryBenchmarks if no industry selected'}
11. ALWAYS include implementationGuide with step-by-step instructions to build this campaign in Google Ads. Make the copyValue fields contain actual values from the plan (campaign names, keywords, headlines, etc.)

Return ONLY valid JSON - no markdown, no code blocks, just the JSON object.`;

  return prompt;
}

// ============================================================================
// GEMINI API CALL
// ============================================================================

async function callGeminiForPlan(prompt: string): Promise<GeneratedPlan> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Campaign Planner] Gemini API error:", errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("No content returned from Gemini");
  }

  // Parse the JSON response
  try {
    // Clean up any markdown code blocks if present
    let cleanJson = textContent
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const plan = JSON.parse(cleanJson) as GeneratedPlan;
    return plan;
  } catch (parseError) {
    console.error("[Campaign Planner] Failed to parse Gemini response:", textContent.slice(0, 500));
    throw new Error("Failed to parse AI response as valid JSON");
  }
}

// ============================================================================
// UTILITY: Fetch URL content (optional enhancement)
// ============================================================================

export async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KadabraBot/1.0)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    // Basic HTML to text conversion - strip tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000); // Limit content

    return text;
  } catch {
    return null;
  }
}
