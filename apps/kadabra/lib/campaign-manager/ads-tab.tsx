"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Play,
  Pause,
  TrendingUp,
  Target,
  DollarSign,
  FileText,
  ExternalLink,
} from "lucide-react";
import type { Ad, AdStatus } from "@magimanager/shared";
import { isFeatureEnabled, formatCost, formatCtr } from "@magimanager/shared";
import type { DateRange } from "./index";

// ============================================================================
// TYPES
// ============================================================================

type SortField = "name" | "status" | "clicks" | "ctr" | "conversions";
type SortDirection = "asc" | "desc";

interface AdsTabProps {
  accountId: string;
  customerId: string;
  dateRange: DateRange;
  campaignId: string | null;
  adGroupId: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function getStatusBadge(status: AdStatus): { color: string; label: string } {
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

function getAdTypeBadge(type: string): { color: string; label: string } {
  switch (type) {
    case "RESPONSIVE_SEARCH_AD":
      return { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "RSA" };
    case "EXPANDED_TEXT_AD":
      return { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "ETA" };
    case "RESPONSIVE_DISPLAY_AD":
      return { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "RDA" };
    case "IMAGE_AD":
      return { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Image" };
    case "VIDEO_AD":
      return { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Video" };
    default:
      return { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: type };
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
      <div>
        <div className="text-xl font-bold text-slate-100">{value}</div>
        {subValue && <div className="text-xs text-slate-500">{subValue}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// AD ROW COMPONENT
// ============================================================================

interface AdRowProps {
  ad: Ad;
}

function AdRow({ ad }: AdRowProps) {
  const statusBadge = getStatusBadge(ad.status);
  const typeBadge = getAdTypeBadge(ad.type);
  const canPause = isFeatureEnabled("ads.pause");

  const headline = ad.headlines?.[0] || ad.name;
  const description = ad.descriptions?.[0] || "";

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/30">
      {/* Ad Type Badge */}
      <div className={`px-2 py-1 rounded text-xs font-medium border ${typeBadge.color}`}>
        {typeBadge.label}
      </div>

      {/* Ad Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-100 truncate">
            {headline}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>
        {description && (
          <div className="text-xs text-slate-500 truncate mt-1">
            {description}
          </div>
        )}
        {ad.finalUrls?.[0] && (
          <div className="flex items-center gap-1 text-xs text-blue-400 mt-1">
            <ExternalLink className="w-3 h-3" />
            <span className="truncate">{ad.finalUrls[0]}</span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-right">
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{ad.clicks.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Clicks</div>
        </div>
        <div className="w-14">
          <div className="text-sm font-medium text-slate-100">{ad.impressions.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Impr.</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{formatCtr(ad.ctr)}</div>
          <div className="text-xs text-slate-500">CTR</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{ad.conversions.toFixed(1)}</div>
          <div className="text-xs text-slate-500">Conv.</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {ad.status === "ENABLED" ? (
          <button
            disabled={!canPause}
            className={`p-2 rounded-lg transition ${
              canPause ? "hover:bg-yellow-500/10 text-yellow-400" : "text-slate-600 cursor-not-allowed"
            }`}
            title={canPause ? "Pause Ad" : "Write access required"}
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            disabled={!canPause}
            className={`p-2 rounded-lg transition ${
              canPause ? "hover:bg-emerald-500/10 text-emerald-400" : "text-slate-600 cursor-not-allowed"
            }`}
            title={canPause ? "Enable Ad" : "Write access required"}
          >
            <Play className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ADS TAB
// ============================================================================

export function AdsTab({ accountId, customerId, dateRange, campaignId, adGroupId }: AdsTabProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdStatus | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("clicks");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [syncing, setSyncing] = useState(false);

  async function fetchAds() {
    if (!campaignId) {
      setAds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url = `/api/campaigns/${campaignId}/ads?accountId=${accountId}&customerId=${customerId}&dateRange=${dateRange}`;
      if (adGroupId) {
        url += `&adGroupId=${adGroupId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch ads");
      const data = await res.json();
      setAds(data.ads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAds();
  }, [accountId, customerId, dateRange, campaignId, adGroupId]);

  async function handleSync() {
    setSyncing(true);
    await fetchAds();
    setSyncing(false);
  }

  // Filter and sort
  const filteredAds = useMemo(() => {
    let result = [...ads];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((ad) => {
        const headline = ad.headlines?.[0] || ad.name;
        return headline.toLowerCase().includes(query);
      });
    }

    if (statusFilter !== "ALL") {
      result = result.filter((ad) => ad.status === statusFilter);
    }

    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "name": aVal = (a.headlines?.[0] || a.name).toLowerCase(); bVal = (b.headlines?.[0] || b.name).toLowerCase(); break;
        case "status": aVal = a.status; bVal = b.status; break;
        case "clicks": aVal = a.clicks; bVal = b.clicks; break;
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
  }, [ads, searchQuery, statusFilter, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      total: ads.length,
      active: ads.filter((ad) => ad.status === "ENABLED").length,
      totalClicks: ads.reduce((sum, ad) => sum + ad.clicks, 0),
      totalImpressions: ads.reduce((sum, ad) => sum + ad.impressions, 0),
      totalConversions: ads.reduce((sum, ad) => sum + ad.conversions, 0),
      avgCtr: ads.length > 0 ? ads.reduce((sum, ad) => sum + ad.ctr, 0) / ads.length : 0,
    };
  }, [ads]);

  if (!campaignId) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <div className="text-slate-400 mb-1">Select a campaign first</div>
        <div className="text-sm text-slate-600">
          Navigate to a campaign to view its ads
        </div>
      </div>
    );
  }

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
        <div className="text-red-400 mb-2">Failed to load ads</div>
        <div className="text-sm text-slate-500 mb-4">{error}</div>
        <button
          onClick={fetchAds}
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
          icon={<FileText className="w-4 h-4 text-emerald-400" />}
          label="Total Ads"
          value={totals.total.toString()}
          subValue={`${totals.active} active`}
          color="bg-emerald-500/10"
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-amber-400" />}
          label="Total Clicks"
          value={totals.totalClicks.toLocaleString()}
          subValue={`${totals.totalImpressions.toLocaleString()} impressions`}
          color="bg-amber-500/10"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
          label="Avg CTR"
          value={formatCtr(totals.avgCtr)}
          color="bg-blue-500/10"
        />
        <StatCard
          icon={<DollarSign className="w-4 h-4 text-violet-400" />}
          label="Conversions"
          value={totals.totalConversions.toFixed(1)}
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
            placeholder="Search ads..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AdStatus | "ALL")}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
        >
          <option value="ALL">All Status</option>
          <option value="ENABLED">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="REMOVED">Removed</option>
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
          <option value="clicks-desc">Clicks (High to Low)</option>
          <option value="clicks-asc">Clicks (Low to High)</option>
          <option value="ctr-desc">CTR (High to Low)</option>
          <option value="conversions-desc">Conversions (High to Low)</option>
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

      {/* Ads Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="w-12" /> {/* Type badge space */}
          <div className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">Ad</div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
            <div className="w-12 text-right">Clicks</div>
            <div className="w-14 text-right">Impr.</div>
            <div className="w-12 text-right">CTR</div>
            <div className="w-12 text-right">Conv.</div>
          </div>
          <div className="w-12" />
        </div>

        {/* Ad Rows */}
        {filteredAds.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1">No ads found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "This campaign has no ads yet"}
            </div>
          </div>
        ) : (
          filteredAds.map((ad) => (
            <AdRow key={ad.id} ad={ad} />
          ))
        )}
      </div>
    </div>
  );
}
