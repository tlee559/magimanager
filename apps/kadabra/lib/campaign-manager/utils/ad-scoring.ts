/**
 * Ad Performance Scoring Utility
 *
 * Calculates performance scores for ads based on relative performance
 * within their ad group. Uses percentile ranking across key metrics.
 */

import type { Ad } from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

export interface AdScore {
  overall: number;        // 0-100
  ctrScore: number;       // 0-25 (weight: 25%)
  conversionScore: number; // 0-35 (weight: 35%)
  costScore: number;      // 0-25 (weight: 25%)
  impressionScore: number; // 0-15 (weight: 15%)
  isWinner: boolean;
  tier: "gold" | "silver" | "bronze" | "neutral";
}

export interface ScoredAd extends Ad {
  score: AdScore;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate percentile rank of a value within an array
 * Returns 0-100
 */
function getPercentile(value: number, values: number[]): number {
  if (values.length === 0) return 50;
  if (values.length === 1) return value > 0 ? 75 : 50;

  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v < value).length;
  return Math.round((rank / (sorted.length - 1)) * 100) || 0;
}

/**
 * Get score tier based on overall score
 */
function getTier(score: number): "gold" | "silver" | "bronze" | "neutral" {
  if (score >= 80) return "gold";
  if (score >= 60) return "silver";
  if (score >= 40) return "bronze";
  return "neutral";
}

/**
 * Get tier color classes
 */
export function getTierColors(tier: "gold" | "silver" | "bronze" | "neutral"): {
  bg: string;
  text: string;
  border: string;
} {
  switch (tier) {
    case "gold":
      return {
        bg: "bg-amber-500/20",
        text: "text-amber-400",
        border: "border-amber-500/30",
      };
    case "silver":
      return {
        bg: "bg-slate-400/20",
        text: "text-slate-300",
        border: "border-slate-400/30",
      };
    case "bronze":
      return {
        bg: "bg-orange-500/20",
        text: "text-orange-400",
        border: "border-orange-500/30",
      };
    default:
      return {
        bg: "bg-slate-500/20",
        text: "text-slate-400",
        border: "border-slate-500/30",
      };
  }
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate ad performance score relative to other ads in the same group
 */
export function calculateAdScore(ad: Ad, adGroupAds: Ad[]): AdScore {
  // Extract metrics arrays for percentile calculation
  const ctrs = adGroupAds.map((a) => a.ctr);
  const conversions = adGroupAds.map((a) => a.conversions);
  const costs = adGroupAds.map((a) => a.cost);
  const impressions = adGroupAds.map((a) => a.impressions);

  // Calculate percentile scores for each metric
  const ctrPercentile = getPercentile(ad.ctr, ctrs);
  const convPercentile = getPercentile(ad.conversions, conversions);
  // For cost efficiency, lower cost with same/more conversions is better
  // We invert the percentile for cost
  const costPercentile = ad.conversions > 0
    ? 100 - getPercentile(ad.cost / Math.max(ad.conversions, 0.1), costs.map((c, i) => c / Math.max(conversions[i], 0.1)))
    : 50;
  const impressionPercentile = getPercentile(ad.impressions, impressions);

  // Calculate weighted scores
  const ctrScore = Math.round(ctrPercentile * 0.25);
  const conversionScore = Math.round(convPercentile * 0.35);
  const costScore = Math.round(costPercentile * 0.25);
  const impressionScore = Math.round(impressionPercentile * 0.15);

  const overall = ctrScore + conversionScore + costScore + impressionScore;

  // Determine if this ad is a winner
  // Winner = score >= 80 AND conversions > average
  const avgConversions = conversions.reduce((a, b) => a + b, 0) / conversions.length;
  const isWinner = overall >= 80 && ad.conversions > avgConversions * 1.2;

  return {
    overall,
    ctrScore,
    conversionScore,
    costScore,
    impressionScore,
    isWinner,
    tier: getTier(overall),
  };
}

/**
 * Score all ads in an ad group and identify winners
 */
export function scoreAdsInGroup(ads: Ad[]): ScoredAd[] {
  return ads.map((ad) => ({
    ...ad,
    score: calculateAdScore(ad, ads),
  }));
}

/**
 * Get winner ads from a scored list
 */
export function getWinners(scoredAds: ScoredAd[]): ScoredAd[] {
  return scoredAds.filter((ad) => ad.score.isWinner);
}

/**
 * Get ads sorted by score (highest first)
 */
export function sortByScore(scoredAds: ScoredAd[]): ScoredAd[] {
  return [...scoredAds].sort((a, b) => b.score.overall - a.score.overall);
}
