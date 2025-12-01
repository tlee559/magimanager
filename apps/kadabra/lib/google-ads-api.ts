/**
 * Google Ads API Client
 * Handles OAuth token exchange, refresh, and metrics fetching
 */

import { sendMessage as sendTelegramMessage } from '@magimanager/core';
import { formatCid, normalizeCid } from '@magimanager/shared';

// Re-export for backwards compatibility
export { formatCid, normalizeCid } from '@magimanager/shared';
import type {
  Campaign,
  CampaignStatus,
  CampaignType,
  BiddingStrategy,
  AdGroup,
  AdGroupStatus,
  AdGroupType,
  Ad,
  AdStatus,
  AdType,
  Keyword,
  KeywordStatus,
  KeywordMatchType,
  PerformanceMetrics,
} from '@magimanager/shared';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Google Ads API version - check https://developers.google.com/google-ads/api/docs/sunset-dates
// for supported versions. Versions sunset ~12 months after release.
const GOOGLE_ADS_API_VERSION = 'v22';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

/**
 * Get a date string in YYYY-MM-DD format with an optional offset
 */
function getDateString(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
}

export interface AccountMetrics {
  customerId: string;
  customerName: string;
  status: string; // ENABLED, CANCELED, SUSPENDED, CLOSED
  costMicros: number;      // All-time spend in micros
  todayCostMicros: number; // Today's spend in micros
  clicks: number;
  impressions: number;
  campaignCount: number;
  adCount: number;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; idToken?: string }> {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!.trim(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data: TokenResponse = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token!,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    idToken: data.id_token,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!.trim(),
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data: TokenResponse = await response.json();

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Get user info from Google (email, id)
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
}

/**
 * List all Google Ads customer IDs accessible by this token
 * Returns an array of customer IDs (without dashes)
 */
export async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  const response = await fetch(`${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list accessible customers: ${error}`);
  }

  const data = await response.json();
  // Response format: { resourceNames: ["customers/1234567890", "customers/0987654321"] }
  return (data.resourceNames || []).map((name: string) => name.replace('customers/', ''));
}

/**
 * Fetch account-level metrics from Google Ads API
 */
export async function fetchAccountMetrics(
  accessToken: string,
  customerId: string
): Promise<AccountMetrics> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  // Remove dashes from customer ID
  const cleanCustomerId = customerId.replace(/-/g, '');

  // Fetch customer details and all-time metrics
  const customerQuery = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.status,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions
    FROM customer
  `;

  const customerResponse = await googleAdsQuery(
    accessToken,
    cleanCustomerId,
    customerQuery,
    developerToken
  );

  // Fetch today's spend separately
  const todaySpendQuery = `
    SELECT
      metrics.cost_micros
    FROM customer
    WHERE segments.date DURING TODAY
  `;

  let todayCostMicros = 0;
  try {
    const todayResponse = await googleAdsQuery(
      accessToken,
      cleanCustomerId,
      todaySpendQuery,
      developerToken
    );
    const todayMetrics = todayResponse[0]?.metrics || {};
    todayCostMicros = parseInt(todayMetrics.costMicros || '0', 10);
  } catch (error) {
    // If today's query fails (e.g., no data for today), default to 0
    console.log('Today spend query returned no data, defaulting to 0');
  }

  // Fetch enabled campaign count
  const campaignQuery = `
    SELECT campaign.id
    FROM campaign
    WHERE campaign.status = 'ENABLED'
  `;

  const campaignResponse = await googleAdsQuery(
    accessToken,
    cleanCustomerId,
    campaignQuery,
    developerToken
  );

  // Fetch enabled ad count
  const adQuery = `
    SELECT ad_group_ad.ad.id
    FROM ad_group_ad
    WHERE ad_group_ad.status = 'ENABLED'
  `;

  const adResponse = await googleAdsQuery(
    accessToken,
    cleanCustomerId,
    adQuery,
    developerToken
  );

  // Parse customer response
  const customerRow = customerResponse[0] || {};
  const customer = customerRow.customer || {};
  const metrics = customerRow.metrics || {};

  return {
    customerId: cleanCustomerId,
    customerName: customer.descriptiveName || 'Unknown',
    status: customer.status || 'UNKNOWN',
    costMicros: parseInt(metrics.costMicros || '0', 10),
    todayCostMicros,
    clicks: parseInt(metrics.clicks || '0', 10),
    impressions: parseInt(metrics.impressions || '0', 10),
    campaignCount: campaignResponse.length,
    adCount: adResponse.length,
  };
}

/**
 * Execute a Google Ads Query Language (GAQL) query
 */
async function googleAdsQuery(
  accessToken: string,
  customerId: string,
  query: string,
  developerToken: string
): Promise<any[]> {
  const response = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    // Check for common errors
    if (error.includes('CUSTOMER_NOT_ENABLED')) {
      throw new Error('Account is not enabled');
    }
    if (error.includes('NOT_ADS_USER')) {
      throw new Error('User does not have access to this account');
    }
    throw new Error(`Google Ads query failed: ${error}`);
  }

  const data = await response.json();
  // searchStream returns an array of batch results
  const results: any[] = [];
  for (const batch of data) {
    if (batch.results) {
      results.push(...batch.results);
    }
  }
  return results;
}

/**
 * Map Google Ads customer status to our account health status
 */
export function mapGoogleStatus(googleStatus: string): string {
  switch (googleStatus) {
    case 'ENABLED':
      return 'active';
    case 'SUSPENDED':
      return 'suspended';
    case 'CANCELED':
    case 'CLOSED':
      return 'banned';
    default:
      return 'unknown';
  }
}

/**
 * Sync a single account - fetches metrics and updates the database
 * Returns the metrics on success, or throws on error
 */
export async function syncSingleAccount(
  accessToken: string,
  accountId: string,
  googleCid: string,
  prismaClient: any
): Promise<AccountMetrics> {
  // Mark as syncing and get current account data for billingStatus
  const account = await prismaClient.adAccount.update({
    where: { id: accountId },
    data: { syncStatus: 'syncing' },
    include: {
      identityProfile: { select: { fullName: true } },
    },
  });

  try {
    // Fetch metrics from Google Ads API
    const metrics = await fetchAccountMetrics(accessToken, googleCid);

    // Convert cost from micros to cents
    const spendCents = Math.round(metrics.costMicros / 10000); // micros / 1M * 100
    const todaySpendCents = Math.round(metrics.todayCostMicros / 10000);

    // Track old health status for change detection
    const oldHealth = account.accountHealth;
    const newHealth = mapGoogleStatus(metrics.status);

    // Determine new status based on spend vs warmup target
    // Only auto-update status if not already handed-off or ready
    let newStatus = account.status;
    if (account.handoffStatus !== 'handed-off' && account.status !== 'ready') {
      if (spendCents >= account.warmupTargetSpend) {
        // Hit warmup target → ready for handoff (regardless of current status)
        newStatus = 'ready';
      } else if (spendCents > 0 && account.status === 'provisioned') {
        // Started spending but not at target yet → warming up
        newStatus = 'warming-up';
      }
    }

    // Update account
    await prismaClient.adAccount.update({
      where: { id: accountId },
      data: {
        currentSpendTotal: spendCents,
        todaySpend: todaySpendCents,
        adsCount: metrics.adCount,
        campaignsCount: metrics.campaignCount,
        accountHealth: newHealth,
        lastGoogleSyncAt: new Date(),
        syncStatus: 'synced',
        googleSyncError: null,
        googleCidVerified: true,
        status: newStatus,
      },
    });

    // Detect suspension - log activity and create notification
    if (newHealth === 'suspended' && oldHealth !== 'suspended') {
      const accountName = account.identityProfile?.fullName || account.googleCid || 'Unknown';

      // Log activity event
      await prismaClient.accountActivity.create({
        data: {
          adAccountId: accountId,
          action: 'ACCOUNT_SUSPENDED',
          details: `Account suspended by Google. CID: ${formatCid(googleCid)}`,
        },
      });

      // Create system notification (no userId - visible to all admins)
      await prismaClient.notification.create({
        data: {
          type: 'ACCOUNT_SUSPENDED',
          title: 'Account Suspended',
          message: `${accountName} (${formatCid(googleCid)}) has been suspended by Google.`,
          entityId: accountId,
          entityType: 'account',
          priority: 'high',
        },
      });

      // Send Telegram alert
      try {
        await sendTelegramMessage(
          `🚨 *Account Suspended*\n\n` +
          `*${accountName}*\n` +
          `CID: \`${formatCid(googleCid)}\`\n\n` +
          `This account has been suspended by Google.`
        );
      } catch (telegramError) {
        console.error('[Sync] Failed to send Telegram alert:', telegramError);
      }

      console.log(`[Sync] Account suspended detected: ${accountName} (${formatCid(googleCid)})`);
    }

    // Also detect reactivation (good to know!)
    if (newHealth === 'active' && oldHealth === 'suspended') {
      const accountName = account.identityProfile?.fullName || account.googleCid || 'Unknown';

      await prismaClient.accountActivity.create({
        data: {
          adAccountId: accountId,
          action: 'ACCOUNT_REACTIVATED',
          details: `Account reactivated. CID: ${formatCid(googleCid)}`,
        },
      });

      await prismaClient.notification.create({
        data: {
          type: 'ACCOUNT_REACTIVATED',
          title: 'Account Reactivated',
          message: `${accountName} (${formatCid(googleCid)}) has been reactivated.`,
          entityId: accountId,
          entityType: 'account',
          priority: 'medium',
        },
      });

      // Send Telegram alert for good news too
      try {
        await sendTelegramMessage(
          `✅ *Account Reactivated*\n\n` +
          `*${accountName}*\n` +
          `CID: \`${formatCid(googleCid)}\`\n\n` +
          `This account has been reactivated!`
        );
      } catch (telegramError) {
        console.error('[Sync] Failed to send Telegram alert:', telegramError);
      }

      console.log(`[Sync] Account reactivated: ${accountName} (${formatCid(googleCid)})`);
    }

    // Create/update daily snapshot
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prismaClient.dailySpendSnapshot.upsert({
      where: {
        adAccountId_date: {
          adAccountId: accountId,
          date: today,
        },
      },
      create: {
        adAccountId: accountId,
        date: today,
        dailySpend: spendCents / 100,
        totalSpend: spendCents / 100,
        adsCount: metrics.adCount,
        campaignsCount: metrics.campaignCount,
        accountHealth: mapGoogleStatus(metrics.status),
        billingStatus: account.billingStatus || 'unknown',
      },
      update: {
        dailySpend: spendCents / 100,
        totalSpend: spendCents / 100,
        adsCount: metrics.adCount,
        campaignsCount: metrics.campaignCount,
        accountHealth: mapGoogleStatus(metrics.status),
      },
    });

    // Cache campaigns for offline viewing
    try {
      const campaigns = await fetchCampaigns(accessToken, googleCid.replace(/-/g, ''), {
        includeMetrics: true,
        dateRangeStart: getDateString(-6), // Last 7 days
        dateRangeEnd: getDateString(0),
      });

      await prismaClient.adAccount.update({
        where: { id: accountId },
        data: {
          cachedCampaigns: JSON.stringify(campaigns),
          campaignsCachedAt: new Date(),
        },
      });

      console.log(`[Sync] Cached ${campaigns.length} campaigns for account ${accountId}`);
    } catch (cacheError) {
      // Don't fail the sync if campaign caching fails
      console.error('[Sync] Campaign caching failed:', cacheError);
    }

    return metrics;
  } catch (error) {
    // Mark as error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await prismaClient.adAccount.update({
      where: { id: accountId },
      data: {
        syncStatus: 'error',
        googleSyncError: errorMessage,
      },
    });
    throw error;
  }
}

/**
 * Build the Google OAuth authorization URL
 */
export function buildOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/adwords openid email profile',
    access_type: 'offline',
    prompt: 'consent', // Force consent to always get refresh token
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ============================================================================
// KADABRA: CAMPAIGN MANAGEMENT API EXTENSIONS
// ============================================================================

export interface FetchCampaignsOptions {
  dateRangeStart?: string;  // YYYY-MM-DD
  dateRangeEnd?: string;    // YYYY-MM-DD
  status?: CampaignStatus[];
  includeMetrics?: boolean;
}

export interface FetchAdGroupsOptions {
  campaignId?: string;
  status?: AdGroupStatus[];
  includeMetrics?: boolean;
}

export interface FetchAdsOptions {
  campaignId?: string;
  adGroupId?: string;
  status?: AdStatus[];
  includeMetrics?: boolean;
}

export interface FetchKeywordsOptions {
  campaignId?: string;
  adGroupId?: string;
  status?: KeywordStatus[];
  includeMetrics?: boolean;
  dateRange?: string;
}

/**
 * Fetch all campaigns for an account with optional metrics
 */
export async function fetchCampaigns(
  accessToken: string,
  customerId: string,
  options: FetchCampaignsOptions = {}
): Promise<Campaign[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  const cleanCustomerId = normalizeCid(customerId);
  const { dateRangeStart, dateRangeEnd, status, includeMetrics = true } = options;

  // First, fetch ALL campaigns without date filter (so suspended/inactive campaigns still appear)
  let campaignsQuery = `
    SELECT
      campaign.id,
      campaign.resource_name,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign_budget.id,
      campaign_budget.amount_micros,
      campaign_budget.name,
      campaign.start_date,
      campaign.end_date,
      campaign.target_cpa.target_cpa_micros,
      campaign.target_roas.target_roas
    FROM campaign
  `;

  // Only filter by status, NOT by date range (date range only affects metrics)
  if (status && status.length > 0) {
    campaignsQuery += ` WHERE campaign.status IN (${status.map(s => `'${s}'`).join(', ')})`;
  }

  campaignsQuery += ` ORDER BY campaign.name`;

  const campaignResults = await googleAdsQuery(accessToken, cleanCustomerId, campaignsQuery, developerToken);

  // Then, separately fetch metrics for the date range (if requested)
  // This allows us to show campaigns even if they have no metrics in the date range
  const metricsMap = new Map<string, {
    impressions: number;
    clicks: number;
    costMicros: number;
    conversions: number;
    conversionsValue: number;
    ctr: number;
    averageCpc: number;
  }>();

  if (includeMetrics && dateRangeStart && dateRangeEnd) {
    const metricsQuery = `
      SELECT
        campaign.id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${dateRangeStart}' AND '${dateRangeEnd}'
    `;

    const metricsResults = await googleAdsQuery(accessToken, cleanCustomerId, metricsQuery, developerToken);

    // Aggregate metrics by campaign (date segments return multiple rows per campaign)
    for (const row of metricsResults) {
      const campaignId = row.campaign?.id?.toString() || '';
      const metrics = row.metrics || {};
      const existing = metricsMap.get(campaignId);

      if (existing) {
        existing.impressions += parseInt(metrics.impressions || '0', 10);
        existing.clicks += parseInt(metrics.clicks || '0', 10);
        existing.costMicros += parseInt(metrics.costMicros || '0', 10);
        existing.conversions += parseFloat(metrics.conversions || '0');
        existing.conversionsValue += parseFloat(metrics.conversionsValue || '0');
      } else {
        metricsMap.set(campaignId, {
          impressions: parseInt(metrics.impressions || '0', 10),
          clicks: parseInt(metrics.clicks || '0', 10),
          costMicros: parseInt(metrics.costMicros || '0', 10),
          conversions: parseFloat(metrics.conversions || '0'),
          conversionsValue: parseFloat(metrics.conversionsValue || '0'),
          ctr: parseFloat(metrics.ctr || '0'),
          averageCpc: parseInt(metrics.averageCpc || '0', 10),
        });
      }
    }

    // Recalculate CTR and average CPC from aggregated values
    for (const [, metrics] of metricsMap) {
      metrics.ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
      metrics.averageCpc = metrics.clicks > 0 ? Math.round(metrics.costMicros / metrics.clicks) : 0;
    }
  }

  // Use campaignResults as the base (all campaigns)
  const results = campaignResults;

  // Also fetch ad group and ad counts per campaign
  const countsQuery = `
    SELECT
      campaign.id,
      ad_group.id
    FROM ad_group
    WHERE ad_group.status != 'REMOVED'
  `;
  const adGroupResults = await googleAdsQuery(accessToken, cleanCustomerId, countsQuery, developerToken);

  const adCountsQuery = `
    SELECT
      campaign.id,
      ad_group_ad.ad.id
    FROM ad_group_ad
    WHERE ad_group_ad.status != 'REMOVED'
  `;
  const adResults = await googleAdsQuery(accessToken, cleanCustomerId, adCountsQuery, developerToken);

  const keywordCountsQuery = `
    SELECT
      campaign.id,
      ad_group_criterion.criterion_id
    FROM ad_group_criterion
    WHERE ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.status != 'REMOVED'
  `;
  const keywordResults = await googleAdsQuery(accessToken, cleanCustomerId, keywordCountsQuery, developerToken);

  // Build counts maps
  const adGroupCounts = new Map<string, number>();
  const adCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();

  for (const row of adGroupResults) {
    const campaignId = row.campaign?.id;
    if (campaignId) {
      adGroupCounts.set(campaignId, (adGroupCounts.get(campaignId) || 0) + 1);
    }
  }

  for (const row of adResults) {
    const campaignId = row.campaign?.id;
    if (campaignId) {
      adCounts.set(campaignId, (adCounts.get(campaignId) || 0) + 1);
    }
  }

  for (const row of keywordResults) {
    const campaignId = row.campaign?.id;
    if (campaignId) {
      keywordCounts.set(campaignId, (keywordCounts.get(campaignId) || 0) + 1);
    }
  }

  // Map results to Campaign type, using metricsMap for date-range metrics
  return results.map((row): Campaign => {
    const campaign = row.campaign || {};
    const budget = row.campaignBudget || {};
    const campaignId = campaign.id?.toString() || '';

    // Get metrics from metricsMap (aggregated by date range) or default to 0
    const metrics = metricsMap.get(campaignId) || {
      impressions: 0,
      clicks: 0,
      costMicros: 0,
      conversions: 0,
      conversionsValue: 0,
      ctr: 0,
      averageCpc: 0,
    };

    return {
      id: campaignId,
      resourceName: campaign.resourceName || '',
      name: campaign.name || 'Unnamed Campaign',
      status: mapCampaignStatus(campaign.status),
      type: mapCampaignType(campaign.advertisingChannelType),
      biddingStrategy: mapBiddingStrategy(campaign.biddingStrategyType),
      budgetId: budget.id?.toString() || '',
      budgetAmount: parseInt(budget.amountMicros || '0', 10),
      budgetName: budget.name || '',
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      cost: metrics.costMicros,
      conversions: metrics.conversions,
      conversionValue: metrics.conversionsValue,
      ctr: metrics.ctr,
      averageCpc: metrics.averageCpc,
      targetCpa: campaign.targetCpa?.targetCpaMicros
        ? parseInt(campaign.targetCpa.targetCpaMicros, 10)
        : undefined,
      targetRoas: campaign.targetRoas?.targetRoas
        ? parseFloat(campaign.targetRoas.targetRoas)
        : undefined,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      adGroupCount: adGroupCounts.get(campaignId) || 0,
      activeAdsCount: adCounts.get(campaignId) || 0,
      keywordCount: keywordCounts.get(campaignId) || 0,
      lastSyncAt: new Date(),
    };
  });
}

/**
 * Fetch ad groups for an account or specific campaign
 */
export async function fetchAdGroups(
  accessToken: string,
  customerId: string,
  options: FetchAdGroupsOptions = {}
): Promise<AdGroup[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  const cleanCustomerId = normalizeCid(customerId);
  const { campaignId, status, includeMetrics = true } = options;

  let query = `
    SELECT
      ad_group.id,
      ad_group.resource_name,
      ad_group.campaign,
      ad_group.name,
      ad_group.status,
      ad_group.type,
      ad_group.cpc_bid_micros,
      ad_group.cpm_bid_micros
  `;

  if (includeMetrics) {
    query += `,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    `;
  }

  query += `
    FROM ad_group
  `;

  const whereClauses: string[] = [];

  if (campaignId) {
    whereClauses.push(`ad_group.campaign = 'customers/${cleanCustomerId}/campaigns/${campaignId}'`);
  }

  if (status && status.length > 0) {
    whereClauses.push(`ad_group.status IN (${status.map(s => `'${s}'`).join(', ')})`);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  query += ` ORDER BY ad_group.name`;

  const results = await googleAdsQuery(accessToken, cleanCustomerId, query, developerToken);

  return results.map((row): AdGroup => {
    const adGroup = row.adGroup || {};
    const metrics = row.metrics || {};

    // Extract campaign ID from resource name
    const campaignMatch = adGroup.campaign?.match(/campaigns\/(\d+)/);
    const extractedCampaignId = campaignMatch ? campaignMatch[1] : '';

    return {
      id: adGroup.id?.toString() || '',
      resourceName: adGroup.resourceName || '',
      campaignId: extractedCampaignId,
      name: adGroup.name || 'Unnamed Ad Group',
      status: mapAdGroupStatus(adGroup.status),
      type: mapAdGroupType(adGroup.type),
      cpcBidMicros: adGroup.cpcBidMicros ? parseInt(adGroup.cpcBidMicros, 10) : undefined,
      cpmBidMicros: adGroup.cpmBidMicros ? parseInt(adGroup.cpmBidMicros, 10) : undefined,
      impressions: parseInt(metrics.impressions || '0', 10),
      clicks: parseInt(metrics.clicks || '0', 10),
      cost: parseInt(metrics.costMicros || '0', 10),
      conversions: parseFloat(metrics.conversions || '0'),
      conversionValue: parseFloat(metrics.conversionsValue || '0'),
      ctr: parseFloat(metrics.ctr || '0'),
      averageCpc: parseInt(metrics.averageCpc || '0', 10),
      adsCount: 0, // Will be populated separately if needed
      keywordsCount: 0,
      lastSyncAt: new Date(),
    };
  });
}

/**
 * Fetch ads for an account, campaign, or ad group
 */
export async function fetchAds(
  accessToken: string,
  customerId: string,
  options: FetchAdsOptions = {}
): Promise<Ad[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  const cleanCustomerId = normalizeCid(customerId);
  const { campaignId, adGroupId, status, includeMetrics = true } = options;

  let query = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.resource_name,
      ad_group_ad.ad_group,
      ad_group_ad.ad.name,
      ad_group_ad.status,
      ad_group_ad.ad.type,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.display_url,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.responsive_search_ad.path1,
      ad_group_ad.ad.responsive_search_ad.path2
  `;

  if (includeMetrics) {
    query += `,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    `;
  }

  query += `
    FROM ad_group_ad
  `;

  const whereClauses: string[] = [];

  if (campaignId) {
    whereClauses.push(`ad_group.campaign = 'customers/${cleanCustomerId}/campaigns/${campaignId}'`);
  }

  if (adGroupId) {
    whereClauses.push(`ad_group_ad.ad_group = 'customers/${cleanCustomerId}/adGroups/${adGroupId}'`);
  }

  if (status && status.length > 0) {
    whereClauses.push(`ad_group_ad.status IN (${status.map(s => `'${s}'`).join(', ')})`);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  const results = await googleAdsQuery(accessToken, cleanCustomerId, query, developerToken);

  return results.map((row): Ad => {
    const adGroupAd = row.adGroupAd || {};
    const ad = adGroupAd.ad || {};
    const metrics = row.metrics || {};
    const responsiveSearchAd = ad.responsiveSearchAd || {};

    // Extract ad group and campaign IDs
    const adGroupMatch = adGroupAd.adGroup?.match(/adGroups\/(\d+)/);
    const extractedAdGroupId = adGroupMatch ? adGroupMatch[1] : '';

    // Extract headlines and descriptions from responsive search ads
    const headlines = (responsiveSearchAd.headlines || []).map((h: any) => h.text || '');
    const descriptions = (responsiveSearchAd.descriptions || []).map((d: any) => d.text || '');

    return {
      id: ad.id?.toString() || '',
      resourceName: ad.resourceName || '',
      adGroupId: extractedAdGroupId,
      campaignId: campaignId || '',
      name: ad.name || 'Unnamed Ad',
      status: mapAdStatus(adGroupAd.status),
      type: mapAdType(ad.type),
      headlines,
      descriptions,
      finalUrls: ad.finalUrls || [],
      displayUrl: ad.displayUrl,
      path1: responsiveSearchAd.path1,
      path2: responsiveSearchAd.path2,
      impressions: parseInt(metrics.impressions || '0', 10),
      clicks: parseInt(metrics.clicks || '0', 10),
      cost: parseInt(metrics.costMicros || '0', 10),
      conversions: parseFloat(metrics.conversions || '0'),
      ctr: parseFloat(metrics.ctr || '0'),
      averageCpc: parseInt(metrics.averageCpc || '0', 10),
      lastSyncAt: new Date(),
    };
  });
}

/**
 * Fetch keywords for an account, campaign, or ad group
 * Uses keyword_view resource which supports metrics (unlike ad_group_criterion alone)
 */
export async function fetchKeywords(
  accessToken: string,
  customerId: string,
  options: FetchKeywordsOptions = {}
): Promise<Keyword[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  const cleanCustomerId = normalizeCid(customerId);
  const { campaignId, adGroupId, status, includeMetrics = true, dateRange = 'LAST_30_DAYS' } = options;

  // Build WHERE clause filters
  const buildWhereClause = (includesDateRange: boolean): string => {
    const whereClauses: string[] = [];

    if (includesDateRange) {
      whereClauses.push(`segments.date DURING ${dateRange}`);
    }

    if (campaignId) {
      whereClauses.push(`campaign.id = ${campaignId}`);
    }

    if (adGroupId) {
      whereClauses.push(`ad_group.id = ${adGroupId}`);
    }

    if (status && status.length > 0) {
      whereClauses.push(`ad_group_criterion.status IN (${status.map(s => `'${s}'`).join(', ')})`);
    }

    // Only include keyword type criteria
    whereClauses.push(`ad_group_criterion.type = 'KEYWORD'`);

    return whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
  };

  // IMPORTANT: Google Ads API requires separate queries for:
  // 1. Metrics (clicks, impressions, cost, etc.) - requires keyword_view + date range
  // 2. Quality Info (quality_score, predicted_ctr, etc.) - cannot be combined with metrics
  // We run both queries and merge results by criterion ID

  // Query 1: Fetch metrics from keyword_view (requires date range)
  const metricsQuery = `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.resource_name,
      ad_group_criterion.ad_group,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.cpc_bid_micros,
      campaign.id,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM keyword_view
    ${buildWhereClause(true)}
  `;

  // Query 2: Fetch quality info from ad_group_criterion (no date range needed)
  const qualityQuery = `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.search_predicted_ctr,
      ad_group_criterion.quality_info.creative_quality_score,
      ad_group_criterion.quality_info.post_click_quality_score
    FROM ad_group_criterion
    ${buildWhereClause(false)}
  `;

  // Run both queries in parallel
  const [metricsResults, qualityResults] = await Promise.all([
    includeMetrics
      ? googleAdsQuery(accessToken, cleanCustomerId, metricsQuery, developerToken)
      : Promise.resolve([]),
    googleAdsQuery(accessToken, cleanCustomerId, qualityQuery, developerToken)
  ]);

  // Build a map of criterion ID -> quality info
  const qualityMap = new Map<string, any>();
  for (const row of qualityResults) {
    const criterionId = row.adGroupCriterion?.criterionId?.toString();
    if (criterionId) {
      qualityMap.set(criterionId, row.adGroupCriterion?.qualityInfo || {});
    }
  }

  // If we don't have metrics, use qualityResults as the base
  const baseResults = includeMetrics ? metricsResults : qualityResults;

  return baseResults.map((row): Keyword => {
    const criterion = row.adGroupCriterion || {};
    const keyword = criterion.keyword || {};
    const metrics = row.metrics || {};
    const campaign = row.campaign || {};

    // Get quality info from the quality map
    const criterionId = criterion.criterionId?.toString() || '';
    const qualityInfo = qualityMap.get(criterionId) || {};

    // Extract ad group ID from resource name
    const adGroupMatch = criterion.adGroup?.match(/adGroups\/(\d+)/);
    const extractedAdGroupId = adGroupMatch ? adGroupMatch[1] : '';

    return {
      id: criterion.criterionId?.toString() || '',
      resourceName: criterion.resourceName || '',
      adGroupId: extractedAdGroupId,
      campaignId: campaign.id?.toString() || campaignId || '',
      text: keyword.text || '',
      matchType: mapKeywordMatchType(keyword.matchType),
      status: mapKeywordStatus(criterion.status),
      cpcBidMicros: criterion.cpcBidMicros ? parseInt(criterion.cpcBidMicros, 10) : undefined,
      impressions: parseInt(metrics.impressions || '0', 10),
      clicks: parseInt(metrics.clicks || '0', 10),
      cost: parseInt(metrics.costMicros || '0', 10),
      conversions: parseFloat(metrics.conversions || '0'),
      ctr: parseFloat(metrics.ctr || '0'),
      averageCpc: parseInt(metrics.averageCpc || '0', 10),
      qualityScore: qualityInfo.qualityScore,
      expectedCtr: mapQualityRating(qualityInfo.searchPredictedCtr),
      landingPageExperience: mapQualityRating(qualityInfo.postClickQualityScore),
      adRelevance: mapQualityRating(qualityInfo.creativeQualityScore),
      lastSyncAt: new Date(),
    };
  });
}

/**
 * Fetch account performance summary for a date range
 */
export async function fetchAccountPerformance(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string
): Promise<PerformanceMetrics & { dailyBreakdown: Array<PerformanceMetrics & { date: string }> }> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  const cleanCustomerId = normalizeCid(customerId);

  // Fetch daily metrics
  const query = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM customer
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date
  `;

  const results = await googleAdsQuery(accessToken, cleanCustomerId, query, developerToken);

  // Aggregate totals and build daily breakdown
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalCost = 0;
  let totalConversions = 0;
  let totalConversionValue = 0;

  const dailyBreakdown = results.map((row) => {
    const metrics = row.metrics || {};
    const segments = row.segments || {};

    const impressions = parseInt(metrics.impressions || '0', 10);
    const clicks = parseInt(metrics.clicks || '0', 10);
    const cost = parseInt(metrics.costMicros || '0', 10);
    const conversions = parseFloat(metrics.conversions || '0');
    const conversionValue = parseFloat(metrics.conversionsValue || '0');

    totalImpressions += impressions;
    totalClicks += clicks;
    totalCost += cost;
    totalConversions += conversions;
    totalConversionValue += conversionValue;

    return {
      date: segments.date,
      impressions,
      clicks,
      cost,
      conversions,
      conversionValue,
      ctr: parseFloat(metrics.ctr || '0'),
      averageCpc: parseInt(metrics.averageCpc || '0', 10),
    };
  });

  // Calculate aggregate metrics
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgCpc = totalClicks > 0 ? totalCost / totalClicks : 0;
  const costPerConversion = totalConversions > 0 ? totalCost / totalConversions : undefined;
  const roas = totalCost > 0 ? (totalConversionValue * 1000000) / totalCost : undefined;

  return {
    impressions: totalImpressions,
    clicks: totalClicks,
    cost: totalCost,
    conversions: totalConversions,
    conversionValue: totalConversionValue,
    ctr: avgCtr,
    averageCpc: avgCpc,
    costPerConversion,
    roas,
    dailyBreakdown,
  };
}

// ============================================================================
// SEARCH TERMS & RECOMMENDATIONS (KADABRA INTELLIGENCE)
// ============================================================================

export interface SearchTerm {
  searchTerm: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  keywordText?: string;
  keywordMatchType?: KeywordMatchType;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  averageCpc: number;
  conversionRate: number;
  costPerConversion?: number;
}

export interface FetchSearchTermsOptions {
  campaignId?: string;
  adGroupId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  minImpressions?: number;
  minCost?: number;
  sortBy?: 'cost' | 'impressions' | 'clicks' | 'conversions';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Fetch search terms report - shows actual queries that triggered ads
 * This is incredibly valuable for finding wasted spend and new opportunities
 */
export async function fetchSearchTerms(
  accessToken: string,
  customerId: string,
  options: FetchSearchTermsOptions = {}
): Promise<SearchTerm[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  const cleanCustomerId = normalizeCid(customerId);
  const {
    campaignId,
    adGroupId,
    startDate,
    endDate,
    minImpressions = 0,
    minCost = 0,
    sortBy = 'cost',
    sortOrder = 'desc',
    limit = 500,
  } = options;

  // Default to last 30 days if no date range provided
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const effectiveStartDate = startDate || thirtyDaysAgo.toISOString().split('T')[0];
  const effectiveEndDate = endDate || today.toISOString().split('T')[0];

  let query = `
    SELECT
      search_term_view.search_term,
      search_term_view.resource_name,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      segments.keyword.info.text,
      segments.keyword.info.match_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM search_term_view
    WHERE segments.date BETWEEN '${effectiveStartDate}' AND '${effectiveEndDate}'
  `;

  if (campaignId) {
    query += ` AND campaign.id = ${campaignId}`;
  }

  if (adGroupId) {
    query += ` AND ad_group.id = ${adGroupId}`;
  }

  // Map sort fields to GAQL column names
  const sortFieldMap: Record<string, string> = {
    cost: 'metrics.cost_micros',
    impressions: 'metrics.impressions',
    clicks: 'metrics.clicks',
    conversions: 'metrics.conversions',
  };

  const sortField = sortFieldMap[sortBy] || 'metrics.cost_micros';
  query += ` ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;
  query += ` LIMIT ${limit}`;

  const results = await googleAdsQuery(accessToken, cleanCustomerId, query, developerToken);

  return results
    .map((row): SearchTerm => {
      const searchTermView = row.searchTermView || {};
      const campaign = row.campaign || {};
      const adGroup = row.adGroup || {};
      const segments = row.segments || {};
      const keyword = segments.keyword?.info || {};
      const metrics = row.metrics || {};

      const impressions = parseInt(metrics.impressions || '0', 10);
      const clicks = parseInt(metrics.clicks || '0', 10);
      const cost = parseInt(metrics.costMicros || '0', 10);
      const conversions = parseFloat(metrics.conversions || '0');

      return {
        searchTerm: searchTermView.searchTerm || '',
        campaignId: campaign.id?.toString() || '',
        campaignName: campaign.name || '',
        adGroupId: adGroup.id?.toString() || '',
        adGroupName: adGroup.name || '',
        keywordText: keyword.text,
        keywordMatchType: keyword.matchType ? mapKeywordMatchType(keyword.matchType) : undefined,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: parseFloat(metrics.ctr || '0'),
        averageCpc: parseInt(metrics.averageCpc || '0', 10),
        conversionRate: clicks > 0 ? conversions / clicks : 0,
        costPerConversion: conversions > 0 ? cost / conversions : undefined,
      };
    })
    .filter((term) => {
      // Apply post-query filters for min thresholds
      if (minImpressions > 0 && term.impressions < minImpressions) return false;
      if (minCost > 0 && term.cost < minCost * 1000000) return false; // minCost is in dollars, cost is micros
      return true;
    });
}

/**
 * Analyze search terms to find wasted spend (high cost, zero conversions)
 */
export async function analyzeWastedSpend(
  accessToken: string,
  customerId: string,
  options: { startDate?: string; endDate?: string; minCost?: number } = {}
): Promise<{
  totalWastedSpend: number;
  wastedTerms: SearchTerm[];
  topWasters: SearchTerm[];
}> {
  const searchTerms = await fetchSearchTerms(accessToken, customerId, {
    ...options,
    sortBy: 'cost',
    sortOrder: 'desc',
    limit: 1000,
  });

  // Filter to search terms with spend but no conversions
  const wastedTerms = searchTerms.filter(
    (term) => term.cost > 0 && term.conversions === 0
  );

  const totalWastedSpend = wastedTerms.reduce((sum, term) => sum + term.cost, 0);

  // Top 10 wasters
  const topWasters = wastedTerms.slice(0, 10);

  return {
    totalWastedSpend,
    wastedTerms,
    topWasters,
  };
}

// ============================================================================
// GOOGLE ADS RECOMMENDATIONS
// ============================================================================

export type RecommendationType =
  | 'CAMPAIGN_BUDGET'
  | 'KEYWORD'
  | 'TEXT_AD'
  | 'TARGET_CPA_OPT_IN'
  | 'MAXIMIZE_CONVERSIONS_OPT_IN'
  | 'MAXIMIZE_CLICKS_OPT_IN'
  | 'ENHANCED_CPC_OPT_IN'
  | 'SEARCH_PARTNERS_OPT_IN'
  | 'SITELINK_EXTENSION'
  | 'CALL_EXTENSION'
  | 'CALLOUT_EXTENSION'
  | 'KEYWORD_MATCH_TYPE'
  | 'MOVE_UNUSED_BUDGET'
  | 'FORECASTING_CAMPAIGN_BUDGET'
  | 'RESPONSIVE_SEARCH_AD'
  | 'MARGINAL_ROI_CAMPAIGN_BUDGET'
  | 'UPGRADE_SMART_SHOPPING_CAMPAIGN_TO_PERFORMANCE_MAX'
  | 'RESPONSIVE_SEARCH_AD_ASSET'
  | 'UPGRADE_LOCAL_CAMPAIGN_TO_PERFORMANCE_MAX'
  | 'UNKNOWN';

export interface Recommendation {
  id: string;
  resourceName: string;
  type: RecommendationType;
  typeDisplay: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  impact?: {
    baseMetrics?: {
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
    };
    potentialMetrics?: {
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
    };
  };
  dismissed: boolean;
  // Specific recommendation details
  budgetRecommendation?: {
    currentBudgetMicros: number;
    recommendedBudgetMicros: number;
  };
  keywordRecommendation?: {
    keyword: string;
    matchType: KeywordMatchType;
    recommendedCpcBidMicros?: number;
  };
  textAdRecommendation?: {
    headlines: string[];
    descriptions: string[];
  };
}

export interface FetchRecommendationsOptions {
  campaignId?: string;
  types?: RecommendationType[];
  includeDismissed?: boolean;
}

/**
 * Fetch Google's native recommendations for the account
 * These are AI-generated suggestions from Google to improve performance
 */
export async function fetchRecommendations(
  accessToken: string,
  customerId: string,
  options: FetchRecommendationsOptions = {}
): Promise<Recommendation[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
  }

  const cleanCustomerId = normalizeCid(customerId);
  const { campaignId, types, includeDismissed = false } = options;

  let query = `
    SELECT
      recommendation.resource_name,
      recommendation.type,
      recommendation.campaign,
      recommendation.ad_group,
      recommendation.dismissed,
      recommendation.impact,
      recommendation.campaign_budget_recommendation,
      recommendation.keyword_recommendation,
      recommendation.text_ad_recommendation
    FROM recommendation
  `;

  const whereClauses: string[] = [];

  if (!includeDismissed) {
    whereClauses.push('recommendation.dismissed = FALSE');
  }

  if (campaignId) {
    whereClauses.push(`recommendation.campaign = 'customers/${cleanCustomerId}/campaigns/${campaignId}'`);
  }

  if (types && types.length > 0) {
    whereClauses.push(`recommendation.type IN (${types.map(t => `'${t}'`).join(', ')})`);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  const results = await googleAdsQuery(accessToken, cleanCustomerId, query, developerToken);

  return results.map((row): Recommendation => {
    const rec = row.recommendation || {};

    // Extract campaign ID from resource name
    const campaignMatch = rec.campaign?.match(/campaigns\/(\d+)/);
    const extractedCampaignId = campaignMatch ? campaignMatch[1] : undefined;

    // Extract ad group ID from resource name
    const adGroupMatch = rec.adGroup?.match(/adGroups\/(\d+)/);
    const extractedAdGroupId = adGroupMatch ? adGroupMatch[1] : undefined;

    // Parse impact metrics
    let impact: Recommendation['impact'];
    if (rec.impact) {
      const baseMetrics = rec.impact.baseMetrics || {};
      const potentialMetrics = rec.impact.potentialMetrics || {};
      impact = {
        baseMetrics: {
          impressions: parseInt(baseMetrics.impressions || '0', 10),
          clicks: parseInt(baseMetrics.clicks || '0', 10),
          cost: parseInt(baseMetrics.costMicros || '0', 10),
          conversions: parseFloat(baseMetrics.conversions || '0'),
        },
        potentialMetrics: {
          impressions: parseInt(potentialMetrics.impressions || '0', 10),
          clicks: parseInt(potentialMetrics.clicks || '0', 10),
          cost: parseInt(potentialMetrics.costMicros || '0', 10),
          conversions: parseFloat(potentialMetrics.conversions || '0'),
        },
      };
    }

    // Parse specific recommendation types
    let budgetRecommendation: Recommendation['budgetRecommendation'];
    if (rec.campaignBudgetRecommendation) {
      const br = rec.campaignBudgetRecommendation;
      budgetRecommendation = {
        currentBudgetMicros: parseInt(br.currentBudgetAmountMicros || '0', 10),
        recommendedBudgetMicros: parseInt(br.recommendedBudgetAmountMicros || '0', 10),
      };
    }

    let keywordRecommendation: Recommendation['keywordRecommendation'];
    if (rec.keywordRecommendation) {
      const kr = rec.keywordRecommendation;
      keywordRecommendation = {
        keyword: kr.keyword?.text || '',
        matchType: mapKeywordMatchType(kr.keyword?.matchType || 'BROAD'),
        recommendedCpcBidMicros: kr.recommendedCpcBidMicros
          ? parseInt(kr.recommendedCpcBidMicros, 10)
          : undefined,
      };
    }

    let textAdRecommendation: Recommendation['textAdRecommendation'];
    if (rec.textAdRecommendation) {
      const tar = rec.textAdRecommendation;
      textAdRecommendation = {
        headlines: (tar.ad?.responsiveSearchAd?.headlines || []).map((h: any) => h.text || ''),
        descriptions: (tar.ad?.responsiveSearchAd?.descriptions || []).map((d: any) => d.text || ''),
      };
    }

    // Extract ID from resource name
    const idMatch = rec.resourceName?.match(/recommendations\/(\d+)/);
    const id = idMatch ? idMatch[1] : '';

    return {
      id,
      resourceName: rec.resourceName || '',
      type: mapRecommendationType(rec.type),
      typeDisplay: getRecommendationTypeDisplay(rec.type),
      campaignId: extractedCampaignId,
      adGroupId: extractedAdGroupId,
      impact,
      dismissed: rec.dismissed || false,
      budgetRecommendation,
      keywordRecommendation,
      textAdRecommendation,
    };
  });
}

/**
 * Get recommendation summary for dashboard display
 */
export async function getRecommendationSummary(
  accessToken: string,
  customerId: string
): Promise<{
  totalRecommendations: number;
  byType: Record<string, number>;
  potentialImpact: {
    additionalConversions: number;
    additionalClicks: number;
    costChange: number;
  };
  highPriority: Recommendation[];
}> {
  const recommendations = await fetchRecommendations(accessToken, customerId, {
    includeDismissed: false,
  });

  // Count by type
  const byType: Record<string, number> = {};
  for (const rec of recommendations) {
    byType[rec.typeDisplay] = (byType[rec.typeDisplay] || 0) + 1;
  }

  // Calculate potential impact
  let additionalConversions = 0;
  let additionalClicks = 0;
  let costChange = 0;

  for (const rec of recommendations) {
    if (rec.impact?.baseMetrics && rec.impact?.potentialMetrics) {
      additionalConversions += rec.impact.potentialMetrics.conversions - rec.impact.baseMetrics.conversions;
      additionalClicks += rec.impact.potentialMetrics.clicks - rec.impact.baseMetrics.clicks;
      costChange += rec.impact.potentialMetrics.cost - rec.impact.baseMetrics.cost;
    }
  }

  // Get high priority recommendations (budget and conversion-related)
  const highPriorityTypes: RecommendationType[] = [
    'CAMPAIGN_BUDGET',
    'FORECASTING_CAMPAIGN_BUDGET',
    'MARGINAL_ROI_CAMPAIGN_BUDGET',
    'MAXIMIZE_CONVERSIONS_OPT_IN',
    'TARGET_CPA_OPT_IN',
  ];

  const highPriority = recommendations
    .filter((rec) => highPriorityTypes.includes(rec.type))
    .slice(0, 5);

  return {
    totalRecommendations: recommendations.length,
    byType,
    potentialImpact: {
      additionalConversions,
      additionalClicks,
      costChange,
    },
    highPriority,
  };
}

function mapRecommendationType(type: string): RecommendationType {
  const typeMap: Record<string, RecommendationType> = {
    'CAMPAIGN_BUDGET': 'CAMPAIGN_BUDGET',
    'KEYWORD': 'KEYWORD',
    'TEXT_AD': 'TEXT_AD',
    'TARGET_CPA_OPT_IN': 'TARGET_CPA_OPT_IN',
    'MAXIMIZE_CONVERSIONS_OPT_IN': 'MAXIMIZE_CONVERSIONS_OPT_IN',
    'MAXIMIZE_CLICKS_OPT_IN': 'MAXIMIZE_CLICKS_OPT_IN',
    'ENHANCED_CPC_OPT_IN': 'ENHANCED_CPC_OPT_IN',
    'SEARCH_PARTNERS_OPT_IN': 'SEARCH_PARTNERS_OPT_IN',
    'SITELINK_EXTENSION': 'SITELINK_EXTENSION',
    'CALL_EXTENSION': 'CALL_EXTENSION',
    'CALLOUT_EXTENSION': 'CALLOUT_EXTENSION',
    'KEYWORD_MATCH_TYPE': 'KEYWORD_MATCH_TYPE',
    'MOVE_UNUSED_BUDGET': 'MOVE_UNUSED_BUDGET',
    'FORECASTING_CAMPAIGN_BUDGET': 'FORECASTING_CAMPAIGN_BUDGET',
    'RESPONSIVE_SEARCH_AD': 'RESPONSIVE_SEARCH_AD',
    'MARGINAL_ROI_CAMPAIGN_BUDGET': 'MARGINAL_ROI_CAMPAIGN_BUDGET',
    'UPGRADE_SMART_SHOPPING_CAMPAIGN_TO_PERFORMANCE_MAX': 'UPGRADE_SMART_SHOPPING_CAMPAIGN_TO_PERFORMANCE_MAX',
    'RESPONSIVE_SEARCH_AD_ASSET': 'RESPONSIVE_SEARCH_AD_ASSET',
    'UPGRADE_LOCAL_CAMPAIGN_TO_PERFORMANCE_MAX': 'UPGRADE_LOCAL_CAMPAIGN_TO_PERFORMANCE_MAX',
  };
  return typeMap[type] || 'UNKNOWN';
}

function getRecommendationTypeDisplay(type: string): string {
  const displayMap: Record<string, string> = {
    'CAMPAIGN_BUDGET': 'Increase Budget',
    'KEYWORD': 'Add Keywords',
    'TEXT_AD': 'Improve Ads',
    'TARGET_CPA_OPT_IN': 'Use Target CPA',
    'MAXIMIZE_CONVERSIONS_OPT_IN': 'Maximize Conversions',
    'MAXIMIZE_CLICKS_OPT_IN': 'Maximize Clicks',
    'ENHANCED_CPC_OPT_IN': 'Enhanced CPC',
    'SEARCH_PARTNERS_OPT_IN': 'Search Partners',
    'SITELINK_EXTENSION': 'Add Sitelinks',
    'CALL_EXTENSION': 'Add Call Extension',
    'CALLOUT_EXTENSION': 'Add Callouts',
    'KEYWORD_MATCH_TYPE': 'Keyword Match Type',
    'MOVE_UNUSED_BUDGET': 'Move Unused Budget',
    'FORECASTING_CAMPAIGN_BUDGET': 'Budget Forecast',
    'RESPONSIVE_SEARCH_AD': 'Add Responsive Ads',
    'MARGINAL_ROI_CAMPAIGN_BUDGET': 'ROI Budget',
    'UPGRADE_SMART_SHOPPING_CAMPAIGN_TO_PERFORMANCE_MAX': 'Upgrade to PMax',
    'RESPONSIVE_SEARCH_AD_ASSET': 'Add Ad Assets',
    'UPGRADE_LOCAL_CAMPAIGN_TO_PERFORMANCE_MAX': 'Upgrade Local to PMax',
  };
  return displayMap[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// MAPPING HELPERS
// ============================================================================

function mapCampaignStatus(status: string): CampaignStatus {
  switch (status) {
    case 'ENABLED': return 'ENABLED';
    case 'PAUSED': return 'PAUSED';
    case 'REMOVED': return 'REMOVED';
    default: return 'PAUSED';
  }
}

function mapCampaignType(type: string): CampaignType {
  switch (type) {
    case 'SEARCH': return 'SEARCH';
    case 'DISPLAY': return 'DISPLAY';
    case 'VIDEO': return 'VIDEO';
    case 'SHOPPING': return 'SHOPPING';
    case 'PERFORMANCE_MAX': return 'PERFORMANCE_MAX';
    case 'APP': return 'APP';
    case 'SMART': return 'SMART';
    case 'LOCAL': return 'LOCAL';
    default: return 'UNKNOWN';
  }
}

function mapBiddingStrategy(strategy: string): BiddingStrategy {
  switch (strategy) {
    case 'MANUAL_CPC': return 'MANUAL_CPC';
    case 'MAXIMIZE_CLICKS': return 'MAXIMIZE_CLICKS';
    case 'MAXIMIZE_CONVERSIONS': return 'MAXIMIZE_CONVERSIONS';
    case 'MAXIMIZE_CONVERSION_VALUE': return 'MAXIMIZE_CONVERSION_VALUE';
    case 'TARGET_CPA': return 'TARGET_CPA';
    case 'TARGET_ROAS': return 'TARGET_ROAS';
    case 'TARGET_IMPRESSION_SHARE': return 'TARGET_IMPRESSION_SHARE';
    case 'ENHANCED_CPC': return 'ENHANCED_CPC';
    default: return 'UNKNOWN';
  }
}

function mapAdGroupStatus(status: string): AdGroupStatus {
  switch (status) {
    case 'ENABLED': return 'ENABLED';
    case 'PAUSED': return 'PAUSED';
    case 'REMOVED': return 'REMOVED';
    default: return 'PAUSED';
  }
}

function mapAdGroupType(type: string): AdGroupType {
  switch (type) {
    case 'SEARCH_STANDARD': return 'SEARCH_STANDARD';
    case 'SEARCH_DYNAMIC_ADS': return 'SEARCH_DYNAMIC_ADS';
    case 'DISPLAY_STANDARD': return 'DISPLAY_STANDARD';
    case 'SHOPPING_PRODUCT_ADS': return 'SHOPPING_PRODUCT_ADS';
    case 'VIDEO_TRUE_VIEW_IN_STREAM': return 'VIDEO_TRUE_VIEW_IN_STREAM';
    default: return 'UNKNOWN';
  }
}

function mapAdStatus(status: string): AdStatus {
  switch (status) {
    case 'ENABLED': return 'ENABLED';
    case 'PAUSED': return 'PAUSED';
    case 'REMOVED': return 'REMOVED';
    default: return 'PAUSED';
  }
}

function mapAdType(type: string): AdType {
  switch (type) {
    case 'RESPONSIVE_SEARCH_AD': return 'RESPONSIVE_SEARCH_AD';
    case 'RESPONSIVE_DISPLAY_AD': return 'RESPONSIVE_DISPLAY_AD';
    case 'EXPANDED_TEXT_AD': return 'EXPANDED_TEXT_AD';
    case 'CALL_AD': return 'CALL_AD';
    case 'IMAGE_AD': return 'IMAGE_AD';
    case 'VIDEO_AD': return 'VIDEO_AD';
    default: return 'UNKNOWN';
  }
}

function mapKeywordStatus(status: string): KeywordStatus {
  switch (status) {
    case 'ENABLED': return 'ENABLED';
    case 'PAUSED': return 'PAUSED';
    case 'REMOVED': return 'REMOVED';
    default: return 'PAUSED';
  }
}

function mapKeywordMatchType(matchType: string): KeywordMatchType {
  switch (matchType) {
    case 'EXACT': return 'EXACT';
    case 'PHRASE': return 'PHRASE';
    case 'BROAD': return 'BROAD';
    default: return 'BROAD';
  }
}

function mapQualityRating(rating: string): 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE' | undefined {
  switch (rating) {
    case 'BELOW_AVERAGE': return 'BELOW_AVERAGE';
    case 'AVERAGE': return 'AVERAGE';
    case 'ABOVE_AVERAGE': return 'ABOVE_AVERAGE';
    default: return undefined;
  }
}

// Export the internal query function for advanced use cases
export { googleAdsQuery };
