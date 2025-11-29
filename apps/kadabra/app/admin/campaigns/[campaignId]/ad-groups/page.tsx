"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  ChevronRight,
  Play,
  Pause,
  Target,
  DollarSign,
  TrendingUp,
  Layers,
  FileText,
  Key,
} from "lucide-react";
import { isFeatureEnabled, formatCost, formatCtr } from "@magimanager/shared";
import type { AdGroup, AdGroupStatus, AdGroupType } from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

type SortField = "name" | "status" | "cost" | "clicks" | "conversions" | "ctr";
type SortDirection = "asc" | "desc";

// ============================================================================
// HELPERS
// ============================================================================

function getAdGroupTypeLabel(type: AdGroupType): string {
  switch (type) {
    case "SEARCH_STANDARD": return "Search";
    case "SEARCH_DYNAMIC_ADS": return "Dynamic";
    case "DISPLAY_STANDARD": return "Display";
    case "SHOPPING_PRODUCT_ADS": return "Shopping";
    case "VIDEO_TRUE_VIEW_IN_STREAM": return "Video";
    default: return type;
  }
}

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
// TAB NAVIGATION
// ============================================================================

function TabNavigation({ campaignId, activeTab, dateRange }: {
  campaignId: string;
  activeTab: "ad-groups" | "ads" | "keywords";
  dateRange: string;
}) {
  const tabs = [
    { id: "ad-groups" as const, label: "Ad Groups", href: `/admin/campaigns/${campaignId}/ad-groups?dateRange=${dateRange}` },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-slate-700 mb-4">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-[1px] ${
            activeTab === tab.id
              ? "text-violet-400 border-violet-400"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

// ============================================================================
// AD GROUP ROW COMPONENT
// ============================================================================

interface AdGroupRowProps {
  adGroup: AdGroup;
  campaignId: string;
  dateRange: string;
}

function AdGroupRow({ adGroup, campaignId, dateRange }: AdGroupRowProps) {
  const statusBadge = getStatusBadge(adGroup.status);
  const canPause = isFeatureEnabled("campaigns.pause");

  const cpa = adGroup.conversions > 0 ? adGroup.cost / adGroup.conversions : 0;
  const roas = adGroup.cost > 0 ? (adGroup.conversionValue / adGroup.cost) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/30 group">
      {/* Ad Group Name & Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/campaigns/${campaignId}/ad-groups/${adGroup.id}/ads?dateRange=${dateRange}`}
            className="text-sm font-medium text-slate-100 hover:text-violet-400 transition truncate"
          >
            {adGroup.name}
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
            {getAdGroupTypeLabel(adGroup.type)}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
          {adGroup.cpcBidMicros && (
            <span>Max CPC: {formatCost(adGroup.cpcBidMicros)}</span>
          )}
          <span>{adGroup.adsCount || 0} ads</span>
          <span>{adGroup.keywordsCount || 0} keywords</span>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex items-center gap-1">
        <Link
          href={`/admin/campaigns/${campaignId}/ad-groups/${adGroup.id}/ads?dateRange=${dateRange}`}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-violet-400 transition"
        >
          <FileText className="w-3 h-3" />
          Ads
        </Link>
        <Link
          href={`/admin/campaigns/${campaignId}/ad-groups/${adGroup.id}/keywords?dateRange=${dateRange}`}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-violet-400 transition"
        >
          <Key className="w-3 h-3" />
          Keywords
        </Link>
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
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        {adGroup.status === "ENABLED" ? (
          <button
            disabled={!canPause}
            className={`p-2 rounded-lg transition ${
              canPause
                ? "hover:bg-yellow-500/10 text-yellow-400"
                : "text-slate-600 cursor-not-allowed"
            }`}
            title={canPause ? "Pause Ad Group" : "Write access required"}
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
// MAIN PAGE CONTENT
// ============================================================================

function AdGroupsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const campaignId = params.campaignId as string;
  const dateRange = searchParams.get("dateRange") || "LAST_7_DAYS";
  const accountId = searchParams.get("accountId");

  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [campaignName, setCampaignName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdGroupStatus | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [syncing, setSyncing] = useState(false);

  // Fetch ad groups
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // First, get the account info from the accountId or fetch it
        let customerId = "";

        if (accountId) {
          // Fetch account to get customerId
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
          // Try to get from URL or use a default path
          throw new Error("Account ID required. Please select an account.");
        }

        // Fetch ad groups for this campaign
        const res = await fetch(
          `/api/campaigns/${campaignId}/ad-groups?accountId=${accountId}&customerId=${customerId}&dateRange=${dateRange}`
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch ad groups");
        }

        const data = await res.json();
        setAdGroups(data.adGroups || []);
        setCampaignName(data.campaignName || `Campaign ${campaignId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ad groups");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [campaignId, dateRange, accountId]);

  // Filter and sort ad groups
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
        case "ctr": aVal = a.ctr; bVal = b.ctr; break;
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
      avgCtr: adGroups.length > 0 ? adGroups.reduce((sum, ag) => sum + ag.ctr, 0) / adGroups.length : 0,
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
        <Link
          href={`/admin/campaigns?dateRange=${dateRange}${accountId ? `&accountId=${accountId}` : ""}`}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition inline-block"
        >
          Back to Campaigns
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
          subValue={`${formatCtr(totals.avgCtr)} avg CTR`}
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
          <option value="ctr-desc">CTR (High to Low)</option>
          <option value="name-asc">Name (A-Z)</option>
        </select>

        <button
          onClick={() => window.location.reload()}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Ad Groups Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">Ad Group</div>
          <div className="w-24" /> {/* Quick links space */}
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

        {/* Ad Group Rows */}
        {filteredAdGroups.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1">No ad groups found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "This campaign has no ad groups yet"}
            </div>
          </div>
        ) : (
          filteredAdGroups.map((adGroup) => (
            <AdGroupRow
              key={adGroup.id}
              adGroup={adGroup}
              campaignId={campaignId}
              dateRange={dateRange}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE (with Suspense wrapper)
// ============================================================================

export default function AdGroupsPage() {
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
      <AdGroupsPageContent />
    </Suspense>
  );
}
