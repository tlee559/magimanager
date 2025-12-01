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
  Lock,
  Sparkles,
  Plus,
  Link2,
} from "lucide-react";
import type {
  Campaign,
  CampaignStatus,
  CampaignType,
  BiddingStrategy,
} from "@magimanager/shared";
import { isFeatureEnabled, formatCost, formatCtr } from "@magimanager/shared";
import type { DateRange } from "./index";

// ============================================================================
// TYPES
// ============================================================================

type SortField = "name" | "status" | "cost" | "clicks" | "impressions" | "ctr" | "conversions";
type SortDirection = "asc" | "desc";

interface CampaignsTabProps {
  accountId: string;
  customerId: string;
  dateRange: DateRange;
  onCampaignSelect: (campaignId: string, campaignName: string) => void;
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

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}

function StatCard({ icon, label, value, subValue, color }: StatCardProps) {
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
      </div>
    </div>
  );
}

// ============================================================================
// CAMPAIGN ROW COMPONENT
// ============================================================================

interface CampaignRowProps {
  campaign: Campaign;
  onSelect: (id: string, name: string) => void;
}

function CampaignRow({ campaign, onSelect }: CampaignRowProps) {
  const statusBadge = getStatusBadge(campaign.status);
  const canPause = isFeatureEnabled("campaigns.pause");

  const cpa = campaign.conversions > 0 ? campaign.cost / campaign.conversions : 0;
  const roas = campaign.cost > 0 ? (campaign.conversionValue / campaign.cost) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/30">
      {/* Campaign Type Badge */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${getCampaignTypeColor(campaign.type)}`}
        title={campaign.type}
      >
        {getCampaignTypeIcon(campaign.type)}
      </div>

      {/* Campaign Name & Info - Clickable */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onSelect(campaign.id, campaign.name)}
          className="text-left group"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100 group-hover:text-violet-400 transition truncate">
              {campaign.name}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition" />
            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
        </button>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>{getBiddingStrategyLabel(campaign.biddingStrategy)}</span>
          <span>Budget: {formatCost(campaign.budgetAmount)}/day</span>
          <span>{campaign.adGroupCount} ad groups</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-right">
        <div className="w-16">
          <div className="text-sm font-medium text-slate-100">{formatCost(campaign.cost)}</div>
          <div className="text-xs text-slate-500">Spend</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{campaign.clicks.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Clicks</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{campaign.conversions.toFixed(1)}</div>
          <div className="text-xs text-slate-500">Conv.</div>
        </div>
        <div className="w-16">
          <div className="text-sm font-medium text-slate-100">{cpa > 0 ? formatCost(cpa) : "—"}</div>
          <div className="text-xs text-slate-500">CPA</div>
        </div>
        <div className="w-14">
          <div className="text-sm font-medium text-slate-100">{roas > 0 ? `${roas.toFixed(0)}%` : "—"}</div>
          <div className="text-xs text-slate-500">ROAS</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{formatCtr(campaign.ctr)}</div>
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
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CAMPAIGNS TAB
// ============================================================================

export function CampaignsTab({ accountId, customerId, dateRange, onCampaignSelect }: CampaignsTabProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<CampaignType | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [syncing, setSyncing] = useState(false);

  const canViewCampaigns = isFeatureEnabled("campaigns.view");
  const canEditCampaigns = isFeatureEnabled("campaigns.edit");

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
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch campaigns");
      }

      setCampaigns(data.campaigns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
  }, [accountId, customerId, dateRange]);

  // Sync account with Google Ads (triggers full data refresh)
  async function syncAccount(): Promise<boolean> {
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("Sync failed:", data.error);
        return false;
      }

      console.log("[CampaignsTab] Sync completed:", data.metrics);
      return true;
    } catch (err) {
      console.error("Sync failed:", err);
      return false;
    }
  }

  // Handle sync - syncs account first, then fetches campaigns
  async function handleSync() {
    setSyncing(true);
    setLoading(true);
    // First sync the account to get fresh data from Google Ads
    const syncSuccess = await syncAccount();
    if (syncSuccess) {
      // Then fetch the campaigns
      await fetchCampaigns();
    }
    setSyncing(false);
    setLoading(false);
  }

  // Filter and sort campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(query));
    }

    if (statusFilter !== "ALL") {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (typeFilter !== "ALL") {
      result = result.filter((c) => c.type === typeFilter);
    }

    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "name": aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case "status": aVal = a.status; bVal = b.status; break;
        case "cost": aVal = a.cost; bVal = b.cost; break;
        case "clicks": aVal = a.clicks; bVal = b.clicks; break;
        case "impressions": aVal = a.impressions; bVal = b.impressions; break;
        case "ctr": aVal = a.ctr; bVal = b.ctr; break;
        case "conversions": aVal = a.conversions; bVal = b.conversions; break;
        default: return 0;
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [campaigns, searchQuery, statusFilter, typeFilter, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalSpend = campaigns.reduce((sum, c) => sum + c.cost, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const totalConversionValue = campaigns.reduce((sum, c) => sum + c.conversionValue, 0);
    return {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === "ENABLED").length,
      totalSpend,
      totalClicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
      totalConversions,
      avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      avgRoas: totalSpend > 0 ? (totalConversionValue / totalSpend) * 100 : 0,
      avgCtr: campaigns.length > 0 ? campaigns.reduce((sum, c) => sum + c.ctr, 0) / campaigns.length : 0,
    };
  }, [campaigns]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

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
    <div className="space-y-4">
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

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
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
          <div className="w-12" /> {/* Actions space */}
        </div>

        {/* Campaign Rows */}
        {filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1">No campaigns found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL"
                ? "Try adjusting your filters"
                : "This account has no campaigns yet"}
            </div>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              onSelect={onCampaignSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
