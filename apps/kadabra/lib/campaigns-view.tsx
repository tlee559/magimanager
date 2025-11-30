"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Eye,
  Layers,
  FileText,
  Lock,
  Sparkles,
  Plus,
} from "lucide-react";
import type {
  Campaign,
  CampaignStatus,
  CampaignType,
  BiddingStrategy,
  AdGroup,
  Ad,
  Keyword,
} from "@magimanager/shared";
import { isFeatureEnabled, formatCost, formatCtr, microsToCurrency } from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

type SortField = "name" | "status" | "cost" | "clicks" | "impressions" | "ctr" | "conversions";
type SortDirection = "asc" | "desc";
type DateRange = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_14_DAYS" | "LAST_30_DAYS";

interface CampaignsViewProps {
  accountId: string;
  customerId: string;
  accountName: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getCampaignTypeIcon(type: CampaignType): string {
  switch (type) {
    case "SEARCH": return "S";
    case "DISPLAY": return "D";
    case "VIDEO": return "V";
    case "SHOPPING": return "$";
    case "PERFORMANCE_MAX": return "P";
    case "APP": return "A";
    case "SMART": return "*";
    case "LOCAL": return "L";
    default: return "?";
  }
}

function getCampaignTypeColor(type: CampaignType): string {
  switch (type) {
    case "SEARCH": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "DISPLAY": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "VIDEO": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "SHOPPING": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "PERFORMANCE_MAX": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
}

function getStatusBadge(status: CampaignStatus): { color: string; label: string } {
  switch (status) {
    case "ENABLED":
      return { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Active" };
    case "PAUSED":
      return { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Paused" };
    case "REMOVED":
      return { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Removed" };
    default:
      return { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: status };
  }
}

function getBiddingStrategyLabel(strategy: BiddingStrategy): string {
  switch (strategy) {
    case "MANUAL_CPC": return "Manual CPC";
    case "MAXIMIZE_CLICKS": return "Max Clicks";
    case "MAXIMIZE_CONVERSIONS": return "Max Conversions";
    case "MAXIMIZE_CONVERSION_VALUE": return "Max Conv. Value";
    case "TARGET_CPA": return "Target CPA";
    case "TARGET_ROAS": return "Target ROAS";
    case "TARGET_IMPRESSION_SHARE": return "Target Imp. Share";
    case "ENHANCED_CPC": return "Enhanced CPC";
    default: return strategy;
  }
}

// Coming Soon Badge component
function ComingSoonBadge({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-300 rounded-full ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <Sparkles className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      Coming Soon
    </span>
  );
}

// ============================================================================
// CAMPAIGN ROW COMPONENT
// ============================================================================

interface CampaignRowProps {
  campaign: Campaign;
  isExpanded: boolean;
  onToggle: () => void;
  accountId: string;
  customerId: string;
}

type DetailView = "none" | "adGroups" | "ads" | "keywords";

function CampaignRow({ campaign, isExpanded, onToggle, accountId, customerId }: CampaignRowProps) {
  const statusBadge = getStatusBadge(campaign.status);
  const canEdit = isFeatureEnabled("campaigns.edit");
  const canPause = isFeatureEnabled("campaigns.pause");

  // Detail view state
  const [activeView, setActiveView] = useState<DetailView>("none");
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loadingAdGroups, setLoadingAdGroups] = useState(false);
  const [loadingAds, setLoadingAds] = useState(false);
  const [loadingKeywords, setLoadingKeywords] = useState(false);

  async function handleViewAdGroups() {
    if (activeView === "adGroups") {
      setActiveView("none");
      return;
    }
    setActiveView("adGroups");
    if (adGroups.length === 0) {
      setLoadingAdGroups(true);
      try {
        const res = await fetch(
          `/api/campaigns/${campaign.id}/ad-groups?accountId=${accountId}&customerId=${customerId}`
        );
        if (res.ok) {
          const data = await res.json();
          setAdGroups(data.adGroups || []);
        }
      } catch (err) {
        console.error("Failed to fetch ad groups:", err);
      } finally {
        setLoadingAdGroups(false);
      }
    }
  }

  async function handleViewAds() {
    if (activeView === "ads") {
      setActiveView("none");
      return;
    }
    setActiveView("ads");
    if (ads.length === 0) {
      setLoadingAds(true);
      try {
        const res = await fetch(
          `/api/campaigns/${campaign.id}/ads?accountId=${accountId}&customerId=${customerId}`
        );
        if (res.ok) {
          const data = await res.json();
          setAds(data.ads || []);
        }
      } catch (err) {
        console.error("Failed to fetch ads:", err);
      } finally {
        setLoadingAds(false);
      }
    }
  }

  async function handleViewKeywords() {
    if (activeView === "keywords") {
      setActiveView("none");
      return;
    }
    setActiveView("keywords");
    if (keywords.length === 0) {
      setLoadingKeywords(true);
      try {
        const res = await fetch(
          `/api/campaigns/${campaign.id}/keywords?accountId=${accountId}&customerId=${customerId}`
        );
        if (res.ok) {
          const data = await res.json();
          setKeywords(data.keywords || []);
        }
      } catch (err) {
        console.error("Failed to fetch keywords:", err);
      } finally {
        setLoadingKeywords(false);
      }
    }
  }

  return (
    <div className="border-b border-slate-800 hover:bg-slate-800/30">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Expand/Collapse */}
        <button
          onClick={onToggle}
          className="p-1 hover:bg-slate-700 rounded transition"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Campaign Type Badge */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${getCampaignTypeColor(campaign.type)}`}
          title={campaign.type}
        >
          {getCampaignTypeIcon(campaign.type)}
        </div>

        {/* Campaign Name & Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100 truncate">
              {campaign.name}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span>{getBiddingStrategyLabel(campaign.biddingStrategy)}</span>
            <span>Budget: {formatCost(campaign.budgetAmount)}/day</span>
            <span>{campaign.adGroupCount} ad groups</span>
            <span>{campaign.activeAdsCount} ads</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 text-right">
          <div className="w-16">
            <div className="text-sm font-medium text-slate-100">
              {formatCost(campaign.cost)}
            </div>
            <div className="text-xs text-slate-500">Spend</div>
          </div>
          <div className="w-12">
            <div className="text-sm font-medium text-slate-100">
              {campaign.clicks.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">Clicks</div>
          </div>
          <div className="w-12">
            <div className="text-sm font-medium text-slate-100">
              {campaign.conversions.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">Conv.</div>
          </div>
          <div className="w-16">
            <div className="text-sm font-medium text-slate-100">
              {campaign.conversions > 0
                ? formatCost(campaign.cost / campaign.conversions)
                : "—"}
            </div>
            <div className="text-xs text-slate-500">CPA</div>
          </div>
          <div className="w-14">
            <div className="text-sm font-medium text-slate-100">
              {campaign.cost > 0
                ? `${((campaign.conversionValue / campaign.cost) * 100).toFixed(0)}%`
                : "—"}
            </div>
            <div className="text-xs text-slate-500">ROAS</div>
          </div>
          <div className="w-12">
            <div className="text-sm font-medium text-slate-100">
              {formatCtr(campaign.ctr)}
            </div>
            <div className="text-xs text-slate-500">CTR</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {campaign.status === "ENABLED" ? (
            <button
              disabled={!canPause}
              className={`p-2 rounded-lg transition ${
                canPause
                  ? "hover:bg-yellow-500/10 text-yellow-400"
                  : "text-slate-600 cursor-not-allowed"
              }`}
              title={canPause ? "Pause Campaign" : "Write access required"}
            >
              {!canPause && <Lock className="w-3 h-3 absolute -mt-1 -mr-1" />}
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              disabled={!canPause}
              className={`p-2 rounded-lg transition ${
                canPause
                  ? "hover:bg-emerald-500/10 text-emerald-400"
                  : "text-slate-600 cursor-not-allowed"
              }`}
              title={canPause ? "Enable Campaign" : "Write access required"}
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
            className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400"
            title="View Details"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-800">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-slate-500 text-xs mb-1">Target CPA</div>
              <div className="text-slate-200">
                {campaign.targetCpa ? formatCost(campaign.targetCpa) : "—"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Target ROAS</div>
              <div className="text-slate-200">
                {campaign.targetRoas ? `${(campaign.targetRoas * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Avg. CPC</div>
              <div className="text-slate-200">{formatCost(campaign.averageCpc)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Conv. Value</div>
              <div className="text-slate-200">${campaign.conversionValue.toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleViewAdGroups}
              className={`px-3 py-1.5 text-xs rounded-lg text-slate-300 transition flex items-center gap-1 ${
                activeView === "adGroups"
                  ? "bg-violet-600 hover:bg-violet-500"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              <Layers className="w-3 h-3" />
              {loadingAdGroups ? "Loading..." : "View Ad Groups"}
            </button>
            <button
              onClick={handleViewAds}
              className={`px-3 py-1.5 text-xs rounded-lg text-slate-300 transition flex items-center gap-1 ${
                activeView === "ads"
                  ? "bg-violet-600 hover:bg-violet-500"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              <FileText className="w-3 h-3" />
              {loadingAds ? "Loading..." : "View Ads"}
            </button>
            <button
              onClick={handleViewKeywords}
              className={`px-3 py-1.5 text-xs rounded-lg text-slate-300 transition flex items-center gap-1 ${
                activeView === "keywords"
                  ? "bg-violet-600 hover:bg-violet-500"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              <Target className="w-3 h-3" />
              {loadingKeywords ? "Loading..." : "View Keywords"}
            </button>
          </div>

          {/* Ad Groups Expansion */}
          {activeView === "adGroups" && (
            <div className="mt-3 border-t border-slate-700 pt-3">
              <div className="text-xs text-slate-400 mb-2">Ad Groups ({adGroups.length})</div>
              {loadingAdGroups ? (
                <div className="text-sm text-slate-500">Loading ad groups...</div>
              ) : adGroups.length === 0 ? (
                <div className="text-sm text-slate-500">No ad groups found</div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {adGroups.map((ag) => (
                    <div key={ag.id} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2">
                      <div>
                        <div className="text-sm text-slate-200">{ag.name}</div>
                        <div className="text-xs text-slate-500">
                          {ag.status} | {ag.adsCount ?? 0} ads
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-slate-200">{formatCost(ag.cost)}</div>
                        <div className="text-slate-500">{ag.clicks} clicks</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ads Expansion */}
          {activeView === "ads" && (
            <div className="mt-3 border-t border-slate-700 pt-3">
              <div className="text-xs text-slate-400 mb-2">Ads ({ads.length})</div>
              {loadingAds ? (
                <div className="text-sm text-slate-500">Loading ads...</div>
              ) : ads.length === 0 ? (
                <div className="text-sm text-slate-500">No ads found</div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {ads.map((ad) => (
                    <div key={ad.id} className="bg-slate-800/50 rounded px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 truncate">
                            {ad.headlines?.[0] || ad.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {ad.status} | {ad.type}
                          </div>
                        </div>
                        <div className="text-right text-xs ml-4">
                          <div className="text-slate-200">{formatCtr(ad.ctr)}</div>
                          <div className="text-slate-500">{ad.clicks} clicks</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Keywords Expansion */}
          {activeView === "keywords" && (
            <div className="mt-3 border-t border-slate-700 pt-3">
              <div className="text-xs text-slate-400 mb-2">Keywords ({keywords.length})</div>
              {loadingKeywords ? (
                <div className="text-sm text-slate-500">Loading keywords...</div>
              ) : keywords.length === 0 ? (
                <div className="text-sm text-slate-500">No keywords found</div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {keywords.map((kw) => (
                    <div key={kw.id} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2">
                      <div>
                        <div className="text-sm text-slate-200">{kw.text}</div>
                        <div className="text-xs text-slate-500">
                          {kw.matchType} | {kw.status}
                          {kw.qualityScore && ` | QS: ${kw.qualityScore}`}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-slate-200">{formatCost(kw.cost)}</div>
                        <div className="text-slate-500">{kw.clicks} clicks | {formatCtr(kw.ctr)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  trend?: { value: number; isPositive: boolean };
  color: string;
}

function StatCard({ icon, label, value, subValue, trend, color }: StatCardProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xl font-bold text-slate-100">{value}</div>
          {subValue && <div className="text-xs text-slate-500">{subValue}</div>}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend.value).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CAMPAIGNS VIEW
// ============================================================================

export function CampaignsView({ accountId, customerId, accountName }: CampaignsViewProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<CampaignType | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("LAST_7_DAYS");
  const [accountSuspended, setAccountSuspended] = useState(false);
  const [cachedCampaignCount, setCachedCampaignCount] = useState<number | undefined>();

  // Feature flags
  const canViewCampaigns = isFeatureEnabled("campaigns.view");
  const canEditCampaigns = isFeatureEnabled("campaigns.edit");
  const canPauseCampaigns = isFeatureEnabled("campaigns.pause");

  // Fetch campaigns
  async function fetchCampaigns() {
    if (!canViewCampaigns) {
      setError("Campaign viewing is disabled");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns?accountId=${accountId}&customerId=${customerId}&dateRange=${dateRange}`);
      if (!res.ok) {
        throw new Error("Failed to fetch campaigns");
      }
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setAccountSuspended(data.accountSuspended || false);
      setCachedCampaignCount(data.cachedCampaignCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
  }, [accountId, customerId, dateRange]);

  // Handle sync
  async function handleSync() {
    setSyncing(true);
    await fetchCampaigns();
    setSyncing(false);
  }

  // Filter and sort campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(query));
    }

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "ALL") {
      result = result.filter((c) => c.type === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "cost":
          aVal = a.cost;
          bVal = b.cost;
          break;
        case "clicks":
          aVal = a.clicks;
          bVal = b.clicks;
          break;
        case "impressions":
          aVal = a.impressions;
          bVal = b.impressions;
          break;
        case "ctr":
          aVal = a.ctr;
          bVal = b.ctr;
          break;
        case "conversions":
          aVal = a.conversions;
          bVal = b.conversions;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDirection === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [campaigns, searchQuery, statusFilter, typeFilter, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    const activeCampaigns = campaigns.filter((c) => c.status === "ENABLED");
    const totalSpend = campaigns.reduce((sum, c) => sum + c.cost, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const totalConversionValue = campaigns.reduce((sum, c) => sum + c.conversionValue, 0);
    return {
      total: campaigns.length,
      active: activeCampaigns.length,
      paused: campaigns.filter((c) => c.status === "PAUSED").length,
      totalSpend,
      totalClicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
      totalImpressions: campaigns.reduce((sum, c) => sum + c.impressions, 0),
      totalConversions,
      avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      avgRoas: totalSpend > 0 ? (totalConversionValue / totalSpend) * 100 : 0,
      avgCtr: campaigns.length > 0
        ? campaigns.reduce((sum, c) => sum + c.ctr, 0) / campaigns.length
        : 0,
    };
  }, [campaigns]);

  // Toggle functions
  function toggleExpanded(id: string) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <div className="text-red-400 mb-2">Failed to load campaigns</div>
        <div className="text-sm text-slate-500 mb-4">{error}</div>
        <button
          onClick={fetchCampaigns}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Campaigns</h2>
          <p className="text-sm text-slate-500">{accountName} ({customerId})</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Picker */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
          >
            <option value="TODAY">Today</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_14_DAYS">Last 14 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
          </select>

          {!canEditCampaigns && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
              <Eye className="w-3 h-3" />
              Monitoring Mode
            </div>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-700/30 rounded-lg text-sm text-slate-500 cursor-not-allowed">
            <Plus className="w-4 h-4" />
            Create
            <ComingSoonBadge />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          label="Total Spend"
          value={formatCost(totals.totalSpend)}
          subValue={`${totals.active} active campaigns`}
          color="bg-emerald-500/10"
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-amber-400" />}
          label="Conversions"
          value={totals.totalConversions.toFixed(1)}
          subValue={`${totals.totalClicks.toLocaleString()} clicks`}
          color="bg-amber-500/10"
        />
        <StatCard
          icon={<DollarSign className="w-4 h-4 text-blue-400" />}
          label="Avg CPA"
          value={totals.avgCpa > 0 ? formatCost(totals.avgCpa) : "—"}
          subValue={`${formatCtr(totals.avgCtr)} avg CTR`}
          color="bg-blue-500/10"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-violet-400" />}
          label="ROAS"
          value={totals.avgRoas > 0 ? `${totals.avgRoas.toFixed(0)}%` : "—"}
          subValue={`${totals.total} campaigns total`}
          color="bg-violet-500/10"
        />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "ALL")}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
        >
          <option value="ALL">All Status</option>
          <option value="ENABLED">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="REMOVED">Removed</option>
        </select>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CampaignType | "ALL")}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
        >
          <option value="ALL">All Types</option>
          <option value="SEARCH">Search</option>
          <option value="DISPLAY">Display</option>
          <option value="VIDEO">Video</option>
          <option value="SHOPPING">Shopping</option>
          <option value="PERFORMANCE_MAX">Performance Max</option>
        </select>

        {/* Sort */}
        <select
          value={`${sortField}-${sortDirection}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split("-") as [SortField, SortDirection];
            setSortField(field);
            setSortDirection(dir);
          }}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
        >
          <option value="cost-desc">Spend (High to Low)</option>
          <option value="cost-asc">Spend (Low to High)</option>
          <option value="clicks-desc">Clicks (High to Low)</option>
          <option value="conversions-desc">Conversions (High to Low)</option>
          <option value="ctr-desc">CTR (High to Low)</option>
          <option value="name-asc">Name (A-Z)</option>
        </select>
      </div>

      {/* Campaigns Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="w-6" /> {/* Expand space */}
          <div className="w-8" /> {/* Type badge space */}
          <div className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">Campaign</div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
            <div className="w-16 text-right">Spend</div>
            <div className="w-12 text-right">Clicks</div>
            <div className="w-12 text-right">Conv.</div>
            <div className="w-16 text-right">CPA</div>
            <div className="w-14 text-right">ROAS</div>
            <div className="w-12 text-right">CTR</div>
          </div>
          <div className="w-20" /> {/* Actions space */}
        </div>

        {/* Campaign Rows */}
        {filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            {accountSuspended ? (
              <>
                <Lock className="w-12 h-12 text-red-500/60 mx-auto mb-3" />
                <div className="text-red-400 mb-1">Account Suspended</div>
                <div className="text-sm text-slate-500">
                  Google Ads API cannot retrieve campaign data for suspended accounts.
                  {cachedCampaignCount && (
                    <span className="block mt-1 text-slate-600">
                      This account previously had {cachedCampaignCount} campaign{cachedCampaignCount !== 1 ? 's' : ''}.
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <div className="text-slate-400 mb-1">No campaigns found</div>
                <div className="text-sm text-slate-600">
                  {searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL"
                    ? "Try adjusting your filters"
                    : "This account has no campaigns yet"}
                </div>
              </>
            )}
          </div>
        ) : (
          filteredCampaigns.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              isExpanded={expandedCampaigns.has(campaign.id)}
              onToggle={() => toggleExpanded(campaign.id)}
              accountId={accountId}
              customerId={customerId}
            />
          ))
        )}
      </div>

      {/* AI Insights Teaser */}
      {isFeatureEnabled("ai.insights") && (
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-100">AI Insights Available</div>
              <div className="text-xs text-slate-400">
                Get AI-powered recommendations to optimize your campaigns
              </div>
            </div>
            <button className="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg text-sm transition">
              View Insights
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
