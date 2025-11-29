"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Target,
  DollarSign,
  TrendingUp,
  Layers,
  ExternalLink,
  Trophy,
  MessageSquare,
} from "lucide-react";
import { isFeatureEnabled, formatCost, formatCtr } from "@magimanager/shared";
import type { Ad, AdStatus, AdType } from "@magimanager/shared";
import { scoreAdsInGroup, type ScoredAd } from "@/lib/campaign-manager/utils/ad-scoring";
import { AdScoreBadge, ScoreBreakdown } from "@/lib/campaign-manager/shared/ad-score-badge";

// ============================================================================
// TYPES
// ============================================================================

type SortField = "name" | "status" | "cost" | "clicks" | "conversions" | "ctr" | "score";
type SortDirection = "asc" | "desc";

// ============================================================================
// HELPERS
// ============================================================================

function getAdTypeLabel(type: AdType): string {
  switch (type) {
    case "RESPONSIVE_SEARCH_AD": return "RSA";
    case "RESPONSIVE_DISPLAY_AD": return "RDA";
    case "EXPANDED_TEXT_AD": return "ETA";
    case "CALL_AD": return "Call";
    case "IMAGE_AD": return "Image";
    case "VIDEO_AD": return "Video";
    default: return type;
  }
}

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
// EXPANDABLE AD ROW COMPONENT
// ============================================================================

interface AdRowProps {
  ad: ScoredAd;
  onViewDetails: (ad: ScoredAd) => void;
}

function AdRow({ ad, onViewDetails }: AdRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusBadge = getStatusBadge(ad.status);
  const canPause = isFeatureEnabled("ads.pause");

  const cpa = ad.conversions > 0 ? ad.cost / ad.conversions : 0;

  return (
    <div className="border-b border-slate-800">
      {/* Main Row */}
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand Toggle */}
        <button className="p-1 hover:bg-slate-700/50 rounded transition">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Score Badge */}
        <AdScoreBadge score={ad.score} showBreakdown size="sm" />

        {/* Ad Name & Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100 truncate">
              {ad.headlines?.[0] || ad.name}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
              {getAdTypeLabel(ad.type)}
            </span>
            {ad.score.isWinner && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <Trophy className="w-3 h-3" />
                Winner
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span>{ad.headlines?.length || 0} headlines</span>
            <span>{ad.descriptions?.length || 0} descriptions</span>
            {ad.finalUrls?.[0] && (
              <span className="truncate max-w-[200px]">{new URL(ad.finalUrls[0]).hostname}</span>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 text-right">
          <div className="w-16">
            <div className="text-sm font-medium text-slate-100">{formatCost(ad.cost)}</div>
            <div className="text-xs text-slate-500">Spend</div>
          </div>
          <div className="w-12">
            <div className="text-sm font-medium text-slate-100">{ad.clicks.toLocaleString()}</div>
            <div className="text-xs text-slate-500">Clicks</div>
          </div>
          <div className="w-12">
            <div className="text-sm font-medium text-slate-100">{ad.conversions.toFixed(1)}</div>
            <div className="text-xs text-slate-500">Conv.</div>
          </div>
          <div className="w-16">
            <div className="text-sm font-medium text-slate-100">{cpa > 0 ? formatCost(cpa) : "—"}</div>
            <div className="text-xs text-slate-500">CPA</div>
          </div>
          <div className="w-12">
            <div className="text-sm font-medium text-slate-100">{formatCtr(ad.ctr)}</div>
            <div className="text-xs text-slate-500">CTR</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onViewDetails(ad)}
            className="p-2 rounded-lg hover:bg-violet-500/10 text-violet-400 transition"
            title="View Details & AI Insights"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          {ad.status === "ENABLED" ? (
            <button
              disabled={!canPause}
              className={`p-2 rounded-lg transition ${
                canPause
                  ? "hover:bg-yellow-500/10 text-yellow-400"
                  : "text-slate-600 cursor-not-allowed"
              }`}
              title={canPause ? "Pause Ad" : "Write access required"}
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
              title={canPause ? "Enable Ad" : "Write access required"}
            >
              <Play className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-4 bg-slate-800/20 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-6">
            {/* Headlines */}
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                Headlines ({ad.headlines?.length || 0}/15)
              </h4>
              <div className="space-y-2">
                {ad.headlines?.length ? (
                  ad.headlines.map((headline, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="text-slate-600 font-mono text-xs w-5">{index + 1}.</span>
                      <span className="text-slate-200">{headline}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No headlines available</div>
                )}
              </div>
            </div>

            {/* Descriptions */}
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                Descriptions ({ad.descriptions?.length || 0}/4)
              </h4>
              <div className="space-y-2">
                {ad.descriptions?.length ? (
                  ad.descriptions.map((description, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="text-slate-600 font-mono text-xs w-5">{index + 1}.</span>
                      <span className="text-slate-200">{description}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No descriptions available</div>
                )}
              </div>
            </div>
          </div>

          {/* Final URLs and Paths */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Final URL
                </h4>
                {ad.finalUrls?.[0] ? (
                  <a
                    href={ad.finalUrls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition"
                  >
                    {ad.finalUrls[0]}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-sm text-slate-500">No URL</span>
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Display Path
                </h4>
                <span className="text-sm text-slate-200">
                  {ad.displayUrl || ad.finalUrls?.[0] ? new URL(ad.finalUrls?.[0] || "").hostname : "—"}
                  {ad.path1 && `/${ad.path1}`}
                  {ad.path2 && `/${ad.path2}`}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Performance Score
                </h4>
                <ScoreBreakdown score={ad.score} />
              </div>
            </div>
          </div>

          {/* View Full Details Button */}
          <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end">
            <button
              onClick={() => onViewDetails(ad)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition text-sm"
            >
              <MessageSquare className="w-4 h-4" />
              View Details & Ask AI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AD DETAIL PANEL (Slide-over)
// ============================================================================

interface AdDetailPanelProps {
  ad: ScoredAd | null;
  onClose: () => void;
}

function AdDetailPanel({ ad, onClose }: AdDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "performance" | "creative" | "ai">("overview");
  const [aiQuery, setAiQuery] = useState("");

  if (!ad) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-slate-900 border-l border-slate-700 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AdScoreBadge score={ad.score} size="md" />
              <div>
                <h2 className="text-lg font-semibold text-slate-100 truncate max-w-[300px]">
                  {ad.headlines?.[0] || ad.name}
                </h2>
                <p className="text-sm text-slate-500">
                  {getAdTypeLabel(ad.type)} • ID: {ad.id}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 border-b border-slate-700 -mb-4 -mx-4 px-4">
            {[
              { id: "overview" as const, label: "Overview" },
              { id: "performance" as const, label: "Performance" },
              { id: "creative" as const, label: "Creative" },
              { id: "ai" as const, label: "AI Insights" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-[1px] ${
                  activeTab === tab.id
                    ? "text-violet-400 border-violet-400"
                    : "text-slate-400 border-transparent hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Score Summary */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h3 className="text-sm font-medium text-slate-200 mb-3">Performance Score</h3>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-slate-100">{ad.score.overall}</div>
                  <div className="text-sm text-slate-400">
                    {ad.score.isWinner ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Trophy className="w-4 h-4" />
                        Top Performer in this Ad Group
                      </span>
                    ) : (
                      <span>out of 100</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">Spend</div>
                  <div className="text-lg font-semibold text-slate-100">{formatCost(ad.cost)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">Clicks</div>
                  <div className="text-lg font-semibold text-slate-100">{ad.clicks.toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">Conversions</div>
                  <div className="text-lg font-semibold text-slate-100">{ad.conversions.toFixed(1)}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "performance" && (
            <div className="space-y-6">
              <ScoreBreakdown score={ad.score} />
            </div>
          )}

          {activeTab === "creative" && (
            <div className="space-y-6">
              {/* Headlines */}
              <div>
                <h3 className="text-sm font-medium text-slate-200 mb-3">Headlines</h3>
                <div className="space-y-2">
                  {ad.headlines?.map((headline, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
                      <span className="text-slate-600 font-mono text-xs w-5">{index + 1}.</span>
                      <span className="text-slate-200 text-sm">{headline}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <h3 className="text-sm font-medium text-slate-200 mb-3">Descriptions</h3>
                <div className="space-y-2">
                  {ad.descriptions?.map((desc, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
                      <span className="text-slate-600 font-mono text-xs w-5">{index + 1}.</span>
                      <span className="text-slate-200 text-sm">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl p-4 border border-violet-500/20">
                <h3 className="text-sm font-medium text-slate-200 mb-2">AI Analysis Coming Soon</h3>
                <p className="text-xs text-slate-400">
                  Ask questions about this ad's performance, get improvement suggestions, and compare with other ads in the group.
                </p>
              </div>

              {/* Chat Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ask AI about this ad..."
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  disabled
                  className="px-4 py-2 bg-violet-500/50 text-violet-200 rounded-lg text-sm cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE CONTENT
// ============================================================================

function AdsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const campaignId = params.campaignId as string;
  const adGroupId = params.adGroupId as string;
  const dateRange = searchParams.get("dateRange") || "LAST_7_DAYS";
  const accountId = searchParams.get("accountId");

  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdStatus | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedAd, setSelectedAd] = useState<ScoredAd | null>(null);

  // Fetch ads
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
          `/api/campaigns/${campaignId}/ads?customerId=${customerId}&adGroupId=${adGroupId}&dateRange=${dateRange}`
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch ads");
        }

        const data = await res.json();
        setAds(data.ads || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ads");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [campaignId, adGroupId, dateRange, accountId]);

  // Score and filter/sort ads
  const scoredAds = useMemo(() => {
    return scoreAdsInGroup(ads);
  }, [ads]);

  const filteredAds = useMemo(() => {
    let result = [...scoredAds];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((ad) =>
        ad.name.toLowerCase().includes(query) ||
        ad.headlines?.some((h) => h.toLowerCase().includes(query)) ||
        ad.descriptions?.some((d) => d.toLowerCase().includes(query))
      );
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
        case "cost": aVal = a.cost; bVal = b.cost; break;
        case "clicks": aVal = a.clicks; bVal = b.clicks; break;
        case "conversions": aVal = a.conversions; bVal = b.conversions; break;
        case "ctr": aVal = a.ctr; bVal = b.ctr; break;
        case "score": aVal = a.score.overall; bVal = b.score.overall; break;
        default: return 0;
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [scoredAds, searchQuery, statusFilter, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalSpend = ads.reduce((sum, ad) => sum + ad.cost, 0);
    const totalConversions = ads.reduce((sum, ad) => sum + ad.conversions, 0);
    const winners = scoredAds.filter((ad) => ad.score.isWinner).length;
    return {
      total: ads.length,
      active: ads.filter((ad) => ad.status === "ENABLED").length,
      totalSpend,
      totalClicks: ads.reduce((sum, ad) => sum + ad.clicks, 0),
      totalConversions,
      avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      avgCtr: ads.length > 0 ? ads.reduce((sum, ad) => sum + ad.ctr, 0) / ads.length : 0,
      winners,
    };
  }, [ads, scoredAds]);

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
        <Link
          href={`/admin/campaigns/${campaignId}/ad-groups?dateRange=${dateRange}${accountId ? `&accountId=${accountId}` : ""}`}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition inline-block"
        >
          Back to Ad Groups
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
          subValue={`${totals.active} active ads`}
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
          icon={<Trophy className="w-4 h-4 text-amber-400" />}
          label="Winners"
          value={String(totals.winners)}
          subValue={`of ${totals.total} ads scored 80+`}
          color="bg-amber-500/10"
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
            placeholder="Search ads, headlines, descriptions..."
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
          <option value="score-desc">Score (High to Low)</option>
          <option value="score-asc">Score (Low to High)</option>
          <option value="cost-desc">Spend (High to Low)</option>
          <option value="conversions-desc">Conversions (High to Low)</option>
          <option value="ctr-desc">CTR (High to Low)</option>
          <option value="name-asc">Name (A-Z)</option>
        </select>

        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Ads Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="w-8" /> {/* Expand toggle space */}
          <div className="w-16 text-xs font-medium text-slate-400 uppercase tracking-wider">Score</div>
          <div className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">Ad</div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
            <div className="w-16 text-right">Spend</div>
            <div className="w-12 text-right">Clicks</div>
            <div className="w-12 text-right">Conv.</div>
            <div className="w-16 text-right">CPA</div>
            <div className="w-12 text-right">CTR</div>
          </div>
          <div className="w-20" /> {/* Actions space */}
        </div>

        {/* Ad Rows */}
        {filteredAds.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1">No ads found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "This ad group has no ads yet"}
            </div>
          </div>
        ) : (
          filteredAds.map((ad) => (
            <AdRow
              key={ad.id}
              ad={ad}
              onViewDetails={setSelectedAd}
            />
          ))
        )}
      </div>

      {/* Ad Detail Panel */}
      <AdDetailPanel
        ad={selectedAd}
        onClose={() => setSelectedAd(null)}
      />
    </div>
  );
}

// ============================================================================
// MAIN PAGE (with Suspense wrapper)
// ============================================================================

export default function AdsPage() {
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
      <AdsPageContent />
    </Suspense>
  );
}
