/**
 * Google Ads API Client
 * Handles OAuth token exchange, refresh, and metrics fetching
 */

import { sendMessage as sendTelegramMessage } from './telegram-bot';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Google Ads API version - check https://developers.google.com/google-ads/api/docs/sunset-dates
// for supported versions. Versions sunset ~12 months after release.
const GOOGLE_ADS_API_VERSION = 'v22';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

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
 * Normalize a CID (customer ID) to format without dashes
 * Input: "123-456-7890" or "1234567890"
 * Output: "1234567890"
 */
export function normalizeCid(cid: string): string {
  return cid.replace(/-/g, '');
}

/**
 * Format a CID with dashes for display
 * Input: "1234567890"
 * Output: "123-456-7890"
 */
export function formatCid(cid: string): string {
  const clean = normalizeCid(cid);
  if (clean.length !== 10) return cid;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
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
    // Only auto-update status if not already handed-off
    let newStatus = account.status;
    if (account.handoffStatus !== 'handed-off') {
      if (spendCents > 0 && account.status === 'provisioned') {
        // Started spending → warming up
        newStatus = 'warming-up';
      } else if (
        account.status === 'warming-up' &&
        spendCents >= account.warmupTargetSpend
      ) {
        // Hit warmup target → ready for handoff
        newStatus = 'ready';
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
