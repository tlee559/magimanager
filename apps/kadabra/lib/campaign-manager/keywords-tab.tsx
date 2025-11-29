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
  Key,
} from "lucide-react";
import type { Keyword, KeywordStatus, KeywordMatchType } from "@magimanager/shared";
import { isFeatureEnabled, formatCost, formatCtr } from "@magimanager/shared";
import type { DateRange } from "./index";

// ============================================================================
// TYPES
// ============================================================================

type SortField = "text" | "status" | "cost" | "clicks" | "conversions" | "qualityScore";
type SortDirection = "asc" | "desc";

interface KeywordsTabProps {
  accountId: string;
  customerId: string;
  dateRange: DateRange;
  campaignId: string | null;
  adGroupId: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function getStatusBadge(status: KeywordStatus): { color: string; label: string } {
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

function getMatchTypeBadge(matchType: KeywordMatchType): { color: string; label: string } {
  switch (matchType) {
    case "EXACT":
      return { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "[Exact]" };
    case "PHRASE":
      return { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: '"Phrase"' };
    case "BROAD":
      return { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Broad" };
    default:
      return { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: matchType };
  }
}

function getQualityScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-slate-500";
  if (score >= 7) return "text-emerald-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
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
// KEYWORD ROW COMPONENT
// ============================================================================

interface KeywordRowProps {
  keyword: Keyword;
}

function KeywordRow({ keyword }: KeywordRowProps) {
  const statusBadge = getStatusBadge(keyword.status);
  const matchBadge = getMatchTypeBadge(keyword.matchType);
  const canPause = isFeatureEnabled("keywords.pause");

  const cpa = keyword.conversions > 0 ? keyword.cost / keyword.conversions : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/30">
      {/* Match Type Badge */}
      <div className={`px-2 py-1 rounded text-xs font-medium border ${matchBadge.color}`}>
        {matchBadge.label}
      </div>

      {/* Keyword Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-100 truncate">
            {keyword.text}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>
        {keyword.finalUrl && (
          <div className="text-xs text-slate-500 truncate mt-1">
            {keyword.finalUrl}
          </div>
        )}
      </div>

      {/* Quality Score */}
      <div className="w-10 text-center">
        <div className={`text-sm font-bold ${getQualityScoreColor(keyword.qualityScore)}`}>
          {keyword.qualityScore ?? "—"}
        </div>
        <div className="text-xs text-slate-500">QS</div>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-right">
        <div className="w-16">
          <div className="text-sm font-medium text-slate-100">{formatCost(keyword.cost)}</div>
          <div className="text-xs text-slate-500">Spend</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{keyword.clicks.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Clicks</div>
        </div>
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{keyword.conversions.toFixed(1)}</div>
          <div className="text-xs text-slate-500">Conv.</div>
        </div>
        <div className="w-16">
          <div className="text-sm font-medium text-slate-100">{cpa > 0 ? formatCost(cpa) : "—"}</div>
          <div className="text-xs text-slate-500">CPA</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {keyword.status === "ENABLED" ? (
          <button
            disabled={!canPause}
            className={`p-2 rounded-lg transition ${
              canPause ? "hover:bg-yellow-500/10 text-yellow-400" : "text-slate-600 cursor-not-allowed"
            }`}
            title={canPause ? "Pause Keyword" : "Write access required"}
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            disabled={!canPause}
            className={`p-2 rounded-lg transition ${
              canPause ? "hover:bg-emerald-500/10 text-emerald-400" : "text-slate-600 cursor-not-allowed"
            }`}
            title={canPause ? "Enable Keyword" : "Write access required"}
          >
            <Play className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN KEYWORDS TAB
// ============================================================================

export function KeywordsTab({ accountId, customerId, dateRange, campaignId, adGroupId }: KeywordsTabProps) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<KeywordStatus | "ALL">("ALL");
  const [matchTypeFilter, setMatchTypeFilter] = useState<KeywordMatchType | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [syncing, setSyncing] = useState(false);

  async function fetchKeywords() {
    if (!campaignId) {
      setKeywords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url = `/api/campaigns/${campaignId}/keywords?accountId=${accountId}&customerId=${customerId}&dateRange=${dateRange}`;
      if (adGroupId) {
        url += `&adGroupId=${adGroupId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch keywords");
      const data = await res.json();
      setKeywords(data.keywords || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keywords");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeywords();
  }, [accountId, customerId, dateRange, campaignId, adGroupId]);

  async function handleSync() {
    setSyncing(true);
    await fetchKeywords();
    setSyncing(false);
  }

  // Filter and sort
  const filteredKeywords = useMemo(() => {
    let result = [...keywords];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((kw) => kw.text.toLowerCase().includes(query));
    }

    if (statusFilter !== "ALL") {
      result = result.filter((kw) => kw.status === statusFilter);
    }

    if (matchTypeFilter !== "ALL") {
      result = result.filter((kw) => kw.matchType === matchTypeFilter);
    }

    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "text": aVal = a.text.toLowerCase(); bVal = b.text.toLowerCase(); break;
        case "status": aVal = a.status; bVal = b.status; break;
        case "cost": aVal = a.cost; bVal = b.cost; break;
        case "clicks": aVal = a.clicks; bVal = b.clicks; break;
        case "conversions": aVal = a.conversions; bVal = b.conversions; break;
        case "qualityScore": aVal = a.qualityScore ?? 0; bVal = b.qualityScore ?? 0; break;
        default: return 0;
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [keywords, searchQuery, statusFilter, matchTypeFilter, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalSpend = keywords.reduce((sum, kw) => sum + kw.cost, 0);
    const totalConversions = keywords.reduce((sum, kw) => sum + kw.conversions, 0);
    const keywordsWithQs = keywords.filter((kw) => kw.qualityScore !== null);
    return {
      total: keywords.length,
      active: keywords.filter((kw) => kw.status === "ENABLED").length,
      totalSpend,
      totalClicks: keywords.reduce((sum, kw) => sum + kw.clicks, 0),
      totalConversions,
      avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      avgQualityScore: keywordsWithQs.length > 0
        ? keywordsWithQs.reduce((sum, kw) => sum + (kw.qualityScore ?? 0), 0) / keywordsWithQs.length
        : 0,
    };
  }, [keywords]);

  if (!campaignId) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
        <Key className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <div className="text-slate-400 mb-1">Select a campaign first</div>
        <div className="text-sm text-slate-600">
          Navigate to a campaign to view its keywords
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
        <div className="text-red-400 mb-2">Failed to load keywords</div>
        <div className="text-sm text-slate-500 mb-4">{error}</div>
        <button
          onClick={fetchKeywords}
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
          subValue={`${totals.active} active keywords`}
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
          label="Avg Quality Score"
          value={totals.avgQualityScore > 0 ? totals.avgQualityScore.toFixed(1) : "—"}
          subValue={`${totals.total} keywords total`}
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
            placeholder="Search keywords..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as KeywordStatus | "ALL")}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
        >
          <option value="ALL">All Status</option>
          <option value="ENABLED">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="REMOVED">Removed</option>
        </select>

        <select
          value={matchTypeFilter}
          onChange={(e) => setMatchTypeFilter(e.target.value as KeywordMatchType | "ALL")}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
        >
          <option value="ALL">All Match Types</option>
          <option value="EXACT">Exact</option>
          <option value="PHRASE">Phrase</option>
          <option value="BROAD">Broad</option>
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
          <option value="qualityScore-desc">Quality Score (High to Low)</option>
          <option value="text-asc">Keyword (A-Z)</option>
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

      {/* Keywords Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="w-16" /> {/* Match type badge space */}
          <div className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">Keyword</div>
          <div className="w-10 text-xs font-medium text-slate-400 uppercase tracking-wider text-center">QS</div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
            <div className="w-16 text-right">Spend</div>
            <div className="w-12 text-right">Clicks</div>
            <div className="w-12 text-right">Conv.</div>
            <div className="w-16 text-right">CPA</div>
          </div>
          <div className="w-12" />
        </div>

        {/* Keyword Rows */}
        {filteredKeywords.length === 0 ? (
          <div className="p-12 text-center">
            <Key className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1">No keywords found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== "ALL" || matchTypeFilter !== "ALL"
                ? "Try adjusting your filters"
                : "This campaign has no keywords yet"}
            </div>
          </div>
        ) : (
          filteredKeywords.map((keyword) => (
            <KeywordRow key={keyword.id} keyword={keyword} />
          ))
        )}
      </div>
    </div>
  );
}
