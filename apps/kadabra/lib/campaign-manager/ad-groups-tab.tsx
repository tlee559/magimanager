"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCw,
  ChevronRight,
  Play,
  Pause,
  TrendingUp,
  Target,
  DollarSign,
  Layers,
} from "lucide-react";
import type { AdGroup, AdGroupStatus } from "@magimanager/shared";
import { isFeatureEnabled, formatCost, formatCtr } from "@magimanager/shared";
import type { DateRange } from "./index";

// ============================================================================
// TYPES
// ============================================================================

type SortField = "name" | "status" | "cost" | "clicks" | "conversions";
type SortDirection = "asc" | "desc";

interface AdGroupsTabProps {
  accountId: string;
  customerId: string;
  dateRange: DateRange;
  campaignId: string | null;
  onAdGroupSelect: (adGroupId: string, adGroupName: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function getStatusBadge(status: AdGroupStatus): { color: string; label: string } {
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
// AD GROUP ROW COMPONENT
// ============================================================================

interface AdGroupRowProps {
  adGroup: AdGroup;
  onSelect: (id: string, name: string) => void;
}

function AdGroupRow({ adGroup, onSelect }: AdGroupRowProps) {
  const statusBadge = getStatusBadge(adGroup.status);
  const canPause = isFeatureEnabled("campaigns.pause");

  const cpa = adGroup.conversions > 0 ? adGroup.cost / adGroup.conversions : 0;
  const roas = adGroup.cost > 0 ? (adGroup.conversionValue / adGroup.cost) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/30">
      {/* Ad Group Name - Clickable */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onSelect(adGroup.id, adGroup.name)}
          className="text-left group"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100 group-hover:text-violet-400 transition truncate">
              {adGroup.name}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition" />
            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
        </button>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>{adGroup.adsCount ?? 0} ads</span>
          <span>{adGroup.keywordsCount ?? 0} keywords</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-right">
        <div className="w-16">
          <div className="text-sm font-medium text-slate-100">{formatCost(adGroup.cost)}</div>
          <div className="text-xs text-slate-500">Spend</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{adGroup.clicks.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Clicks</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{adGroup.conversions.toFixed(1)}</div>
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
          <div className="text-sm font-medium text-slate-100">{formatCtr(adGroup.ctr)}</div>
          <div className="text-xs text-slate-500">CTR</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {adGroup.status === "ENABLED" ? (
          <button
            disabled={!canPause}
            className={`p-2 rounded-lg transition ${
              canPause ? "hover:bg-yellow-500/10 text-yellow-400" : "text-slate-600 cursor-not-allowed"
            }`}
            title={canPause ? "Pause Ad Group" : "Write access required"}
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            disabled={!canPause}
            className={`p-2 rounded-lg transition ${
              canPause ? "hover:bg-emerald-500/10 text-emerald-400" : "text-slate-600 cursor-not-allowed"
            }`}
            title={canPause ? "Enable Ad Group" : "Write access required"}
          >
            <Play className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN AD GROUPS TAB
// ============================================================================

export function AdGroupsTab({ accountId, customerId, dateRange, campaignId, onAdGroupSelect }: AdGroupsTabProps) {
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdGroupStatus | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [syncing, setSyncing] = useState(false);

  async function fetchAdGroups() {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/campaigns/${campaignId || "all"}/ad-groups?accountId=${accountId}&customerId=${customerId}&dateRange=${dateRange}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch ad groups");
      const data = await res.json();
      setAdGroups(data.adGroups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ad groups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdGroups();
  }, [accountId, customerId, dateRange, campaignId]);

  async function handleSync() {
    setSyncing(true);
    await fetchAdGroups();
    setSyncing(false);
  }

  // Filter and sort
  const filteredAdGroups = useMemo(() => {
    let result = [...adGroups];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((ag) => ag.name.toLowerCase().includes(query));
    }

    if (statusFilter !== "ALL") {
      result = result.filter((ag) => ag.status === statusFilter);
    }

    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "name": aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case "status": aVal = a.status; bVal = b.status; break;
        case "cost": aVal = a.cost; bVal = b.cost; break;
        case "clicks": aVal = a.clicks; bVal = b.clicks; break;
        case "conversions": aVal = a.conversions; bVal = b.conversions; break;
        default: return 0;
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [adGroups, searchQuery, statusFilter, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalSpend = adGroups.reduce((sum, ag) => sum + ag.cost, 0);
    const totalConversions = adGroups.reduce((sum, ag) => sum + ag.conversions, 0);
    const totalConversionValue = adGroups.reduce((sum, ag) => sum + ag.conversionValue, 0);
    return {
      total: adGroups.length,
      active: adGroups.filter((ag) => ag.status === "ENABLED").length,
      totalSpend,
      totalClicks: adGroups.reduce((sum, ag) => sum + ag.clicks, 0),
      totalConversions,
      avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      avgRoas: totalSpend > 0 ? (totalConversionValue / totalSpend) * 100 : 0,
    };
  }, [adGroups]);

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
        <div className="text-red-400 mb-2">Failed to load ad groups</div>
        <div className="text-sm text-slate-500 mb-4">{error}</div>
        <button
          onClick={fetchAdGroups}
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
          subValue={`${totals.active} active ad groups`}
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
          color="bg-blue-500/10"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-violet-400" />}
          label="ROAS"
          value={totals.avgRoas > 0 ? `${totals.avgRoas.toFixed(0)}%` : "—"}
          subValue={`${totals.total} ad groups total`}
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
            placeholder="Search ad groups..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AdGroupStatus | "ALL")}
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
          <option value="cost-desc">Spend (High to Low)</option>
          <option value="cost-asc">Spend (Low to High)</option>
          <option value="clicks-desc">Clicks (High to Low)</option>
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

      {/* Ad Groups Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">Ad Group</div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
            <div className="w-16 text-right">Spend</div>
            <div className="w-12 text-right">Clicks</div>
            <div className="w-12 text-right">Conv.</div>
            <div className="w-16 text-right">CPA</div>
            <div className="w-14 text-right">ROAS</div>
            <div className="w-12 text-right">CTR</div>
          </div>
          <div className="w-12" />
        </div>

        {/* Ad Group Rows */}
        {filteredAdGroups.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1">No ad groups found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : campaignId
                ? "This campaign has no ad groups yet"
                : "Select a campaign to view ad groups"}
            </div>
          </div>
        ) : (
          filteredAdGroups.map((adGroup) => (
            <AdGroupRow
              key={adGroup.id}
              adGroup={adGroup}
              onSelect={onAdGroupSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
