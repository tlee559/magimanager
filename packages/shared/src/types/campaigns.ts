// ============================================================================
// CAMPAIGN TYPES - Google Ads campaign, ad, and keyword structures
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export type CampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';
export type CampaignType = 'SEARCH' | 'DISPLAY' | 'VIDEO' | 'SHOPPING' | 'PERFORMANCE_MAX' | 'APP' | 'SMART' | 'LOCAL' | 'UNKNOWN';
export type BiddingStrategy =
  | 'MANUAL_CPC'
  | 'MAXIMIZE_CLICKS'
  | 'MAXIMIZE_CONVERSIONS'
  | 'MAXIMIZE_CONVERSION_VALUE'
  | 'TARGET_CPA'
  | 'TARGET_ROAS'
  | 'TARGET_IMPRESSION_SHARE'
  | 'ENHANCED_CPC'
  | 'UNKNOWN';

export type AdStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';
export type AdType = 'RESPONSIVE_SEARCH_AD' | 'RESPONSIVE_DISPLAY_AD' | 'EXPANDED_TEXT_AD' | 'CALL_AD' | 'IMAGE_AD' | 'VIDEO_AD' | 'UNKNOWN';

export type KeywordStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';
export type KeywordMatchType = 'EXACT' | 'PHRASE' | 'BROAD';

export type AdGroupStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';
export type AdGroupType = 'SEARCH_STANDARD' | 'SEARCH_DYNAMIC_ADS' | 'DISPLAY_STANDARD' | 'SHOPPING_PRODUCT_ADS' | 'VIDEO_TRUE_VIEW_IN_STREAM' | 'UNKNOWN';

// ============================================================================
// CAMPAIGN
// ============================================================================

export interface Campaign {
  id: string;                    // Google Ads campaign ID
  resourceName: string;          // Full resource name
  name: string;
  status: CampaignStatus;
  type: CampaignType;
  biddingStrategy: BiddingStrategy;

  // Budget
  budgetId: string;
  budgetAmount: number;          // Daily budget in micros (divide by 1,000,000)
  budgetName: string;

  // Metrics (last 7 days or configurable)
  impressions: number;
  clicks: number;
  cost: number;                  // In micros
  conversions: number;
  conversionValue: number;
  ctr: number;                   // Click-through rate (0-1)
  averageCpc: number;            // In micros

  // Targeting
  targetCpa?: number;            // In micros
  targetRoas?: number;           // 0-1 (e.g., 2.5 = 250% ROAS)

  // Dates
  startDate?: string;            // YYYY-MM-DD
  endDate?: string;              // YYYY-MM-DD

  // Counts
  adGroupCount: number;
  activeAdsCount: number;
  keywordCount: number;

  // Timestamps
  createdAt?: Date;
  lastSyncAt: Date;
}

export interface CampaignWithAdGroups extends Campaign {
  adGroups: AdGroup[];
}

// ============================================================================
// AD GROUP
// ============================================================================

export interface AdGroup {
  id: string;
  resourceName: string;
  campaignId: string;
  name: string;
  status: AdGroupStatus;
  type: AdGroupType;

  // Bidding
  cpcBidMicros?: number;         // Max CPC bid
  cpmBidMicros?: number;         // CPM bid

  // Metrics
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  averageCpc: number;

  // Counts
  adsCount?: number;
  keywordsCount?: number;

  lastSyncAt: Date;
}

export interface AdGroupWithAds extends AdGroup {
  ads: Ad[];
  keywords: Keyword[];
}

// ============================================================================
// AD
// ============================================================================

export interface Ad {
  id: string;
  resourceName: string;
  adGroupId: string;
  campaignId: string;
  name: string;
  status: AdStatus;
  type: AdType;

  // Creative
  headlines: string[];           // Up to 15 for responsive search
  descriptions: string[];        // Up to 4 for responsive search
  finalUrls: string[];
  displayUrl?: string;
  path1?: string;
  path2?: string;

  // Metrics
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  averageCpc: number;

  // Quality
  qualityScore?: number;         // 1-10

  lastSyncAt: Date;
}

// ============================================================================
// KEYWORD
// ============================================================================

export interface Keyword {
  id: string;
  resourceName: string;
  adGroupId: string;
  campaignId: string;
  text: string;
  matchType: KeywordMatchType;
  status: KeywordStatus;

  // Bidding
  cpcBidMicros?: number;

  // URL
  finalUrl?: string;

  // Metrics
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  averageCpc: number;

  // Quality
  qualityScore?: number;
  expectedCtr?: 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE';
  landingPageExperience?: 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE';
  adRelevance?: 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE';

  // Search terms
  searchTermsCount?: number;

  lastSyncAt: Date;
}

// ============================================================================
// BUDGET
// ============================================================================

export interface CampaignBudget {
  id: string;
  resourceName: string;
  name: string;
  amountMicros: number;
  deliveryMethod: 'STANDARD' | 'ACCELERATED';
  type: 'STANDARD' | 'FIXED_CPA' | 'CUSTOM_PERIOD' | 'UNKNOWN';
  sharedBudgetCampaigns: string[];  // Campaign IDs sharing this budget
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  cost: number;                   // In micros
  conversions: number;
  conversionValue: number;
  ctr: number;
  averageCpc: number;
  costPerConversion?: number;
  roas?: number;                  // Return on ad spend
}

export interface DailyMetrics extends PerformanceMetrics {
  date: string;                   // YYYY-MM-DD
}

export interface AccountPerformance {
  accountId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: PerformanceMetrics;
  dailyBreakdown: DailyMetrics[];
  topCampaigns: CampaignPerformanceSummary[];
}

export interface CampaignPerformanceSummary {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  metrics: PerformanceMetrics;
}

// ============================================================================
// SEARCH TERMS REPORT
// ============================================================================

export interface SearchTerm {
  searchTerm: string;
  campaignId: string;
  adGroupId: string;
  keywordId?: string;
  matchType: KeywordMatchType | 'UNSPECIFIED';
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

// ============================================================================
// CHANGE HISTORY
// ============================================================================

export type ChangeType =
  | 'CAMPAIGN_CREATED'
  | 'CAMPAIGN_UPDATED'
  | 'CAMPAIGN_PAUSED'
  | 'CAMPAIGN_ENABLED'
  | 'CAMPAIGN_REMOVED'
  | 'AD_CREATED'
  | 'AD_UPDATED'
  | 'AD_PAUSED'
  | 'AD_ENABLED'
  | 'AD_REMOVED'
  | 'KEYWORD_ADDED'
  | 'KEYWORD_REMOVED'
  | 'KEYWORD_BID_CHANGED'
  | 'BUDGET_CHANGED'
  | 'BID_STRATEGY_CHANGED';

export interface ChangeHistoryEntry {
  id: string;
  accountId: string;
  changeType: ChangeType;
  entityType: 'CAMPAIGN' | 'AD_GROUP' | 'AD' | 'KEYWORD' | 'BUDGET';
  entityId: string;
  entityName: string;
  oldValue?: string;
  newValue?: string;
  changedAt: Date;
  changedBy: 'USER' | 'AUTOMATION' | 'AI' | 'GOOGLE';
  changedByUserId?: string;
  automationRuleId?: string;
}

// ============================================================================
// CAMPAIGN SNAPSHOT (for historical tracking)
// ============================================================================

export interface CampaignSnapshot {
  id: string;
  accountId: string;
  campaignId: string;
  snapshotDate: Date;

  // State at snapshot time
  status: CampaignStatus;
  budgetAmount: number;
  biddingStrategy: BiddingStrategy;
  targetCpa?: number;
  targetRoas?: number;

  // Metrics at snapshot time
  metrics: PerformanceMetrics;

  // Counts
  activeAdGroups: number;
  activeAds: number;
  activeKeywords: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface FetchCampaignsRequest {
  accountId: string;
  customerId: string;
  includeMetrics?: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  status?: CampaignStatus[];
}

export interface FetchCampaignsResponse {
  campaigns: Campaign[];
  totalCount: number;
  syncedAt: Date;
}

export interface FetchAdGroupsRequest {
  accountId: string;
  customerId: string;
  campaignId?: string;
  includeMetrics?: boolean;
}

export interface FetchAdsRequest {
  accountId: string;
  customerId: string;
  adGroupId?: string;
  campaignId?: string;
  includeMetrics?: boolean;
}

export interface FetchKeywordsRequest {
  accountId: string;
  customerId: string;
  adGroupId?: string;
  campaignId?: string;
  includeMetrics?: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Convert micros to currency (e.g., 5000000 -> 5.00)
 */
export function microsToCurrency(micros: number): number {
  return micros / 1_000_000;
}

/**
 * Convert currency to micros (e.g., 5.00 -> 5000000)
 */
export function currencyToMicros(amount: number): number {
  return Math.round(amount * 1_000_000);
}

/**
 * Format CTR as percentage (e.g., 0.0523 -> "5.23%")
 */
export function formatCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(2)}%`;
}

/**
 * Format cost from micros to currency string
 */
export function formatCost(micros: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(microsToCurrency(micros));
}
