// MagiManager AI Agent v2 - Full Agentic Architecture
// Features: Function calling, conversation memory, multi-step reasoning, surgical data fetching
// Optimized for Vercel Pro (60s timeout)

import { prisma } from "./db";
import {
  fetchSearchTerms,
  analyzeWastedSpend,
  fetchRecommendations,
  getRecommendationSummary,
  refreshAccessToken,
  normalizeCid,
  fetchAds,
  fetchCampaigns,
  fetchAdGroups,
} from "./google-ads-api";
import { scoreAdsInGroup, getWinners, sortByScore, type ScoredAd } from "./campaign-manager/utils/ad-scoring";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Gemini model fallback chain - try faster models first, fall back to more reliable ones
const GEMINI_MODELS = [
  "gemini-2.0-flash",      // Primary: fastest, newest
  "gemini-1.5-flash-8b",   // Fallback 1: smaller, very fast
  "gemini-1.5-flash",      // Fallback 2: reliable
];

function getGeminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// Optimized timeouts - fast response is better than perfect response
const API_TIMEOUT_MS = 10000;      // 10s per API call - if slow, try next model
const AGENT_TIMEOUT_MS = 25000;    // 25s total agent runtime

// Simple in-memory cache for frequent queries (stats, alerts)
const queryCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache

function getCachedResult(key: string): string | null {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[Cache] Hit for ${key}`);
    return cached.data;
  }
  return null;
}

function setCachedResult(key: string, data: string): void {
  queryCache.set(key, { data, timestamp: Date.now() });
  // Clean old entries
  if (queryCache.size > 20) {
    const oldest = [...queryCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) queryCache.delete(oldest[0]);
  }
}

// Maximum messages to keep in conversation memory
const MAX_CONVERSATION_HISTORY = 10;
// Conversation expiry time (30 minutes)
const CONVERSATION_EXPIRY_MS = 30 * 60 * 1000;

// ============================================================================
// TOOL DEFINITIONS - These are the "functions" the agent can call
// ============================================================================

const TOOLS = {
  // Account queries
  get_account_stats: {
    name: "get_account_stats",
    description: "Get overall statistics about all ad accounts (totals, counts by status, total spend, today's spend)",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  get_todays_spend: {
    name: "get_todays_spend",
    description: "Get today's spend breakdown - total spent today and per account. Use this when user asks 'what's today's spend', 'how much spent today', etc.",
    parameters: {
      type: "object",
      properties: {
        include_breakdown: {
          type: "boolean",
          description: "Whether to include per-account breakdown (default true)",
        },
      },
      required: [],
    },
  },
  get_spend_by_period: {
    name: "get_spend_by_period",
    description: "Get spend totals for specific time periods (7 days, 14 days, 30 days). Use this for questions like 'how much spent last week', 'spend this month', '30 day spend', etc.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          enum: [7, 14, 30],
          description: "Number of days to look back (7, 14, or 30)",
        },
        include_breakdown: {
          type: "boolean",
          description: "Whether to include per-account breakdown (default false)",
        },
      },
      required: ["days"],
    },
  },
  get_all_time_spend: {
    name: "get_all_time_spend",
    description: "Get all-time/lifetime total spend across all accounts. Use this only when user specifically asks for 'all time spend', 'total lifetime spend', 'ytd spend', etc.",
    parameters: {
      type: "object",
      properties: {
        include_breakdown: {
          type: "boolean",
          description: "Whether to include per-account breakdown (default false)",
        },
      },
      required: [],
    },
  },
  get_accounts_by_status: {
    name: "get_accounts_by_status",
    description: "Get accounts filtered by health status (active, suspended, banned, limited)",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "suspended", "banned", "limited", "all"],
          description: "The account health status to filter by",
        },
        limit: {
          type: "number",
          description: "Maximum number of accounts to return (default 10)",
        },
      },
      required: ["status"],
    },
  },
  get_account_details: {
    name: "get_account_details",
    description: "Get detailed information about a specific account by name, ID, or CID",
    parameters: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "Account name, internal ID (e.g., MM001), or Google CID",
        },
      },
      required: ["identifier"],
    },
  },
  get_top_performers: {
    name: "get_top_performers",
    description: "Get top performing accounts by spend",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of top accounts to return (default 5)",
        },
      },
      required: [],
    },
  },
  get_accounts_needing_attention: {
    name: "get_accounts_needing_attention",
    description: "Get accounts that need attention (suspended, billing issues, cert problems)",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  get_accounts_ready_for_handoff: {
    name: "get_accounts_ready_for_handoff",
    description: "Get accounts that have completed warmup and are ready to be handed off to media buyers. These are accounts where current spend has reached or exceeded the warmup target spend, are healthy (active), have verified billing, and are not yet handed off.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  get_accounts_by_handoff_status: {
    name: "get_accounts_by_handoff_status",
    description: "Get accounts filtered by handoff status (available, handed-off, archived)",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["available", "handed-off", "archived"],
          description: "The handoff status to filter by",
        },
      },
      required: ["status"],
    },
  },

  // Team/Assignment queries
  get_media_buyer_accounts: {
    name: "get_media_buyer_accounts",
    description: "Get accounts assigned to a specific media buyer",
    parameters: {
      type: "object",
      properties: {
        buyer_name: {
          type: "string",
          description: "Media buyer's name (partial match supported)",
        },
      },
      required: ["buyer_name"],
    },
  },
  get_unassigned_accounts: {
    name: "get_unassigned_accounts",
    description: "Get accounts that are not assigned to any media buyer",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  get_team_overview: {
    name: "get_team_overview",
    description: "Get overview of all media buyers and their account counts/spend",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // Identity queries
  get_identity_count: {
    name: "get_identity_count",
    description: "Get total count of identity profiles",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  get_identity_details: {
    name: "get_identity_details",
    description: "Get details about a specific identity by name",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Identity name (partial match supported)",
        },
      },
      required: ["name"],
    },
  },

  // Activity/History queries
  get_recent_activity: {
    name: "get_recent_activity",
    description: "Get recent account activity and status changes",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default 7)",
        },
        action_type: {
          type: "string",
          description: "Filter by action type (e.g., SUSPENDED, BILLING_FAILED)",
        },
      },
      required: [],
    },
  },
  get_weekly_comparison: {
    name: "get_weekly_comparison",
    description: "Get week-over-week comparison of key metrics",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // Google Ads Intelligence (Kadabra)
  get_search_terms: {
    name: "get_search_terms",
    description: "Get search terms report showing actual queries that triggered ads. Use this to find wasted spend, negative keyword opportunities, and new keyword ideas. Requires an OAuth-connected Google Ads account.",
    parameters: {
      type: "object",
      properties: {
        account_identifier: {
          type: "string",
          description: "Account name, MM ID, or Google CID to analyze",
        },
        sort_by: {
          type: "string",
          enum: ["cost", "impressions", "clicks", "conversions"],
          description: "How to sort results (default: cost)",
        },
        min_cost: {
          type: "number",
          description: "Minimum cost in dollars to include (filters low-spend terms)",
        },
        limit: {
          type: "number",
          description: "Maximum number of terms to return (default 20)",
        },
      },
      required: ["account_identifier"],
    },
  },
  get_wasted_spend: {
    name: "get_wasted_spend",
    description: "Analyze wasted ad spend - search terms with spend but zero conversions. Shows potential negative keywords and money-saving opportunities. Requires an OAuth-connected Google Ads account.",
    parameters: {
      type: "object",
      properties: {
        account_identifier: {
          type: "string",
          description: "Account name, MM ID, or Google CID to analyze",
        },
        min_cost: {
          type: "number",
          description: "Minimum wasted spend in dollars to include (default: 1)",
        },
      },
      required: ["account_identifier"],
    },
  },
  get_google_recommendations: {
    name: "get_google_recommendations",
    description: "Get Google's native AI-generated recommendations to improve account performance. Shows budget suggestions, keyword ideas, ad improvements. Requires an OAuth-connected Google Ads account.",
    parameters: {
      type: "object",
      properties: {
        account_identifier: {
          type: "string",
          description: "Account name, MM ID, or Google CID to analyze",
        },
        include_dismissed: {
          type: "boolean",
          description: "Include previously dismissed recommendations (default: false)",
        },
      },
      required: ["account_identifier"],
    },
  },
  get_recommendation_summary: {
    name: "get_recommendation_summary",
    description: "Get a summary of Google's recommendations with potential impact metrics (additional conversions, clicks, cost changes). Requires an OAuth-connected Google Ads account.",
    parameters: {
      type: "object",
      properties: {
        account_identifier: {
          type: "string",
          description: "Account name, MM ID, or Google CID to analyze",
        },
      },
      required: ["account_identifier"],
    },
  },

  // Ad Performance Analysis Tools
  analyze_ad_performance: {
    name: "analyze_ad_performance",
    description: "Analyze ad performance in an ad group, score ads based on CTR, conversions, cost efficiency, and impressions. Identifies winners and losers. Requires an OAuth-connected Google Ads account.",
    parameters: {
      type: "object",
      properties: {
        account_identifier: {
          type: "string",
          description: "Account name, MM ID, or Google CID to analyze",
        },
        campaign_id: {
          type: "string",
          description: "Optional campaign ID to filter by (e.g., '23283242573')",
        },
        ad_group_id: {
          type: "string",
          description: "Optional ad group ID to filter by",
        },
        limit: {
          type: "number",
          description: "Maximum number of ads to return (default 20)",
        },
      },
      required: ["account_identifier"],
    },
  },
  compare_ads: {
    name: "compare_ads",
    description: "Compare and rank ads within an ad group to find the best performers. Shows head-to-head comparison and identifies which ad variations are winning. Requires an OAuth-connected Google Ads account.",
    parameters: {
      type: "object",
      properties: {
        account_identifier: {
          type: "string",
          description: "Account name, MM ID, or Google CID to analyze",
        },
        ad_group_id: {
          type: "string",
          description: "Ad group ID to compare ads within",
        },
      },
      required: ["account_identifier", "ad_group_id"],
    },
  },
  suggest_ad_improvements: {
    name: "suggest_ad_improvements",
    description: "Get AI-powered suggestions to improve underperforming ads. Analyzes ad copy, headlines, and performance metrics to provide actionable recommendations. Requires an OAuth-connected Google Ads account.",
    parameters: {
      type: "object",
      properties: {
        account_identifier: {
          type: "string",
          description: "Account name, MM ID, or Google CID to analyze",
        },
        campaign_id: {
          type: "string",
          description: "Optional campaign ID to focus on",
        },
        focus_on_underperformers: {
          type: "boolean",
          description: "Whether to focus only on underperforming ads (default: true)",
        },
      },
      required: ["account_identifier"],
    },
  },

};

// Convert to Gemini function declaration format
const GEMINI_TOOLS = [
  {
    function_declarations: Object.values(TOOLS).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  },
];

// ============================================================================
// TOOL IMPLEMENTATIONS - Execute the actual database queries
// ============================================================================

// Helper to add timeout to any promise
async function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

async function executeToolCall(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  const startTime = Date.now();
  try {
    // 5s timeout per tool - if DB is slow, fail fast
    const result = await withDbTimeout(
      executeToolCallInner(toolName, args),
      5000,
      JSON.stringify({ error: true, tool: toolName, issue: "Tool timed out - database may be slow" })
    );
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.log(`[Tool] ${toolName} completed in ${duration}ms`);
    }
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Tool] ${toolName} failed (${duration}ms):`, error);
    // Return error in a format the AI can understand and relay naturally
    return JSON.stringify({
      error: true,
      tool: toolName,
      issue: error instanceof Error ? error.message : "database hiccup",
    });
  }
}

async function executeToolCallInner(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  switch (toolName) {
    case "get_account_stats": {
      // Check cache first
      const cached = getCachedResult("account_stats");
      if (cached) return cached;

      const accounts = await prisma.adAccount.findMany({
        where: { handoffStatus: { not: "archived" } },
      });
      const stats = {
        total: accounts.length,
        active: accounts.filter((a) => a.accountHealth === "active").length,
        suspended: accounts.filter((a) => a.accountHealth === "suspended").length,
        banned: accounts.filter((a) => a.accountHealth === "banned").length,
        limited: accounts.filter((a) => a.accountHealth === "limited").length,
        totalSpend: `$${(accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0) / 100).toFixed(2)}`,
        todaysSpend: `$${(accounts.reduce((sum, a) => sum + a.todaySpend, 0) / 100).toFixed(2)}`,
        totalAds: accounts.reduce((sum, a) => sum + a.adsCount, 0),
        pendingBilling: accounts.filter((a) => a.billingStatus === "pending").length,
        handedOff: accounts.filter((a) => a.handoffStatus === "handed-off").length,
      };
      const result = JSON.stringify(stats);
      setCachedResult("account_stats", result);
      return result;
    }

    case "get_todays_spend": {
      const includeBreakdown = args.include_breakdown !== false;
      const accounts = await prisma.adAccount.findMany({
        where: {
          handoffStatus: { not: "archived" },
          todaySpend: { gt: 0 },
        },
        include: {
          identityProfile: { select: { fullName: true } },
        },
        orderBy: { todaySpend: "desc" },
      });

      const totalTodaySpend = accounts.reduce((sum, a) => sum + a.todaySpend, 0);

      const result: any = {
        totalTodaysSpend: `$${(totalTodaySpend / 100).toFixed(2)}`,
        accountsSpendingToday: accounts.length,
      };

      if (includeBreakdown && accounts.length > 0) {
        result.breakdown = accounts.map((a) => ({
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          name: a.identityProfile?.fullName || a.googleCid || "Unknown",
          todaySpend: `$${(a.todaySpend / 100).toFixed(2)}`,
          totalSpend: `$${(a.currentSpendTotal / 100).toFixed(2)}`,
          health: a.accountHealth,
        }));
      }

      return JSON.stringify(result);
    }

    case "get_spend_by_period": {
      const days = args.days || 7;
      const includeBreakdown = args.include_breakdown === true;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Get daily snapshots for the period
      const snapshots = await prisma.dailySpendSnapshot.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
          adAccount: {
            handoffStatus: { not: "archived" },
          },
        },
        include: {
          adAccount: {
            include: {
              identityProfile: { select: { fullName: true } },
            },
          },
        },
      });

      // Aggregate by account
      const accountSpends = new Map<string, { name: string; id: string; total: number }>();
      let totalPeriodSpend = 0;

      for (const snap of snapshots) {
        const dailySpend = Number(snap.dailySpend) * 100; // Convert to cents
        totalPeriodSpend += dailySpend;

        const accountId = snap.adAccountId;
        const existing = accountSpends.get(accountId);
        if (existing) {
          existing.total += dailySpend;
        } else {
          accountSpends.set(accountId, {
            id: `MM${String(snap.adAccount.internalId).padStart(3, "0")}`,
            name: snap.adAccount.identityProfile?.fullName || snap.adAccount.googleCid || "Unknown",
            total: dailySpend,
          });
        }
      }

      const result: any = {
        period: `Last ${days} days`,
        totalSpend: `$${(totalPeriodSpend / 100).toFixed(2)}`,
        accountCount: accountSpends.size,
      };

      if (includeBreakdown && accountSpends.size > 0) {
        result.breakdown = Array.from(accountSpends.values())
          .sort((a, b) => b.total - a.total)
          .map((a) => ({
            id: a.id,
            name: a.name,
            spend: `$${(a.total / 100).toFixed(2)}`,
          }));
      }

      return JSON.stringify(result);
    }

    case "get_all_time_spend": {
      const includeBreakdown = args.include_breakdown === true;

      const accounts = await prisma.adAccount.findMany({
        where: { handoffStatus: { not: "archived" } },
        include: {
          identityProfile: { select: { fullName: true } },
        },
        orderBy: { currentSpendTotal: "desc" },
      });

      const totalAllTimeSpend = accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0);

      const result: any = {
        totalAllTimeSpend: `$${(totalAllTimeSpend / 100).toFixed(2)}`,
        accountCount: accounts.length,
      };

      if (includeBreakdown) {
        result.breakdown = accounts
          .filter((a) => a.currentSpendTotal > 0)
          .map((a) => ({
            id: `MM${String(a.internalId).padStart(3, "0")}`,
            name: a.identityProfile?.fullName || a.googleCid || "Unknown",
            spend: `$${(a.currentSpendTotal / 100).toFixed(2)}`,
          }));
      }

      return JSON.stringify(result);
    }

    case "get_accounts_by_status": {
      const status = args.status;
      const limit = args.limit || 10;
      const where = status === "all" ? {} : { accountHealth: status };
      const accounts = await prisma.adAccount.findMany({
        where: { ...where, handoffStatus: { not: "archived" } },
        include: {
          identityProfile: { select: { fullName: true, geo: true } },
          mediaBuyer: { select: { name: true } },
        },
        orderBy: { currentSpendTotal: "desc" },
        take: limit,
      });
      return JSON.stringify(
        accounts.map((a) => ({
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          name: a.identityProfile?.fullName || a.googleCid || "Unknown",
          health: a.accountHealth,
          billing: a.billingStatus,
          spend: `$${(a.currentSpendTotal / 100).toFixed(2)}`,
          ads: a.adsCount,
          assignedTo: a.mediaBuyer?.name || "Unassigned",
        }))
      );
    }

    case "get_account_details": {
      const identifier = args.identifier.toLowerCase();
      const account = await prisma.adAccount.findFirst({
        where: {
          OR: [
            { googleCid: { contains: identifier, mode: "insensitive" } },
            { identityProfile: { fullName: { contains: identifier, mode: "insensitive" } } },
          ],
        },
        include: {
          identityProfile: { select: { fullName: true, geo: true, email: true } },
          mediaBuyer: { select: { name: true, email: true } },
          checkIns: { orderBy: { checkedAt: "desc" }, take: 3 },
        },
      });

      // Also try matching by internal ID
      if (!account) {
        const idMatch = identifier.match(/mm?(\d+)/i);
        if (idMatch) {
          const internalId = parseInt(idMatch[1]);
          const byId = await prisma.adAccount.findFirst({
            where: { internalId },
            include: {
              identityProfile: { select: { fullName: true, geo: true, email: true } },
              mediaBuyer: { select: { name: true, email: true } },
              checkIns: { orderBy: { checkedAt: "desc" }, take: 3 },
            },
          });
          if (byId) {
            return JSON.stringify({
              found: true,
              id: `MM${String(byId.internalId).padStart(3, "0")}`,
              name: byId.identityProfile?.fullName || "Unknown",
              geo: byId.identityProfile?.geo,
              googleCid: byId.googleCid,
              health: byId.accountHealth,
              billing: byId.billingStatus,
              cert: byId.certStatus,
              spend: `$${(byId.currentSpendTotal / 100).toFixed(2)}`,
              todaySpend: `$${(byId.todaySpend / 100).toFixed(2)}`,
              warmupTarget: `$${(byId.warmupTargetSpend / 100).toFixed(2)}`,
              warmupProgress: `${Math.min(100, Math.round((byId.currentSpendTotal / byId.warmupTargetSpend) * 100))}%`,
              ads: byId.adsCount,
              campaigns: byId.campaignsCount,
              handoffStatus: byId.handoffStatus,
              assignedTo: byId.mediaBuyer?.name || "Unassigned",
              recentCheckIns: byId.checkIns.map((c) => ({
                date: c.checkedAt.toISOString().split("T")[0],
                dailySpend: `$${c.dailySpend}`,
                health: c.accountHealth,
              })),
            });
          }
        }
      }

      if (!account) {
        return JSON.stringify({ found: false, message: `No account found matching "${args.identifier}"` });
      }
      return JSON.stringify({
        found: true,
        id: `MM${String(account.internalId).padStart(3, "0")}`,
        name: account.identityProfile?.fullName || "Unknown",
        geo: account.identityProfile?.geo,
        googleCid: account.googleCid,
        health: account.accountHealth,
        billing: account.billingStatus,
        cert: account.certStatus,
        spend: `$${(account.currentSpendTotal / 100).toFixed(2)}`,
        todaySpend: `$${(account.todaySpend / 100).toFixed(2)}`,
        warmupTarget: `$${(account.warmupTargetSpend / 100).toFixed(2)}`,
        warmupProgress: `${Math.min(100, Math.round((account.currentSpendTotal / account.warmupTargetSpend) * 100))}%`,
        ads: account.adsCount,
        campaigns: account.campaignsCount,
        handoffStatus: account.handoffStatus,
        assignedTo: account.mediaBuyer?.name || "Unassigned",
        recentCheckIns: account.checkIns.map((c) => ({
          date: c.checkedAt.toISOString().split("T")[0],
          dailySpend: `$${c.dailySpend}`,
          health: c.accountHealth,
        })),
      });
    }

    case "get_top_performers": {
      const limit = args.limit || 5;
      const accounts = await prisma.adAccount.findMany({
        where: {
          handoffStatus: { not: "archived" },
          currentSpendTotal: { gt: 0 },
        },
        include: {
          identityProfile: { select: { fullName: true } },
          mediaBuyer: { select: { name: true } },
        },
        orderBy: { currentSpendTotal: "desc" },
        take: limit,
      });
      return JSON.stringify(
        accounts.map((a, i) => ({
          rank: i + 1,
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          name: a.identityProfile?.fullName || a.googleCid || "Unknown",
          spend: `$${(a.currentSpendTotal / 100).toFixed(2)}`,
          ads: a.adsCount,
          health: a.accountHealth,
          assignedTo: a.mediaBuyer?.name || "Unassigned",
        }))
      );
    }

    case "get_accounts_needing_attention": {
      // Check cache first
      const cached = getCachedResult("alerts");
      if (cached) return cached;

      const accounts = await prisma.adAccount.findMany({
        where: {
          handoffStatus: { not: "archived" },
          OR: [
            { accountHealth: { in: ["suspended", "banned", "limited"] } },
            { billingStatus: { in: ["pending", "failed"] } },
            { certStatus: "pending" },
          ],
        },
        include: {
          identityProfile: { select: { fullName: true } },
          checkIns: { orderBy: { checkedAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
      });

      const alerts = accounts.map((a) => {
        let priority = "info";
        let reason = "";
        if (a.accountHealth === "suspended" || a.accountHealth === "banned") {
          priority = "critical";
          reason = `Account ${a.accountHealth}`;
        } else if (a.billingStatus === "failed") {
          priority = "critical";
          reason = "Billing failed";
        } else if (a.accountHealth === "limited") {
          priority = "warning";
          reason = "Account limited";
        } else if (a.billingStatus === "pending") {
          priority = "warning";
          reason = "Billing pending";
        } else if (a.certStatus === "pending") {
          priority = "info";
          reason = "Cert pending";
        }

        const lastCheckIn = a.checkIns[0];
        const daysSinceCheckIn = lastCheckIn
          ? Math.floor((Date.now() - lastCheckIn.checkedAt.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          name: a.identityProfile?.fullName || a.googleCid || "Unknown",
          priority,
          reason,
          daysSinceCheckIn,
        };
      });

      const critical = alerts.filter((a) => a.priority === "critical");
      const warning = alerts.filter((a) => a.priority === "warning");
      const info = alerts.filter((a) => a.priority === "info");

      const result = JSON.stringify({ critical, warning, info, total: alerts.length });
      setCachedResult("alerts", result);
      return result;
    }

    case "get_accounts_ready_for_handoff": {
      // Accounts that have completed warmup: spend >= target, active, billing verified, not yet handed off
      const accounts = await prisma.adAccount.findMany({
        where: {
          handoffStatus: "available",
          accountHealth: "active",
          billingStatus: "verified",
        },
        include: {
          identityProfile: { select: { fullName: true, geo: true } },
        },
        orderBy: { currentSpendTotal: "desc" },
      });

      // Filter to accounts where spend >= warmup target
      const readyAccounts = accounts.filter(
        (a) => a.currentSpendTotal >= a.warmupTargetSpend && a.warmupTargetSpend > 0
      );

      return JSON.stringify({
        count: readyAccounts.length,
        accounts: readyAccounts.map((a) => ({
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          name: a.identityProfile?.fullName || a.googleCid || "Unknown",
          geo: a.identityProfile?.geo,
          spend: `$${(a.currentSpendTotal / 100).toFixed(2)}`,
          warmupTarget: `$${(a.warmupTargetSpend / 100).toFixed(2)}`,
          warmupProgress: `${Math.round((a.currentSpendTotal / a.warmupTargetSpend) * 100)}%`,
          ads: a.adsCount,
          health: a.accountHealth,
          billing: a.billingStatus,
        })),
      });
    }

    case "get_accounts_by_handoff_status": {
      const status = args.status;
      const accounts = await prisma.adAccount.findMany({
        where: { handoffStatus: status },
        include: {
          identityProfile: { select: { fullName: true, geo: true } },
          mediaBuyer: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      return JSON.stringify({
        status,
        count: accounts.length,
        accounts: accounts.map((a) => ({
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          name: a.identityProfile?.fullName || a.googleCid || "Unknown",
          geo: a.identityProfile?.geo,
          health: a.accountHealth,
          spend: `$${(a.currentSpendTotal / 100).toFixed(2)}`,
          assignedTo: a.mediaBuyer?.name || "Unassigned",
          handoffDate: a.handoffDate?.toISOString().split("T")[0] || null,
        })),
      });
    }

    case "get_media_buyer_accounts": {
      const buyerName = args.buyer_name;
      const buyer = await prisma.mediaBuyer.findFirst({
        where: { name: { contains: buyerName, mode: "insensitive" } },
        include: {
          adAccounts: {
            where: { handoffStatus: { not: "archived" } },
            include: { identityProfile: { select: { fullName: true } } },
            orderBy: { currentSpendTotal: "desc" },
          },
        },
      });

      if (!buyer) {
        return JSON.stringify({ found: false, message: `No media buyer found matching "${buyerName}"` });
      }

      return JSON.stringify({
        found: true,
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        accountCount: buyer.adAccounts.length,
        totalSpend: `$${(buyer.adAccounts.reduce((sum, a) => sum + a.currentSpendTotal, 0) / 100).toFixed(2)}`,
        accounts: buyer.adAccounts.map((a) => ({
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          name: a.identityProfile?.fullName || a.googleCid || "Unknown",
          health: a.accountHealth,
          spend: `$${(a.currentSpendTotal / 100).toFixed(2)}`,
        })),
      });
    }

    case "get_unassigned_accounts": {
      const accounts = await prisma.adAccount.findMany({
        where: {
          mediaBuyerId: null,
          handoffStatus: "available",
        },
        include: {
          identityProfile: { select: { fullName: true, geo: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return JSON.stringify({
        count: accounts.length,
        accounts: accounts.map((a) => ({
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          name: a.identityProfile?.fullName || a.googleCid || "Unknown",
          geo: a.identityProfile?.geo,
          health: a.accountHealth,
          billing: a.billingStatus,
          createdAt: a.createdAt.toISOString().split("T")[0],
        })),
      });
    }

    case "get_team_overview": {
      const buyers = await prisma.mediaBuyer.findMany({
        where: { isActive: true },
        include: {
          adAccounts: {
            where: { handoffStatus: { not: "archived" } },
          },
        },
        orderBy: { name: "asc" },
      });

      return JSON.stringify(
        buyers.map((b) => ({
          name: b.name,
          accountCount: b.adAccounts.length,
          activeAccounts: b.adAccounts.filter((a) => a.accountHealth === "active").length,
          totalSpend: `$${(b.adAccounts.reduce((sum, a) => sum + a.currentSpendTotal, 0) / 100).toFixed(2)}`,
          totalAds: b.adAccounts.reduce((sum, a) => sum + a.adsCount, 0),
        }))
      );
    }

    case "get_identity_count": {
      const count = await prisma.identityProfile.count();
      const withGoLogin = await prisma.goLoginProfile.count();
      return JSON.stringify({ totalIdentities: count, withGoLoginProfiles: withGoLogin });
    }

    case "get_identity_details": {
      const name = args.name;
      const identity = await prisma.identityProfile.findFirst({
        where: { fullName: { contains: name, mode: "insensitive" } },
        include: {
          gologinProfile: true,
          adAccounts: {
            include: { mediaBuyer: { select: { name: true } } },
          },
          _count: { select: { documents: true } },
        },
      });

      if (!identity) {
        return JSON.stringify({ found: false, message: `No identity found matching "${name}"` });
      }

      return JSON.stringify({
        found: true,
        name: identity.fullName,
        geo: identity.geo,
        email: identity.email ? "Set" : "Not set",
        hasGoLogin: !!identity.gologinProfile,
        goLoginStatus: identity.gologinProfile?.status,
        documentCount: identity._count.documents,
        accounts: identity.adAccounts.map((a) => ({
          id: `MM${String(a.internalId).padStart(3, "0")}`,
          health: a.accountHealth,
          spend: `$${(a.currentSpendTotal / 100).toFixed(2)}`,
          assignedTo: a.mediaBuyer?.name || "Unassigned",
        })),
      });
    }

    case "get_recent_activity": {
      const days = args.days || 7;
      const actionType = args.action_type;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const where: any = { createdAt: { gte: since } };
      if (actionType) {
        where.action = { contains: actionType, mode: "insensitive" };
      }

      const activities = await prisma.accountActivity.findMany({
        where,
        include: {
          adAccount: {
            include: { identityProfile: { select: { fullName: true } } },
          },
          createdByUser: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      // Summarize by action type
      const summary: Record<string, number> = {};
      activities.forEach((a) => {
        summary[a.action] = (summary[a.action] || 0) + 1;
      });

      return JSON.stringify({
        period: `Last ${days} days`,
        totalActivities: activities.length,
        summary,
        recent: activities.slice(0, 10).map((a) => ({
          date: a.createdAt.toISOString().split("T")[0],
          account: a.adAccount?.identityProfile?.fullName || "Unknown",
          action: a.action,
          details: a.details,
          by: a.createdByUser?.name,
        })),
      });
    }

    case "get_weekly_comparison": {
      const thisWeekStart = new Date();
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const [thisWeek, lastWeek] = await Promise.all([
        prisma.weeklyStatsSnapshot.findFirst({ where: { weekStart: thisWeekStart } }),
        prisma.weeklyStatsSnapshot.findFirst({ where: { weekStart: lastWeekStart } }),
      ]);

      if (!thisWeek && !lastWeek) {
        // Fall back to current stats
        const accounts = await prisma.adAccount.findMany();
        return JSON.stringify({
          message: "No weekly snapshots yet - showing current stats",
          current: {
            totalAccounts: accounts.length,
            active: accounts.filter((a) => a.accountHealth === "active").length,
            suspended: accounts.filter((a) => a.accountHealth === "suspended").length,
            totalSpend: `$${(accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0) / 100).toFixed(2)}`,
          },
        });
      }

      return JSON.stringify({
        thisWeek: thisWeek
          ? {
              accounts: thisWeek.totalAccounts,
              active: thisWeek.activeAccounts,
              suspended: thisWeek.suspendedAccounts,
              spend: `$${(thisWeek.totalSpend / 100).toFixed(2)}`,
              created: thisWeek.accountsCreated,
            }
          : null,
        lastWeek: lastWeek
          ? {
              accounts: lastWeek.totalAccounts,
              active: lastWeek.activeAccounts,
              suspended: lastWeek.suspendedAccounts,
              spend: `$${(lastWeek.totalSpend / 100).toFixed(2)}`,
              created: lastWeek.accountsCreated,
            }
          : null,
      });
    }

    // ========================================================================
    // GOOGLE ADS INTELLIGENCE TOOLS (Kadabra)
    // ========================================================================

    case "get_search_terms": {
      const identifier = args.account_identifier;
      const sortBy = args.sort_by || "cost";
      const minCost = args.min_cost || 0;
      const limit = args.limit || 20;

      // Find the account and get OAuth credentials
      const accountResult = await findAccountWithOAuth(identifier);
      if (!accountResult.found) {
        return JSON.stringify(accountResult);
      }

      const { account, accessToken } = accountResult;

      try {
        const searchTerms = await fetchSearchTerms(accessToken!, account.googleCid!, {
          sortBy: sortBy as 'cost' | 'impressions' | 'clicks' | 'conversions',
          minCost,
          limit,
        });

        return JSON.stringify({
          account: account.identityProfile?.fullName || account.googleCid,
          accountId: `MM${String(account.internalId).padStart(3, "0")}`,
          termsCount: searchTerms.length,
          sortedBy: sortBy,
          terms: searchTerms.map((t) => ({
            searchTerm: t.searchTerm,
            campaign: t.campaignName,
            adGroup: t.adGroupName,
            clicks: t.clicks,
            impressions: t.impressions,
            cost: `$${(t.cost / 1000000).toFixed(2)}`,
            conversions: t.conversions,
            ctr: `${(t.ctr * 100).toFixed(2)}%`,
            conversionRate: `${(t.conversionRate * 100).toFixed(2)}%`,
          })),
        });
      } catch (error) {
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : "Failed to fetch search terms",
          account: account.identityProfile?.fullName || account.googleCid,
        });
      }
    }

    case "get_wasted_spend": {
      const identifier = args.account_identifier;
      const minCost = args.min_cost || 1;

      // Find the account and get OAuth credentials
      const accountResult = await findAccountWithOAuth(identifier);
      if (!accountResult.found) {
        return JSON.stringify(accountResult);
      }

      const { account, accessToken } = accountResult;

      try {
        const wastedAnalysis = await analyzeWastedSpend(accessToken!, account.googleCid!, {
          minCost,
        });

        return JSON.stringify({
          account: account.identityProfile?.fullName || account.googleCid,
          accountId: `MM${String(account.internalId).padStart(3, "0")}`,
          totalWastedSpend: `$${(wastedAnalysis.totalWastedSpend / 1000000).toFixed(2)}`,
          wastedTermsCount: wastedAnalysis.wastedTerms.length,
          topWasters: wastedAnalysis.topWasters.map((t) => ({
            searchTerm: t.searchTerm,
            campaign: t.campaignName,
            cost: `$${(t.cost / 1000000).toFixed(2)}`,
            clicks: t.clicks,
            impressions: t.impressions,
            recommendation: "Consider adding as negative keyword",
          })),
          insight: wastedAnalysis.totalWastedSpend > 0
            ? `Found $${(wastedAnalysis.totalWastedSpend / 1000000).toFixed(2)} in potential wasted spend from ${wastedAnalysis.wastedTerms.length} search terms with zero conversions.`
            : "No significant wasted spend detected - great job!",
        });
      } catch (error) {
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : "Failed to analyze wasted spend",
          account: account.identityProfile?.fullName || account.googleCid,
        });
      }
    }

    case "get_google_recommendations": {
      const identifier = args.account_identifier;
      const includeDismissed = args.include_dismissed || false;

      // Find the account and get OAuth credentials
      const accountResult = await findAccountWithOAuth(identifier);
      if (!accountResult.found) {
        return JSON.stringify(accountResult);
      }

      const { account, accessToken } = accountResult;

      try {
        const recommendations = await fetchRecommendations(accessToken!, account.googleCid!, {
          includeDismissed,
        });

        return JSON.stringify({
          account: account.identityProfile?.fullName || account.googleCid,
          accountId: `MM${String(account.internalId).padStart(3, "0")}`,
          recommendationsCount: recommendations.length,
          recommendations: recommendations.slice(0, 15).map((r) => ({
            type: r.typeDisplay,
            campaignId: r.campaignId,
            dismissed: r.dismissed,
            ...(r.budgetRecommendation && {
              currentBudget: `$${(r.budgetRecommendation.currentBudgetMicros / 1000000).toFixed(2)}/day`,
              recommendedBudget: `$${(r.budgetRecommendation.recommendedBudgetMicros / 1000000).toFixed(2)}/day`,
            }),
            ...(r.keywordRecommendation && {
              keyword: r.keywordRecommendation.keyword,
              matchType: r.keywordRecommendation.matchType,
            }),
            ...(r.impact?.potentialMetrics && {
              potentialConversions: r.impact.potentialMetrics.conversions,
              potentialClicks: r.impact.potentialMetrics.clicks,
            }),
          })),
        });
      } catch (error) {
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : "Failed to fetch recommendations",
          account: account.identityProfile?.fullName || account.googleCid,
        });
      }
    }

    case "get_recommendation_summary": {
      const identifier = args.account_identifier;

      // Find the account and get OAuth credentials
      const accountResult = await findAccountWithOAuth(identifier);
      if (!accountResult.found) {
        return JSON.stringify(accountResult);
      }

      const { account, accessToken } = accountResult;

      try {
        const summary = await getRecommendationSummary(accessToken!, account.googleCid!);

        return JSON.stringify({
          account: account.identityProfile?.fullName || account.googleCid,
          accountId: `MM${String(account.internalId).padStart(3, "0")}`,
          totalRecommendations: summary.totalRecommendations,
          byType: summary.byType,
          potentialImpact: {
            additionalConversions: summary.potentialImpact.additionalConversions.toFixed(1),
            additionalClicks: summary.potentialImpact.additionalClicks,
            costChange: summary.potentialImpact.costChange > 0
              ? `+$${(summary.potentialImpact.costChange / 1000000).toFixed(2)}`
              : `-$${(Math.abs(summary.potentialImpact.costChange) / 1000000).toFixed(2)}`,
          },
          highPriority: summary.highPriority.map((r) => ({
            type: r.typeDisplay,
            campaignId: r.campaignId,
          })),
          insight: summary.totalRecommendations > 0
            ? `Google suggests ${summary.totalRecommendations} optimizations that could add ~${summary.potentialImpact.additionalConversions.toFixed(1)} conversions.`
            : "Account is well-optimized - no pending recommendations.",
        });
      } catch (error) {
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : "Failed to get recommendation summary",
          account: account.identityProfile?.fullName || account.googleCid,
        });
      }
    }

    // ========================================================================
    // AD PERFORMANCE ANALYSIS TOOLS
    // ========================================================================

    case "analyze_ad_performance": {
      const identifier = args.account_identifier;
      const campaignId = args.campaign_id;
      const adGroupId = args.ad_group_id;
      const limit = args.limit || 20;

      // Find the account and get OAuth credentials
      const accountResult = await findAccountWithOAuth(identifier);
      if (!accountResult.found) {
        return JSON.stringify(accountResult);
      }

      const { account, accessToken } = accountResult;

      try {
        const ads = await fetchAds(accessToken!, account.googleCid!, {
          campaignId,
          adGroupId,
          includeMetrics: true,
        });

        if (ads.length === 0) {
          return JSON.stringify({
            account: account.identityProfile?.fullName || account.googleCid,
            accountId: `MM${String(account.internalId).padStart(3, "0")}`,
            message: "No ads found for the specified filters",
          });
        }

        // Group ads by ad group for proper scoring
        const adsByGroup = new Map<string, typeof ads>();
        ads.forEach((ad) => {
          const existing = adsByGroup.get(ad.adGroupId) || [];
          existing.push(ad);
          adsByGroup.set(ad.adGroupId, existing);
        });

        // Score all ads
        const allScoredAds: ScoredAd[] = [];
        adsByGroup.forEach((groupAds) => {
          const scored = scoreAdsInGroup(groupAds);
          allScoredAds.push(...scored);
        });

        // Sort by score and limit
        const topAds = sortByScore(allScoredAds).slice(0, limit);
        const winners = getWinners(allScoredAds);

        return JSON.stringify({
          account: account.identityProfile?.fullName || account.googleCid,
          accountId: `MM${String(account.internalId).padStart(3, "0")}`,
          totalAds: ads.length,
          adGroupsAnalyzed: adsByGroup.size,
          winnersCount: winners.length,
          summary: {
            avgScore: Math.round(allScoredAds.reduce((sum, a) => sum + a.score.overall, 0) / allScoredAds.length),
            topTier: allScoredAds.filter((a) => a.score.tier === "gold").length,
            underperformers: allScoredAds.filter((a) => a.score.tier === "neutral").length,
          },
          topAds: topAds.map((ad) => ({
            adId: ad.id,
            type: ad.type,
            headline: ad.headlines?.[0] || "N/A",
            score: ad.score.overall,
            tier: ad.score.tier,
            isWinner: ad.score.isWinner,
            metrics: {
              clicks: ad.clicks,
              impressions: ad.impressions,
              cost: `$${(ad.cost / 1000000).toFixed(2)}`,
              conversions: ad.conversions,
              ctr: `${(ad.ctr * 100).toFixed(2)}%`,
            },
            scoreBreakdown: {
              ctr: ad.score.ctrScore,
              conversions: ad.score.conversionScore,
              costEfficiency: ad.score.costScore,
              reach: ad.score.impressionScore,
            },
          })),
          insight: winners.length > 0
            ? `Found ${winners.length} winning ad${winners.length > 1 ? "s" : ""} with strong performance. Consider pausing underperformers and creating variations of winners.`
            : "No clear winners yet. Consider running tests longer or trying new ad variations.",
        });
      } catch (error) {
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : "Failed to analyze ad performance",
          account: account.identityProfile?.fullName || account.googleCid,
        });
      }
    }

    case "compare_ads": {
      const identifier = args.account_identifier;
      const adGroupId = args.ad_group_id;

      if (!adGroupId) {
        return JSON.stringify({
          error: true,
          message: "ad_group_id is required to compare ads within a group",
        });
      }

      // Find the account and get OAuth credentials
      const accountResult = await findAccountWithOAuth(identifier);
      if (!accountResult.found) {
        return JSON.stringify(accountResult);
      }

      const { account, accessToken } = accountResult;

      try {
        const ads = await fetchAds(accessToken!, account.googleCid!, {
          adGroupId,
          includeMetrics: true,
        });

        if (ads.length === 0) {
          return JSON.stringify({
            account: account.identityProfile?.fullName || account.googleCid,
            message: "No ads found in this ad group",
          });
        }

        if (ads.length === 1) {
          return JSON.stringify({
            account: account.identityProfile?.fullName || account.googleCid,
            message: "Only 1 ad in this ad group - nothing to compare. Add more ad variations!",
          });
        }

        // Score and rank ads
        const scoredAds = sortByScore(scoreAdsInGroup(ads));
        const winner = scoredAds[0];
        const loser = scoredAds[scoredAds.length - 1];

        // Calculate performance deltas
        const winnerVsLoser = {
          ctrDiff: winner.ctr - loser.ctr,
          conversionsDiff: winner.conversions - loser.conversions,
          costDiff: winner.cost - loser.cost,
        };

        return JSON.stringify({
          account: account.identityProfile?.fullName || account.googleCid,
          accountId: `MM${String(account.internalId).padStart(3, "0")}`,
          adGroupId,
          totalAds: ads.length,
          rankings: scoredAds.map((ad, rank) => ({
            rank: rank + 1,
            adId: ad.id,
            headline: ad.headlines?.[0] || "N/A",
            score: ad.score.overall,
            tier: ad.score.tier,
            isWinner: ad.score.isWinner,
            metrics: {
              ctr: `${(ad.ctr * 100).toFixed(2)}%`,
              conversions: ad.conversions,
              cost: `$${(ad.cost / 1000000).toFixed(2)}`,
            },
          })),
          headToHead: {
            winner: {
              adId: winner.id,
              headline: winner.headlines?.[0] || "N/A",
              score: winner.score.overall,
            },
            loser: {
              adId: loser.id,
              headline: loser.headlines?.[0] || "N/A",
              score: loser.score.overall,
            },
            difference: {
              ctr: `${winnerVsLoser.ctrDiff > 0 ? "+" : ""}${(winnerVsLoser.ctrDiff * 100).toFixed(2)}%`,
              conversions: `${winnerVsLoser.conversionsDiff > 0 ? "+" : ""}${winnerVsLoser.conversionsDiff.toFixed(1)}`,
              cost: `${winnerVsLoser.costDiff > 0 ? "+" : ""}$${(winnerVsLoser.costDiff / 1000000).toFixed(2)}`,
            },
          },
          recommendation: winner.score.isWinner
            ? `"${winner.headlines?.[0] || "Top ad"}" is a clear winner. Consider pausing "${loser.headlines?.[0] || "bottom ad"}" and creating variations of the winner.`
            : "No clear winner yet. Continue testing or try new creative approaches.",
        });
      } catch (error) {
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : "Failed to compare ads",
          account: account.identityProfile?.fullName || account.googleCid,
        });
      }
    }

    case "suggest_ad_improvements": {
      const identifier = args.account_identifier;
      const campaignId = args.campaign_id;
      const focusOnUnderperformers = args.focus_on_underperformers !== false;

      // Find the account and get OAuth credentials
      const accountResult = await findAccountWithOAuth(identifier);
      if (!accountResult.found) {
        return JSON.stringify(accountResult);
      }

      const { account, accessToken } = accountResult;

      try {
        const ads = await fetchAds(accessToken!, account.googleCid!, {
          campaignId,
          includeMetrics: true,
        });

        if (ads.length === 0) {
          return JSON.stringify({
            account: account.identityProfile?.fullName || account.googleCid,
            message: "No ads found to analyze",
          });
        }

        // Group and score ads
        const adsByGroup = new Map<string, typeof ads>();
        ads.forEach((ad) => {
          const existing = adsByGroup.get(ad.adGroupId) || [];
          existing.push(ad);
          adsByGroup.set(ad.adGroupId, existing);
        });

        const allScoredAds: ScoredAd[] = [];
        adsByGroup.forEach((groupAds) => {
          const scored = scoreAdsInGroup(groupAds);
          allScoredAds.push(...scored);
        });

        // Get underperformers (bronze or neutral tier)
        const underperformers = allScoredAds.filter(
          (ad) => ad.score.tier === "bronze" || ad.score.tier === "neutral"
        );

        // Get winners for comparison
        const winners = getWinners(allScoredAds);

        // Generate improvement suggestions
        const suggestions: Array<{
          adId: string;
          headline: string;
          currentScore: number;
          issues: string[];
          suggestions: string[];
        }> = [];

        const targetAds = focusOnUnderperformers ? underperformers : allScoredAds;

        targetAds.slice(0, 10).forEach((ad) => {
          const issues: string[] = [];
          const adSuggestions: string[] = [];

          // Analyze issues based on score breakdown
          if (ad.score.ctrScore < 10) {
            issues.push("Low CTR");
            adSuggestions.push("Try more compelling headlines with urgency or value propositions");
            adSuggestions.push("Test questions or numbers in headlines");
          }
          if (ad.score.conversionScore < 15) {
            issues.push("Low conversions");
            adSuggestions.push("Improve landing page relevance and speed");
            adSuggestions.push("Add stronger call-to-action in descriptions");
          }
          if (ad.score.costScore < 10) {
            issues.push("Poor cost efficiency");
            adSuggestions.push("Review keyword targeting for intent match");
            adSuggestions.push("Consider narrowing audience targeting");
          }
          if (ad.score.impressionScore < 5) {
            issues.push("Low reach");
            adSuggestions.push("Check ad approval status");
            adSuggestions.push("Review keyword match types and bids");
          }

          if (issues.length > 0) {
            suggestions.push({
              adId: ad.id,
              headline: ad.headlines?.[0] || "N/A",
              currentScore: ad.score.overall,
              issues,
              suggestions: adSuggestions.slice(0, 3),
            });
          }
        });

        // Add general insights
        const generalInsights: string[] = [];
        if (winners.length === 0 && ads.length >= 3) {
          generalInsights.push("No clear winners yet - consider running tests longer");
        }
        if (underperformers.length > ads.length * 0.5) {
          generalInsights.push("Over half of ads underperforming - review overall messaging strategy");
        }
        if (adsByGroup.size === 1 && ads.length > 5) {
          generalInsights.push("Many ads in single ad group - consider splitting by theme");
        }

        return JSON.stringify({
          account: account.identityProfile?.fullName || account.googleCid,
          accountId: `MM${String(account.internalId).padStart(3, "0")}`,
          totalAdsAnalyzed: ads.length,
          underperformersCount: underperformers.length,
          winnersCount: winners.length,
          suggestions,
          generalInsights,
          topPerformerExample: winners[0] ? {
            headline: winners[0].headlines?.[0] || "N/A",
            score: winners[0].score.overall,
            whatWorked: [
              winners[0].score.ctrScore > 15 ? "Strong CTR" : null,
              winners[0].score.conversionScore > 20 ? "Good conversions" : null,
              winners[0].score.costScore > 15 ? "Cost efficient" : null,
            ].filter(Boolean),
          } : null,
        });
      } catch (error) {
        return JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : "Failed to generate suggestions",
          account: account.identityProfile?.fullName || account.googleCid,
        });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// Helper function to find an account and get valid OAuth access token
async function findAccountWithOAuth(identifier: string): Promise<{
  found: boolean;
  message?: string;
  account?: any;
  accessToken?: string;
}> {
  const lowerIdentifier = identifier.toLowerCase();

  // Try to find the account
  let account = await prisma.adAccount.findFirst({
    where: {
      OR: [
        { googleCid: { contains: lowerIdentifier, mode: "insensitive" } },
        { identityProfile: { fullName: { contains: lowerIdentifier, mode: "insensitive" } } },
      ],
    },
    include: {
      identityProfile: { select: { fullName: true } },
      connection: true,
    },
  });

  // Also try matching by internal ID
  if (!account) {
    const idMatch = lowerIdentifier.match(/mm?(\d+)/i);
    if (idMatch) {
      const internalId = parseInt(idMatch[1]);
      account = await prisma.adAccount.findFirst({
        where: { internalId },
        include: {
          identityProfile: { select: { fullName: true } },
          connection: true,
        },
      });
    }
  }

  if (!account) {
    return {
      found: false,
      message: `No account found matching "${identifier}"`,
    };
  }

  if (!account.googleCid) {
    return {
      found: false,
      message: `Account "${account.identityProfile?.fullName || identifier}" doesn't have a Google CID configured`,
    };
  }

  if (!account.connection) {
    return {
      found: false,
      message: `Account "${account.identityProfile?.fullName || identifier}" is not OAuth-connected. Connect via Settings → OAuth to enable this feature.`,
    };
  }

  // Check if token needs refresh
  let accessToken = account.connection.accessToken;
  const expiresAt = new Date(account.connection.tokenExpiresAt);

  if (expiresAt <= new Date()) {
    try {
      const refreshed = await refreshAccessToken(account.connection.refreshToken);
      accessToken = refreshed.accessToken;

      // Update the stored token
      await prisma.googleAdsConnection.update({
        where: { id: account.connection.id },
        data: {
          accessToken: refreshed.accessToken,
          tokenExpiresAt: refreshed.expiresAt,
        },
      });
    } catch (error) {
      return {
        found: false,
        message: `OAuth token expired and refresh failed for "${account.identityProfile?.fullName || identifier}". Please reconnect via Settings.`,
      };
    }
  }

  return {
    found: true,
    account,
    accessToken,
  };
}

// ============================================================================
// CONVERSATION MEMORY
// ============================================================================

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConversationContext {
  messages: ConversationMessage[];
  lastIntent?: string;
  lastAccountId?: string;
  lastTopicType?: string;
}

// DB operation with timeout
async function withDbTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`[DB] Operation timed out after ${ms}ms, using fallback`);
      resolve(fallback);
    }, ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    console.error("[DB] Operation failed:", error);
    return fallback;
  }
}

async function getConversationContext(
  chatId: string,
  userId?: string
): Promise<ConversationContext> {
  const defaultContext: ConversationContext = { messages: [] };

  try {
    // 3s timeout for loading conversation - if DB is slow, skip it
    const conversation = await withDbTimeout(
      prisma.botConversation.findFirst({
        where: { chatId, userId: userId || null },
      }),
      3000,
      null
    );

    if (conversation && new Date(conversation.expiresAt) > new Date()) {
      return {
        messages: JSON.parse(conversation.messages),
        lastIntent: conversation.lastIntent || undefined,
        lastAccountId: conversation.lastAccountId || undefined,
        lastTopicType: conversation.lastTopicType || undefined,
      };
    }
  } catch (e) {
    console.error("Error loading conversation:", e);
  }

  return defaultContext;
}

async function saveConversationContext(
  chatId: string,
  userId: string | undefined,
  context: ConversationContext
): Promise<void> {
  try {
    // Keep only last N messages
    const trimmedMessages = context.messages.slice(-MAX_CONVERSATION_HISTORY);
    const expiresAt = new Date(Date.now() + CONVERSATION_EXPIRY_MS);

    await prisma.botConversation.upsert({
      where: {
        chatId_userId: { chatId, userId: userId || "" },
      },
      create: {
        chatId,
        userId: userId || null,
        messages: JSON.stringify(trimmedMessages),
        lastIntent: context.lastIntent,
        lastAccountId: context.lastAccountId,
        lastTopicType: context.lastTopicType,
        expiresAt,
      },
      update: {
        messages: JSON.stringify(trimmedMessages),
        lastIntent: context.lastIntent,
        lastAccountId: context.lastAccountId,
        lastTopicType: context.lastTopicType,
        expiresAt,
      },
    });
  } catch (e) {
    console.error("Error saving conversation:", e);
  }
}

// ============================================================================
// AGENT SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are MagiManager Bot - a chill assistant for a Google Ads team.

RULE: Just answer. Use a tool. Don't ask questions.

ACCOUNT TOOLS:
- get_account_stats → counts and totals
- get_accounts_by_status("active"|"suspended"|"all") → list accounts
- get_accounts_needing_attention → problems
- get_top_performers → top spenders
- get_todays_spend → today's spend breakdown
- get_spend_by_period(days) → 7/14/30 day spend

GOOGLE ADS INTELLIGENCE (requires OAuth-connected account):
- get_search_terms(account_identifier) → actual search queries that triggered ads
- get_wasted_spend(account_identifier) → search terms with spend but zero conversions
- get_google_recommendations(account_identifier) → Google's AI suggestions
- get_recommendation_summary(account_identifier) → summary with impact metrics

AD PERFORMANCE ANALYSIS (requires OAuth-connected account):
- analyze_ad_performance(account_identifier, campaign_id?, ad_group_id?) → score and analyze ads
- compare_ads(account_identifier, ad_group_id) → compare ads in an ad group, find winners
- suggest_ad_improvements(account_identifier, campaign_id?) → get improvement suggestions for underperforming ads

WHAT TO DO:
- "tell me about my accounts" → get_account_stats
- "suspended accounts" → get_accounts_by_status("suspended")
- "any issues?" → get_accounts_needing_attention
- "show search terms for MM001" → get_search_terms("MM001")
- "wasted spend for John Smith" → get_wasted_spend("John Smith")
- "recommendations for 123-456-7890" → get_google_recommendations("123-456-7890")
- "analyze ads for MM001" → analyze_ad_performance("MM001")
- "which ads are winning?" → analyze_ad_performance with focus on winners
- "compare ads in ad group 12345" → compare_ads with ad_group_id
- "how can I improve my ads?" → suggest_ad_improvements

FORMAT: Short answers. *bold* for emphasis. Bullets for lists. Plain $ for money.

If tool fails: "Couldn't grab that, try /report"`;


// ============================================================================
// MAIN AGENT FUNCTION
// ============================================================================

export interface AgentResult {
  response: string;
  toolsUsed: string[];
  context: ConversationContext;
}

export async function runAgent(
  userMessage: string,
  chatId: string,
  userId?: string
): Promise<AgentResult> {
  if (!GEMINI_API_KEY) {
    return {
      response: "I'm not configured properly - missing API key. Please check the setup!",
      toolsUsed: [],
      context: { messages: [] },
    };
  }

  // Keep conversation simple - just the current message
  // Old context was causing confusion (AI would reference old account IDs)
  const context: ConversationContext = { messages: [] };

  // Start fresh - just the user's message
  const conversationHistory = [
    {
      role: "user",
      parts: [{ text: userMessage }],
    },
  ];

  const toolsUsed: string[] = [];
  let finalResponse = "";
  let iterations = 0;
  const maxIterations = 3; // Keep it simple - 1 tool call + response is usually enough
  const startTime = Date.now();
  let currentModelIndex = 0; // Track which model we're using

  // Agent loop - keep going until we have a final response
  while (iterations < maxIterations) {
    iterations++;

    // Safety check: if we've been running too long, bail out gracefully
    const elapsed = Date.now() - startTime;
    if (elapsed > AGENT_TIMEOUT_MS) {
      console.log(`[Agent] Timeout at ${iterations} iterations (${elapsed}ms)`);
      return {
        response: finalResponse || "That took longer than expected! Here's what I found so far, or try /report for a quick summary.",
        toolsUsed,
        context,
      };
    }

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: conversationHistory,
      tools: GEMINI_TOOLS,
      tool_config: {
        function_calling_config: {
          mode: "AUTO", // Let the model decide when to use tools
        },
      },
      generationConfig: {
        temperature: 0.5, // Lower = more direct, less rambling
        maxOutputTokens: 1024, // Keep responses tight
      },
    };

    // Try API call with model fallback
    let response: Response | null = null;
    let lastError: Error | null = null;

    for (let modelIdx = currentModelIndex; modelIdx < GEMINI_MODELS.length; modelIdx++) {
      const model = GEMINI_MODELS[modelIdx];
      const apiUrl = getGeminiUrl(model);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      try {
        console.log(`[Agent] Trying ${model} (iteration ${iterations})`);
        response = await fetch(`${apiUrl}?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          currentModelIndex = modelIdx; // Remember successful model
          break;
        }

        // Model-specific error - try next model
        const errorText = await response.text();
        console.error(`[Agent] ${model} error (${response.status}):`, errorText.slice(0, 200));

        // If rate limited or model unavailable, try next
        if (response.status === 429 || response.status === 503 || response.status === 404) {
          response = null;
          continue;
        }

        // Other errors - don't try more models
        break;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));

        if (lastError.name === "AbortError") {
          console.error(`[Agent] ${model} timeout after ${API_TIMEOUT_MS}ms`);
          // Timeout - try next model
          response = null;
          continue;
        }

        console.error(`[Agent] ${model} fetch error:`, lastError.message);
        response = null;
        continue;
      }
    }

    // If all models failed
    if (!response) {
      const errorMsg = lastError?.name === "AbortError"
        ? "All AI models timed out 😅 Try a simpler question, or use /report!"
        : "Couldn't reach my AI brain right now. Give it another try? 🔄";
      return {
        response: errorMsg,
        toolsUsed,
        context,
      };
    }

    if (!response.ok) {
      const error = await response.text();
      console.error("[Agent] All models failed:", error.slice(0, 200));
      return {
        response: "My brain glitched for a moment 🤖 Try again, or use /report if you need data quick!",
        toolsUsed,
        context,
      };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate?.content?.parts) {
      return {
        response: "Hmm, I got confused there. Could you try rephrasing?",
        toolsUsed,
        context,
      };
    }

    // Process each part of the response
    let hasToolCall = false;
    for (const part of candidate.content.parts) {
      // Check for function calls
      if (part.functionCall) {
        hasToolCall = true;
        const toolName = part.functionCall.name;
        const toolArgs = part.functionCall.args || {};

        console.log(`[Agent] Tool call: ${toolName}`);
        toolsUsed.push(toolName);

        // Execute the tool with error handling
        let toolResult: string;
        try {
          toolResult = await executeToolCall(toolName, toolArgs);
        } catch (toolError) {
          console.error(`[Agent] Tool ${toolName} threw:`, toolError);
          toolResult = JSON.stringify({ error: true, message: "Tool execution failed" });
        }

        // Check if it's a clarification request (safely parse)
        try {
          const parsed = JSON.parse(toolResult);
          if (parsed.type === "clarification") {
            // Return the clarification question directly
            let clarificationMsg = parsed.question;
            if (parsed.options?.length) {
              clarificationMsg += "\n\nOptions:\n" + parsed.options.map((o: string, i: number) => `${i + 1}. ${o}`).join("\n");
            }
            finalResponse = clarificationMsg;
            break;
          }
        } catch {
          // Not JSON or not a clarification - continue normally
        }

        // Add function call and result to conversation
        conversationHistory.push({
          role: "model",
          parts: [{ functionCall: part.functionCall }],
        } as any);

        conversationHistory.push({
          role: "function",
          parts: [
            {
              functionResponse: {
                name: toolName,
                response: { result: toolResult },
              },
            },
          ],
        } as any);
      }

      // Check for text response (final answer)
      if (part.text && !hasToolCall) {
        // Only use text if there's no tool call in this response
        finalResponse = part.text;
      }
    }

    // If there was a tool call, continue to next iteration for model to process results
    if (hasToolCall && !finalResponse) {
      console.log(`[Agent] Iteration ${iterations} had tool call, continuing...`);
      continue;
    }

    // If we have a final response, break out of the loop
    if (finalResponse) {
      break;
    }
  }

  // If we hit max iterations without a response, provide fallback
  if (!finalResponse && iterations >= maxIterations) {
    console.log(`[Agent] Hit max iterations (${maxIterations}) without response`);
    finalResponse = "I got a bit lost there! Try a simpler question, or use /report for quick stats.";
  }

  // Update conversation context
  const newContext: ConversationContext = {
    messages: [
      ...context.messages,
      { role: "user", content: userMessage, timestamp: new Date().toISOString() },
      { role: "assistant", content: finalResponse, timestamp: new Date().toISOString() },
    ],
    lastIntent: toolsUsed[0] || context.lastIntent,
    lastTopicType: inferTopicType(toolsUsed) || context.lastTopicType,
    lastAccountId: extractAccountId(finalResponse) || context.lastAccountId,
  };

  // Fire-and-forget conversation save - don't wait for it
  saveConversationContext(chatId, userId, newContext).catch((e) => {
    console.error("[Agent] Failed to save conversation:", e);
  });

  console.log(`[Agent] Completed in ${Date.now() - startTime}ms, ${iterations} iterations, tools: ${toolsUsed.join(", ") || "none"}`);

  return {
    response: finalResponse || "I'm not sure how to help with that. Try asking about accounts, alerts, or team performance!",
    toolsUsed,
    context: newContext,
  };
}

// Helper to infer topic type from tools used
function inferTopicType(tools: string[]): string | undefined {
  if (tools.some((t) => t.includes("account"))) return "accounts";
  if (tools.some((t) => t.includes("media_buyer") || t.includes("team"))) return "team";
  if (tools.some((t) => t.includes("identity"))) return "identities";
  if (tools.some((t) => t.includes("activity"))) return "activity";
  if (tools.some((t) => t.includes("attention") || t.includes("alerts"))) return "alerts";
  return undefined;
}

// Helper to extract account ID from response
function extractAccountId(response: string): string | undefined {
  const match = response.match(/MM\d{3}/i);
  return match ? match[0] : undefined;
}

// ============================================================================
// QUICK HELPERS FOR COMMANDS
// ============================================================================

export async function generateQuickReport(): Promise<string> {
  // Fetch all data in parallel for performance
  const [stats, alerts, todaySpend, spend7d, spend14d, spend30d] = await Promise.all([
    executeToolCall("get_account_stats", {}).then(JSON.parse),
    executeToolCall("get_accounts_needing_attention", {}).then(JSON.parse),
    executeToolCall("get_todays_spend", { include_breakdown: true }).then(JSON.parse),
    executeToolCall("get_spend_by_period", { days: 7 }).then(JSON.parse),
    executeToolCall("get_spend_by_period", { days: 14 }).then(JSON.parse),
    executeToolCall("get_spend_by_period", { days: 30 }).then(JSON.parse),
  ]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let report = `📊 *Daily Report*\n_${dateStr}_\n\n`;

  report += `*Summary:*\n`;
  report += `• Total: ${stats.total} accounts\n`;
  report += `• Active: ${stats.active} ✅\n`;
  if (stats.limited > 0) report += `• Limited: ${stats.limited} ⚠️\n`;
  if (stats.suspended > 0) report += `• Suspended: ${stats.suspended} 🔴\n`;
  if (stats.banned > 0) report += `• Banned: ${stats.banned} ⛔\n`;
  report += `• Handed Off: ${stats.handedOff}\n`;
  report += `• Total Ads: ${stats.totalAds}\n\n`;

  report += `*💰 Spend Overview:*\n`;
  report += `• Today: ${todaySpend.totalTodaysSpend}\n`;
  report += `• Last 7 Days: ${spend7d.totalSpend}\n`;
  report += `• Last 14 Days: ${spend14d.totalSpend}\n`;
  report += `• Last 30 Days: ${spend30d.totalSpend}\n\n`;

  // Today's spend breakdown by account (if any spending today)
  if (todaySpend.breakdown && todaySpend.breakdown.length > 0) {
    report += `*📈 Today's Breakdown:*\n`;
    todaySpend.breakdown.forEach((a: any) => {
      report += `• ${a.name} - ${a.todaySpend}\n`;
    });
    report += "\n";
  }

  if (alerts.total > 0) {
    report += `*⚠️ Needs Attention: ${alerts.total}*\n`;
    if (alerts.critical.length > 0) {
      report += `• Critical: ${alerts.critical.length}\n`;
    }
    if (alerts.warning.length > 0) {
      report += `• Warnings: ${alerts.warning.length}\n`;
    }
    report += "\n";
  }

  return report;
}

export async function generateQuickAlerts(): Promise<string> {
  const alerts = JSON.parse(await executeToolCall("get_accounts_needing_attention", {}));

  if (alerts.total === 0) {
    return "✅ *No Alerts*\nAll accounts are in good standing!";
  }

  let report = `🚨 *Accounts Needing Attention*\n\n`;

  if (alerts.critical.length > 0) {
    report += `*Critical (${alerts.critical.length}):*\n`;
    alerts.critical.forEach((a: any) => {
      report += `• 🔴 ${a.name} - ${a.reason}\n`;
    });
    report += "\n";
  }

  if (alerts.warning.length > 0) {
    report += `*Warning (${alerts.warning.length}):*\n`;
    alerts.warning.forEach((a: any) => {
      report += `• ⚠️ ${a.name} - ${a.reason}\n`;
    });
    report += "\n";
  }

  if (alerts.info.length > 0) {
    report += `*Info (${alerts.info.length}):*\n`;
    alerts.info.forEach((a: any) => {
      report += `• ℹ️ ${a.name} - ${a.reason}\n`;
    });
  }

  return report;
}

export async function generateQuickSummary(): Promise<string> {
  const stats = JSON.parse(await executeToolCall("get_account_stats", {}));
  const alerts = JSON.parse(await executeToolCall("get_accounts_needing_attention", {}));

  return (
    `📈 *Quick Summary*\n\n` +
    `Accounts: ${stats.total} total, ${stats.active} active\n` +
    `Issues: ${alerts.total > 0 ? `${alerts.total} need attention ⚠️` : "None ✅"}\n` +
    `Total Spend: ${stats.totalSpend}`
  );
}
