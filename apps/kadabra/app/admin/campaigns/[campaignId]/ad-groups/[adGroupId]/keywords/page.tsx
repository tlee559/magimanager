"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Play,
  Pause,
  Target,
  DollarSign,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";
import { isFeatureEnabled, formatCost, formatCtr } from "@magimanager/shared";
import type { Keyword, KeywordStatus, KeywordMatchType } from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

type SortField = "text" | "status" | "cost" | "clicks" | "conversions" | "ctr" | "qualityScore";
type SortDirection = "asc" | "desc";

// ============================================================================
// HELPERS
// ============================================================================

function getMatchTypeLabel(matchType: KeywordMatchType): { label: string; color: string } {
  switch (matchType) {
    case "EXACT":
      return { label: "[exact]", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    case "PHRASE":
      return { label: '"phrase"', color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
    case "BROAD":
      return { label: "broad", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
    default:
      return { label: matchType, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
  }
}

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

function getQualityScoreColor(score: number | undefined): string {
  if (!score) return "text-slate-500";
  if (score >= 7) return "text-emerald-400";
  if (score >= 5) return "text-yellow-400";
  return "text-red-400";
}

function getQualityRatingIcon(rating: "ABOVE_AVERAGE" | "AVERAGE" | "BELOW_AVERAGE" | undefined) {
  switch (rating) {
    case "ABOVE_AVERAGE":
      return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    case "AVERAGE":
      return <Minus className="w-3 h-3 text-yellow-400" />;
    case "BELOW_AVERAGE":
      return <TrendingDown className="w-3 h-3 text-red-400" />;
    default:
      return <Minus className="w-3 h-3 text-slate-500" />;
  }
}

function getQualityRatingLabel(rating: "ABOVE_AVERAGE" | "AVERAGE" | "BELOW_AVERAGE" | undefined): string {
  switch (rating) {
    case "ABOVE_AVERAGE": return "Above avg";
    case "AVERAGE": return "Average";
    case "BELOW_AVERAGE": return "Below avg";
    default: return "—";
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
// QUALITY SCORE BREAKDOWN COMPONENT
// ============================================================================

interface QualityScoreBreakdownProps {
  keyword: Keyword;
}

function QualityScoreBreakdown({ keyword }: QualityScoreBreakdownProps) {
  const components = [
    { label: "Expected CTR", value: keyword.expectedCtr },
    { label: "Ad Relevance", value: keyword.adRelevance },
    { label: "Landing Page", value: keyword.landingPageExperience },
  ];

  return (
    <div className="space-y-2 p-3 min-w-[180px]">
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-sm font-medium text-slate-200">Quality Score</span>
        <span className={`text-lg font-bold ${getQualityScoreColor(keyword.qualityScore)}`}>
          {keyword.qualityScore || "—"}/10
        </span>
      </div>

      {components.map((comp) => (
        <div key={comp.label} className="flex items-center justify-between text-xs">
          <span className="text-slate-400">{comp.label}</span>
          <div className="flex items-center gap-1">
            {getQualityRatingIcon(comp.value)}
            <span className="text-slate-300">{getQualityRatingLabel(comp.value)}</span>
          </div>
        </div>
      ))}
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
  const [showQSBreakdown, setShowQSBreakdown] = useState(false);
  const statusBadge = getStatusBadge(keyword.status);
  const matchType = getMatchTypeLabel(keyword.matchType);
  const canPause = isFeatureEnabled("keywords.pause");

  const cpa = keyword.conversions > 0 ? keyword.cost / keyword.conversions : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/30 group">
      {/* Keyword Text & Match Type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded border ${matchType.color} font-mono`}>
            {matchType.label}
          </span>
          <span className="text-sm font-medium text-slate-100 truncate">
            {keyword.text}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          {keyword.cpcBidMicros && (
            <span>Max CPC: {formatCost(keyword.cpcBidMicros)}</span>
          )}
          {keyword.finalUrl && (
            <span className="truncate max-w-[200px]">{keyword.finalUrl}</span>
          )}
        </div>
      </div>

      {/* Quality Score with Breakdown */}
      <div className="relative">
        <button
          onMouseEnter={() => setShowQSBreakdown(true)}
          onMouseLeave={() => setShowQSBreakdown(false)}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/50 transition"
        >
          <span className={`text-sm font-bold ${getQualityScoreColor(keyword.qualityScore)}`}>
            {keyword.qualityScore || "—"}
          </span>
          <Info className="w-3 h-3 text-slate-500" />
        </button>

        {/* QS Breakdown Tooltip */}
        {showQSBreakdown && (
          <div className="absolute bottom-full right-0 mb-2 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
              <QualityScoreBreakdown keyword={keyword} />
            </div>
          </div>
        )}
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
        <div className="w-12">
          <div className="text-sm font-medium text-slate-100">{formatCtr(keyword.ctr)}</div>
          <div className="text-xs text-slate-500">CTR</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        {keyword.status === "ENABLED" ? (
          <button
            disabled={!canPause}
            className={`p-2 rounded-lg transition ${
              canPause
                ? "hover:bg-yellow-500/10 text-yellow-400"
                : "text-slate-600 cursor-not-allowed"
            }`}
            title={canPause ? "Pause Keyword" : "Write access required"}
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
// MAIN PAGE CONTENT
// ============================================================================

function KeywordsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const campaignId = params.campaignId as string;
  const adGroupId = params.adGroupId as string;
  const dateRange = searchParams.get("dateRange") || "LAST_7_DAYS";
  const accountId = searchParams.get("accountId");

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<KeywordStatus | "ALL">("ALL");
  const [matchTypeFilter, setMatchTypeFilter] = useState<KeywordMatchType | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Fetch keywords
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        let customerId = "";

        if (accountId) {
          const accountRes = await fetch(`/api/accounts/my-accounts`);
          if (accountRes.ok) {
            const accountData = await accountRes.json();
            const account = accountData.accounts?.find((a: any) => a.id === accountId);
            if (account?.googleCid) {
              customerId = account.googleCid.replace(/-/g, "");
            }
          }
        }

        if (!customerId) {
          throw new Error("Account ID required. Please select an account.");
        }

        const res = await fetch(
          `/api/campaigns/${campaignId}/keywords?customerId=${customerId}&adGroupId=${adGroupId}&dateRange=${dateRange}`
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch keywords");
        }

        const data = await res.json();
        setKeywords(data.keywords || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load keywords");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [campaignId, adGroupId, dateRange, accountId]);

  // Filter and sort keywords
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
        case "ctr": aVal = a.ctr; bVal = b.ctr; break;
        case "qualityScore": aVal = a.qualityScore || 0; bVal = b.qualityScore || 0; break;
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
    const withQS = keywords.filter((kw) => kw.qualityScore);
    const avgQS = withQS.length > 0
      ? withQS.reduce((sum, kw) => sum + (kw.qualityScore || 0), 0) / withQS.length
      : 0;
    return {
      total: keywords.length,
      active: keywords.filter((kw) => kw.status === "ENABLED").length,
      totalSpend,
      totalClicks: keywords.reduce((sum, kw) => sum + kw.clicks, 0),
      totalConversions,
      avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      avgCtr: keywords.length > 0 ? keywords.reduce((sum, kw) => sum + kw.ctr, 0) / keywords.length : 0,
      avgQS,
    };
  }, [keywords]);

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
        <Link
          href={`/admin/campaigns/${campaignId}/ad-groups/${adGroupId}/ads?dateRange=${dateRange}${accountId ? `&accountId=${accountId}` : ""}`}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition inline-block"
        >
          Back to Ads
        </Link>
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
          subValue={`${formatCtr(totals.avgCtr)} avg CTR`}
          color="bg-blue-500/10"
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-violet-400" />}
          label="Avg Quality Score"
          value={totals.avgQS > 0 ? totals.avgQS.toFixed(1) : "—"}
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
          <option value="ctr-desc">CTR (High to Low)</option>
          <option value="text-asc">Keyword (A-Z)</option>
        </select>

        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Keywords Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">Keyword</div>
          <div className="w-16 text-xs font-medium text-slate-400 uppercase tracking-wider text-center">QS</div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
            <div className="w-16 text-right">Spend</div>
            <div className="w-12 text-right">Clicks</div>
            <div className="w-12 text-right">Conv.</div>
            <div className="w-16 text-right">CPA</div>
            <div className="w-12 text-right">CTR</div>
          </div>
          <div className="w-12" /> {/* Actions space */}
        </div>

        {/* Keyword Rows */}
        {filteredKeywords.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1">No keywords found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== "ALL" || matchTypeFilter !== "ALL"
                ? "Try adjusting your filters"
                : "This ad group has no keywords yet"}
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

// ============================================================================
// MAIN PAGE (with Suspense wrapper)
// ============================================================================

export default function KeywordsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
      </div>
    }>
      <KeywordsPageContent />
    </Suspense>
  );
}
