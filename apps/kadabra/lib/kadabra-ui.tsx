"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Briefcase,
  Bell,
  PlusCircle,
  LogOut,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Layers,
  Zap,
  Sparkles,
  Eye,
  Lock,
  ListChecks,
  Wrench,
  Target,
  Play,
  Pause,
  Link2,
  Unlink,
  BarChart3,
  ImageIcon,
} from "lucide-react";
import { ProfileModal } from "@magimanager/features";
import { formatCid } from "@magimanager/shared";
import type { Campaign, AdGroup, Ad } from "@magimanager/shared";
import { scoreAdsInGroup, getTierColors, type ScoredAd, type AdScore } from "./campaign-manager/utils/ad-scoring";
import { AdDetailPanel } from "./campaign-manager/ad-detail-panel";
import {
  ChatWindowBar,
  createChatWindow,
  findExistingWindow,
  bringWindowToFront,
  addMessage,
} from "./chat-window-bar";
import type { ChatWindow } from "./chat-types";
import { CampaignPlannerView } from "./campaign-planner-view";
import { VideoClipperView } from "./video-clipper-view";
import { AdsImageCreatorView } from "./ads-image-creator-view";
import { ABRA_URL, APP_VERSION, BUILD_SHA } from "./constants";
import toast from "react-hot-toast";

// ============================================================================
// TYPES
// ============================================================================

type AdAccount = {
  id: string;
  internalId: number;
  googleCid: string | null;
  status: string;
  warmupTargetSpend: number;
  currentSpendTotal: number;
  todaySpend: number;
  adsCount: number;
  campaignsCount: number;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  handoffStatus: string;
  handoffDate: string | null;
  handoffNotes: string | null;
  createdAt: string;
  identityProfile?: {
    id: string;
    fullName: string;
    geo: string;
    gologinProfile?: {
      id: string;
      profileId: string | null;
      profileName: string | null;
      status: string;
    } | null;
  } | null;
  connection?: {
    id: string;
    googleEmail: string;
    status: string;
  } | null;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  entityId: string | null;
  entityType: string | null;
};

type AccountRequest = {
  id: string;
  type: "CLAIM_EXISTING" | "CREATE_NEW";
  status: string;
  justification: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getHealthColor(health: string): string {
  switch (health) {
    case "active":
      return "text-emerald-400";
    case "limited":
      return "text-yellow-400";
    case "suspended":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

function getHealthBg(health: string): string {
  switch (health) {
    case "active":
      return "bg-emerald-500/10 border-emerald-500/20";
    case "limited":
      return "bg-yellow-500/10 border-yellow-500/20";
    case "suspended":
      return "bg-red-500/10 border-red-500/20";
    default:
      return "bg-slate-500/10 border-slate-500/20";
  }
}

// ============================================================================
// SCORE BADGE WITH TOOLTIP
// ============================================================================

function ScoreBadge({ score }: { score: AdScore }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tierColors = getTierColors(score.tier);

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "gold": return "🏆";
      case "silver": return "🥈";
      case "bronze": return "🥉";
      default: return "⚪";
    }
  };

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-help ${tierColors.bg} ${tierColors.text} border ${tierColors.border}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span>{score.overall}</span>
        <span>{getTierIcon(score.tier)}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-slate-900 border border-slate-700 shadow-xl text-xs pointer-events-none">
          <div className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
            📊 Ad Performance Score
          </div>

          <p className="text-slate-400 mb-3 text-[11px] leading-relaxed">
            Scored 0-100 based on how this ad performs compared to others in the same ad group.
          </p>

          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">CTR (25%)</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(score.ctrScore / 25) * 100}%` }} />
                </div>
                <span className="text-slate-300 w-6 text-right">{score.ctrScore}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Conversions (35%)</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(score.conversionScore / 35) * 100}%` }} />
                </div>
                <span className="text-slate-300 w-6 text-right">{score.conversionScore}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Cost Efficiency (25%)</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400 rounded-full" style={{ width: `${(score.costScore / 25) * 100}%` }} />
                </div>
                <span className="text-slate-300 w-6 text-right">{score.costScore}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Reach (15%)</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(score.impressionScore / 15) * 100}%` }} />
                </div>
                <span className="text-slate-300 w-6 text-right">{score.impressionScore}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-2 space-y-1 text-[10px]">
            <div className="flex items-center gap-1.5"><span>🏆</span><span className="text-amber-400">80-100</span><span className="text-slate-500">Winner - Scale!</span></div>
            <div className="flex items-center gap-1.5"><span>🥈</span><span className="text-slate-300">60-79</span><span className="text-slate-500">Good - Minor tweaks</span></div>
            <div className="flex items-center gap-1.5"><span>🥉</span><span className="text-orange-400">40-59</span><span className="text-slate-500">Needs Work</span></div>
            <div className="flex items-center gap-1.5"><span>⚪</span><span className="text-slate-400">0-39</span><span className="text-slate-500">Failing - Pause/Rewrite</span></div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-emerald-400">
            Goal: Get all ads to 80+ for optimal performance
          </div>

          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAGIMANAGER LOGO (Emerald Green Gradient)
// ============================================================================

function MagimanagerLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="12" fill="url(#magimanagerGradient)" />
      <path
        d="M25 70V30H35L50 55L65 30H75V70H65V45L50 70L35 45V70H25Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="magimanagerGradient"
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ============================================================================
// DASHBOARD VIEW
// ============================================================================

function DashboardView({
  accounts,
  loading,
  onAccountClick,
  onChatAboutAccount,
  onLaunchGoLogin,
}: {
  accounts: AdAccount[];
  loading: boolean;
  onAccountClick?: (accountId: string) => void;
  onChatAboutAccount?: (account: AdAccount) => void;
  onLaunchGoLogin?: (account: AdAccount) => void;
}) {
  const [showAllAccounts, setShowAllAccounts] = useState(true);

  const activeAccounts = accounts.filter((a) => a.accountHealth === "active");
  const connectedAccounts = accounts.filter((a) => a.connection?.status === "active");
  const totalSpend = accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0);
  const todaySpend = accounts.reduce((sum, a) => sum + a.todaySpend, 0);
  const suspendedCount = accounts.filter((a) => a.accountHealth === "suspended").length;
  const totalCampaigns = accounts.reduce((sum, a) => sum + a.campaignsCount, 0);
  const totalAds = accounts.reduce((sum, a) => sum + a.adsCount, 0);

  // Filter to show only connected accounts by default
  const displayedAccounts = showAllAccounts ? accounts : connectedAccounts;

  // Show skeleton during loading
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        {/* Account Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-5 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Briefcase className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-sm text-slate-400">Active Accounts</span>
          </div>
          <p className="text-3xl font-bold text-slate-100">{activeAccounts.length}<span className="text-lg text-slate-500">/{accounts.length}</span></p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 text-xs">
              <Link2 className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400">{connectedAccounts.length} connected</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-5 border border-blue-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm text-slate-400">Today's Spend</span>
          </div>
          <p className="text-3xl font-bold text-slate-100">{formatCurrency(todaySpend)}</p>
          <p className="text-xs text-slate-500 mt-2">{formatCurrency(totalSpend)} lifetime</p>
        </div>

        <div className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 rounded-xl p-5 border border-violet-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-sm text-slate-400">Campaigns</span>
          </div>
          <p className="text-3xl font-bold text-slate-100">{totalCampaigns}</p>
          <p className="text-xs text-slate-500 mt-2">{totalAds} ads running</p>
        </div>

        <div className={`bg-gradient-to-br ${suspendedCount > 0 ? 'from-red-500/10 to-red-600/5 border-red-500/20' : 'from-slate-500/10 to-slate-600/5 border-slate-500/20'} rounded-xl p-5 border`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 ${suspendedCount > 0 ? 'bg-red-500/20' : 'bg-slate-500/20'} rounded-lg`}>
              <AlertTriangle className={`w-5 h-5 ${suspendedCount > 0 ? 'text-red-400' : 'text-slate-400'}`} />
            </div>
            <span className="text-sm text-slate-400">Issues</span>
          </div>
          <p className={`text-3xl font-bold ${suspendedCount > 0 ? 'text-red-400' : 'text-slate-100'}`}>{suspendedCount}</p>
          <p className="text-xs text-slate-500 mt-2">{suspendedCount > 0 ? 'Need attention' : 'All healthy'}</p>
        </div>
      </div>

      {/* Account Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-slate-300">
              {showAllAccounts ? "All Accounts" : "Connected Accounts"}
            </h3>
            <span className="text-xs text-slate-500">
              {displayedAccounts.length}{connectedAccounts.length < accounts.length && !showAllAccounts ? ` of ${accounts.length}` : ""}
            </span>
            {accounts.length > 0 && connectedAccounts.length > 0 && (
              <button
                onClick={() => setShowAllAccounts(!showAllAccounts)}
                className="text-xs text-slate-500 hover:text-slate-300 transition"
              >
                · {showAllAccounts ? "connected only" : "show all"}
              </button>
            )}
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs transition">
            <RefreshCw className="w-3 h-3" />
            Sync All
          </button>
        </div>

        {displayedAccounts.length === 0 ? (
          <div className="bg-slate-800/30 rounded-xl p-12 text-center border border-slate-700/50">
            <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-200 mb-2">
              {accounts.length === 0 ? "No Accounts Yet" : "No Connected Accounts"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {accounts.length === 0
                ? "Request a new account to get started with campaign management."
                : `You have ${accounts.length} account${accounts.length === 1 ? "" : "s"} but none are connected to Google Ads.`}
            </p>
            {accounts.length > 0 && (
              <button
                onClick={() => setShowAllAccounts(true)}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition"
              >
                Show All Accounts
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayedAccounts.map((account) => (
              <div
                key={account.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      account.accountHealth === "active" ? "bg-emerald-400 shadow-lg shadow-emerald-400/30" :
                      account.accountHealth === "suspended" ? "bg-red-400 shadow-lg shadow-red-400/30" :
                      "bg-slate-400"
                    }`} />
                    <div>
                      <h4 className="text-base font-semibold text-slate-100">
                        MM{String(account.internalId).padStart(3, "0")}
                      </h4>
                      <p className="text-xs text-slate-500">{formatCid(account.googleCid)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Google Connected Status */}
                    {account.connection?.status === "active" ? (
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <Link2 className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] text-blue-400 font-medium">Connected</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                        <Unlink className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] text-slate-500 font-medium">Not Connected</span>
                      </div>
                    )}
                    {/* Health Badge */}
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wide ${
                      account.accountHealth === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      account.accountHealth === "suspended" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                    }`}>
                      {account.accountHealth}
                    </span>
                  </div>
                </div>

                {/* Card Body - Metrics */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Today</p>
                      <p className="text-sm font-semibold text-slate-100">{formatCurrency(account.todaySpend)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Total</p>
                      <p className="text-sm font-semibold text-slate-100">{formatCurrency(account.currentSpendTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Campaigns</p>
                      <p className="text-sm font-semibold text-slate-100">{account.campaignsCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Ads</p>
                      <p className="text-sm font-semibold text-slate-100">{account.adsCount}</p>
                    </div>
                  </div>

                  {/* Identity Info */}
                  {account.identityProfile && (
                    <div className="text-xs text-slate-500 mb-4">
                      <span className="text-slate-400">{account.identityProfile.fullName}</span>
                      <span className="mx-1">•</span>
                      <span>{account.identityProfile.geo}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer - Actions */}
                <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-700/50 flex items-center gap-2">
                  {/* View Details */}
                  <button
                    onClick={() => onAccountClick?.(account.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </button>

                  {/* GoLogin Launch */}
                  {account.identityProfile?.gologinProfile?.profileId ? (
                    <a
                      href={`https://app.gologin.com/browser/${account.identityProfile.gologinProfile.profileId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      GoLogin
                    </a>
                  ) : (
                    <div className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-600 rounded-lg text-xs font-medium cursor-not-allowed">
                      <Play className="w-3.5 h-3.5" />
                      GoLogin
                    </div>
                  )}

                  {/* AI Chat */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onChatAboutAccount?.(account);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg text-xs font-medium transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    AI
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MY ACCOUNTS VIEW (Dashboard-style cards with search/filter)
// ============================================================================

function MyAccountsView({
  accounts,
  loading,
  onAccountClick,
  onChatAboutAccount
}: {
  accounts: AdAccount[];
  loading: boolean;
  onAccountClick?: (accountId: string) => void;
  onChatAboutAccount?: (account: AdAccount) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "limited">("all");
  const [connectionFilter, setConnectionFilter] = useState<"all" | "connected" | "not-connected">("connected");

  // Filter accounts based on search and filters
  const filteredAccounts = accounts.filter((account) => {
    // Search filter
    const accountName = `MM${String(account.internalId).padStart(3, "0")}`.toLowerCase();
    const identityName = account.identityProfile?.fullName?.toLowerCase() || "";
    const cid = account.googleCid || "";
    const matchesSearch = searchQuery === "" ||
      accountName.includes(searchQuery.toLowerCase()) ||
      identityName.includes(searchQuery.toLowerCase()) ||
      cid.includes(searchQuery);

    // Status filter
    const matchesStatus = statusFilter === "all" || account.accountHealth === statusFilter;

    // Connection filter
    const isConnected = account.connection?.status === "active";
    const matchesConnection = connectionFilter === "all" ||
      (connectionFilter === "connected" && isConnected) ||
      (connectionFilter === "not-connected" && !isConnected);

    return matchesSearch && matchesStatus && matchesConnection;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filter Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search accounts (MM001, identity name, CID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="limited">Limited</option>
        </select>
        <select
          value={connectionFilter}
          onChange={(e) => setConnectionFilter(e.target.value as typeof connectionFilter)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500"
        >
          <option value="all">All Connections</option>
          <option value="connected">Connected</option>
          <option value="not-connected">Not Connected</option>
        </select>
      </div>

      {/* Results Count */}
      {!loading && accounts.length > 0 && (
        <div className="text-xs text-slate-500">
          Showing {filteredAccounts.length} of {accounts.length} accounts
        </div>
      )}

      {/* Account Cards (Dashboard-style) */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            Loading your accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            No accounts assigned to you yet.
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            No accounts match your filters.
          </div>
        ) : (
          filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition overflow-hidden"
            >
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    account.accountHealth === "active" ? "bg-emerald-400 shadow-lg shadow-emerald-400/30" :
                    account.accountHealth === "suspended" ? "bg-red-400 shadow-lg shadow-red-400/30" :
                    "bg-slate-400"
                  }`} />
                  <div>
                    <h4 className="text-base font-semibold text-slate-100">
                      MM{String(account.internalId).padStart(3, "0")}
                    </h4>
                    <p className="text-xs text-slate-500">{formatCid(account.googleCid)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Google Connected Status */}
                  {account.connection?.status === "active" ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <Link2 className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-blue-400 font-medium">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                      <Unlink className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500 font-medium">Not Connected</span>
                    </div>
                  )}
                  {/* Health Badge */}
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wide ${
                    account.accountHealth === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    account.accountHealth === "suspended" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                    "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                  }`}>
                    {account.accountHealth}
                  </span>
                </div>
              </div>

              {/* Card Body - Metrics */}
              <div className="px-5 py-4">
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Today</p>
                    <p className="text-sm font-semibold text-slate-100">{formatCurrency(account.todaySpend)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Total</p>
                    <p className="text-sm font-semibold text-slate-100">{formatCurrency(account.currentSpendTotal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Campaigns</p>
                    <p className="text-sm font-semibold text-slate-100">{account.campaignsCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Ads</p>
                    <p className="text-sm font-semibold text-slate-100">{account.adsCount}</p>
                  </div>
                </div>

                {/* Identity Info */}
                {account.identityProfile && (
                  <div className="text-xs text-slate-500 mb-4">
                    <span className="text-slate-400">{account.identityProfile.fullName}</span>
                    <span className="mx-1">•</span>
                    <span>{account.identityProfile.geo}</span>
                  </div>
                )}
              </div>

              {/* Card Footer - Actions */}
              <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-700/50 flex items-center gap-2">
                {/* View Details */}
                <button
                  onClick={() => onAccountClick?.(account.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Details
                </button>

                {/* GoLogin Launch */}
                {account.identityProfile?.gologinProfile?.profileId ? (
                  <a
                    href={`https://app.gologin.com/browser/${account.identityProfile.gologinProfile.profileId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    GoLogin
                  </a>
                ) : (
                  <div className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-600 rounded-lg text-xs font-medium cursor-not-allowed">
                    <Play className="w-3.5 h-3.5" />
                    GoLogin
                  </div>
                )}

                {/* AI Chat */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatAboutAccount?.(account);
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg text-xs font-medium transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  AI
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ACCOUNT DETAIL VIEW - Inline Tree Expansion (Google Ads Style)
// ============================================================================

function AccountDetailView({
  account,
  onOpenAdChat,
}: {
  account: AdAccount;
  onOpenAdChat?: (prompt: string, adContext: string) => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [dateRange, setDateRange] = useState<"TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_14_DAYS" | "LAST_30_DAYS">("LAST_7_DAYS");

  // Inline expansion state
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [expandedAdGroupId, setExpandedAdGroupId] = useState<string | null>(null);
  const [adGroups, setAdGroups] = useState<Record<string, AdGroup[]>>({});
  const [ads, setAds] = useState<Record<string, Ad[]>>({});
  const [loadingAdGroups, setLoadingAdGroups] = useState<Record<string, boolean>>({});
  const [loadingAds, setLoadingAds] = useState<Record<string, boolean>>({});

  // Show more state for large lists
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const CAMPAIGNS_LIMIT = 10;

  // Ad Detail Panel state
  const [selectedAd, setSelectedAd] = useState<{ ad: ScoredAd; allAdsInGroup: ScoredAd[] } | null>(null);

  // Check if account has no CID - can't fetch campaigns without it
  if (!account.googleCid) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
        <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-200 mb-2">No Google CID</h3>
        <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
          This account doesn&apos;t have a Google Customer ID (CID) assigned yet.
          The CID needs to be set before campaigns can be viewed.
        </p>
      </div>
    );
  }

  // NOTE: We removed the early "connection check" guard here.
  // Instead, we let the sync/fetch run and detect "not connected" errors
  // from the API response. This is more reliable because:
  // 1. The account.connection data from the list API might be stale
  // 2. The sync endpoint does the authoritative check
  // 3. Avoids false positives from client-side connection status checks

  const customerId = account.googleCid.replace(/-/g, "");
  const accountName = `MM${String(account.internalId).padStart(3, "0")}`;

  // Sync account with Google Ads (triggers full data refresh)
  const syncAccount = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/accounts/${account.id}/sync`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("Sync failed:", data.error);
        return false;
      }

      console.log("[Kadabra] Sync completed:", data.metrics);
      return true;
    } catch (err) {
      console.error("Sync failed:", err);
      return false;
    }
  };

  // Fetch campaigns for this account
  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch(
        `/api/campaigns?accountId=${account.id}&customerId=${customerId}&dateRange=${dateRange}`
      );
      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to fetch campaigns:", data.error);
        return;
      }

      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // Refresh: sync first, then fetch campaigns
  const handleRefresh = async () => {
    setLoadingCampaigns(true);
    // First sync the account to get fresh data from Google Ads
    const syncSuccess = await syncAccount();
    if (syncSuccess) {
      // Then fetch the campaigns
      await fetchCampaigns();
    } else {
      setLoadingCampaigns(false);
    }
  };

  // Fetch ad groups for a campaign
  const fetchAdGroups = async (campaignId: string) => {
    if (adGroups[campaignId]) return; // Already fetched

    setLoadingAdGroups(prev => ({ ...prev, [campaignId]: true }));
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/ad-groups?accountId=${account.id}&customerId=${customerId}&dateRange=${dateRange}`
      );
      if (res.ok) {
        const data = await res.json();
        setAdGroups(prev => ({ ...prev, [campaignId]: data.adGroups || [] }));
      }
    } catch (err) {
      console.error("Failed to fetch ad groups:", err);
    } finally {
      setLoadingAdGroups(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  // Fetch ads for a campaign (grouped by ad group)
  const fetchAds = async (campaignId: string, adGroupId: string) => {
    const key = `${campaignId}-${adGroupId}`;
    if (ads[key]) return; // Already fetched

    setLoadingAds(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/ads?accountId=${account.id}&customerId=${customerId}&dateRange=${dateRange}`
      );
      if (res.ok) {
        const data = await res.json();
        // Filter ads by ad group
        const filteredAds = (data.ads || []).filter((ad: Ad) => ad.adGroupId === adGroupId);
        setAds(prev => ({ ...prev, [key]: filteredAds }));
      }
    } catch (err) {
      console.error("Failed to fetch ads:", err);
    } finally {
      setLoadingAds(prev => ({ ...prev, [key]: false }));
    }
  };

  // Load campaigns on mount and when date range changes
  useEffect(() => {
    fetchCampaigns();
  }, [account.id, dateRange]);

  // Handle campaign expansion
  const handleCampaignClick = async (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      // Collapse
      setExpandedCampaignId(null);
      setExpandedAdGroupId(null);
    } else {
      // Expand and fetch ad groups
      setExpandedCampaignId(campaignId);
      setExpandedAdGroupId(null);
      await fetchAdGroups(campaignId);
    }
  };

  // Handle ad group expansion
  const handleAdGroupClick = async (campaignId: string, adGroupId: string) => {
    if (expandedAdGroupId === adGroupId) {
      // Collapse
      setExpandedAdGroupId(null);
    } else {
      // Expand and fetch ads
      setExpandedAdGroupId(adGroupId);
      await fetchAds(campaignId, adGroupId);
    }
  };

  // Helper functions for display
  const getCampaignTypeIcon = (type: string): string => {
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
  };

  const getCampaignTypeColor = (type: string): string => {
    switch (type) {
      case "SEARCH": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "DISPLAY": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "VIDEO": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "SHOPPING": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "PERFORMANCE_MAX": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getStatusBadge = (status: string): { color: string; label: string } => {
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
  };

  // Determine which campaigns to show
  const visibleCampaigns = showAllCampaigns ? campaigns : campaigns.slice(0, CAMPAIGNS_LIMIT);
  const hasMoreCampaigns = campaigns.length > CAMPAIGNS_LIMIT;

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{accountName}</h2>
            <p className="text-sm text-slate-500 mt-1">CID: {formatCid(account.googleCid)}</p>
          </div>
          <div className="flex items-center gap-3">
            {account.connection?.status === "active" && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Link2 className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">Google Connected</span>
              </span>
            )}
            <span className={`px-2 py-1 rounded-lg text-xs font-medium uppercase tracking-wide ${
              account.accountHealth === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
              account.accountHealth === "suspended" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
              "bg-slate-500/10 text-slate-400 border border-slate-500/20"
            }`}>
              {account.accountHealth}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Today&apos;s Spend</p>
            <p className="text-lg font-semibold text-slate-100">{formatCurrency(account.todaySpend)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Total Spend</p>
            <p className="text-lg font-semibold text-slate-100">{formatCurrency(account.currentSpendTotal)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Campaigns</p>
            <p className="text-lg font-semibold text-slate-100">{account.campaignsCount}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Ads</p>
            <p className="text-lg font-semibold text-slate-100">{account.adsCount}</p>
          </div>
        </div>

        {/* Identity Info */}
        {account.identityProfile && (
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              <span className="text-slate-500">Identity:</span> {account.identityProfile.fullName} ({account.identityProfile.geo})
            </p>
            {account.identityProfile.gologinProfile?.profileId && (
              <a
                href={`https://app.gologin.com/browser/${account.identityProfile.gologinProfile.profileId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium transition"
              >
                <Play className="w-3.5 h-3.5" />
                Launch GoLogin
              </a>
            )}
          </div>
        )}
      </div>

      {/* Campaigns Section - Inline Tree */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Campaigns</h3>
              <p className="text-xs text-slate-500">{campaigns.length} campaigns • Click to expand</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500"
            >
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_14_DAYS">Last 14 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={loadingCampaigns}
              className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition"
              title="Sync with Google Ads"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCampaigns ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Campaign Tree */}
        <div>
          {loadingCampaigns ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
              Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <Layers className="w-8 h-8 mx-auto mb-3 text-slate-600" />
              No campaigns found for this account.
            </div>
          ) : (
            <>
              {visibleCampaigns.map((campaign) => {
                const statusBadge = getStatusBadge(campaign.status);
                const cpa = campaign.conversions > 0 ? campaign.cost / campaign.conversions : 0;
                const isExpanded = expandedCampaignId === campaign.id;
                const campaignAdGroups = adGroups[campaign.id] || [];
                const isLoadingAdGroups = loadingAdGroups[campaign.id];

                return (
                  <div key={campaign.id} className="border-b border-slate-800 last:border-b-0">
                    {/* Campaign Row */}
                    <div
                      onClick={() => handleCampaignClick(campaign.id)}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-slate-800/50 cursor-pointer transition group"
                    >
                      {/* Expand Chevron */}
                      <div className="w-5">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-violet-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition" />
                        )}
                      </div>

                      {/* Campaign Type Badge */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${getCampaignTypeColor(campaign.type)}`}
                        title={campaign.type}
                      >
                        {getCampaignTypeIcon(campaign.type)}
                      </div>

                      {/* Campaign Name & Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-100 group-hover:text-violet-400 transition truncate">
                            {campaign.name}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {campaign.adGroupCount} ad groups
                        </div>
                      </div>

                      {/* Pause Button (disabled) */}
                      <button
                        disabled
                        className="px-2 py-1 rounded text-slate-600 text-[10px] cursor-not-allowed opacity-50"
                        title="Coming Soon"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>

                      {/* Metrics */}
                      <div className="flex items-center gap-3 text-right">
                        <div className="w-14">
                          <div className="text-xs font-medium text-slate-100">${(campaign.cost / 1_000_000).toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">Spend</div>
                        </div>
                        <div className="w-10">
                          <div className="text-xs font-medium text-slate-100">{campaign.clicks.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500">Clicks</div>
                        </div>
                        <div className="w-10">
                          <div className="text-xs font-medium text-slate-100">{campaign.conversions.toFixed(1)}</div>
                          <div className="text-[10px] text-slate-500">Conv</div>
                        </div>
                        <div className="w-12">
                          <div className="text-xs font-medium text-slate-100">{cpa > 0 ? `$${(cpa / 1_000_000).toFixed(2)}` : "—"}</div>
                          <div className="text-[10px] text-slate-500">CPA</div>
                        </div>
                        <div className="w-10">
                          <div className="text-xs font-medium text-slate-100">{(campaign.ctr * 100).toFixed(2)}%</div>
                          <div className="text-[10px] text-slate-500">CTR</div>
                        </div>
                      </div>
                    </div>

                    {/* Ad Groups (expanded inline) */}
                    {isExpanded && (
                      <div className="bg-slate-900/30">
                        {isLoadingAdGroups ? (
                          <div className="px-6 py-4 text-center text-slate-500 text-sm">
                            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                            Loading ad groups...
                          </div>
                        ) : campaignAdGroups.length === 0 ? (
                          <div className="px-6 py-4 text-center text-slate-500 text-sm pl-12">
                            No ad groups in this campaign.
                          </div>
                        ) : (
                          campaignAdGroups.map((adGroup) => {
                            const agStatusBadge = getStatusBadge(adGroup.status);
                            const isAgExpanded = expandedAdGroupId === adGroup.id;
                            const adGroupAds = ads[`${campaign.id}-${adGroup.id}`] || [];
                            const isLoadingAdsForGroup = loadingAds[`${campaign.id}-${adGroup.id}`];

                            return (
                              <div key={adGroup.id}>
                                {/* Ad Group Row */}
                                <div
                                  onClick={(e) => { e.stopPropagation(); handleAdGroupClick(campaign.id, adGroup.id); }}
                                  className="flex items-center gap-3 px-6 py-2 pl-12 hover:bg-slate-800/30 cursor-pointer transition group"
                                >
                                  {/* Expand Chevron */}
                                  <div className="w-4">
                                    {isAgExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition" />
                                    )}
                                  </div>

                                  {/* Ad Group Name */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-slate-200 group-hover:text-blue-400 transition truncate">
                                        {adGroup.name}
                                      </span>
                                      <span className={`text-[9px] px-1 py-0.5 rounded border ${agStatusBadge.color}`}>
                                        {agStatusBadge.label}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {adGroupAds.length > 0 ? `${adGroupAds.length} ads` : adGroup.adsCount ? `${adGroup.adsCount} ads` : ""}
                                    </div>
                                  </div>

                                  {/* Pause Button (disabled) */}
                                  <button
                                    disabled
                                    className="px-1.5 py-0.5 rounded text-slate-600 text-[10px] cursor-not-allowed opacity-50"
                                    title="Coming Soon"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Pause className="w-3 h-3" />
                                  </button>

                                  {/* Metrics */}
                                  <div className="flex items-center gap-2 text-right">
                                    <div className="w-12">
                                      <div className="text-[11px] font-medium text-slate-200">${(adGroup.cost / 1_000_000).toFixed(2)}</div>
                                    </div>
                                    <div className="w-8">
                                      <div className="text-[11px] font-medium text-slate-200">{adGroup.clicks}</div>
                                    </div>
                                    <div className="w-8">
                                      <div className="text-[11px] font-medium text-slate-200">{adGroup.conversions.toFixed(1)}</div>
                                    </div>
                                    <div className="w-10">
                                      <div className="text-[11px] font-medium text-slate-200">{(adGroup.ctr * 100).toFixed(2)}%</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Ads (expanded inline) */}
                                {isAgExpanded && (
                                  <div className="bg-slate-900/50">
                                    {isLoadingAdsForGroup ? (
                                      <div className="px-6 py-3 text-center text-slate-500 text-xs pl-20">
                                        <RefreshCw className="w-3 h-3 animate-spin mx-auto mb-1" />
                                        Loading ads...
                                      </div>
                                    ) : adGroupAds.length === 0 ? (
                                      <div className="px-6 py-3 text-center text-slate-500 text-xs pl-20">
                                        No ads in this ad group.
                                      </div>
                                    ) : (
                                      (() => {
                                        // Score all ads in this ad group
                                        const scoredAds = scoreAdsInGroup(adGroupAds);
                                        return scoredAds.map((ad) => {
                                          const adStatusBadge = getStatusBadge(ad.status);
                                          const headline = ad.headlines?.[0] || ad.name || "Ad";

                                          return (
                                            <div
                                              key={ad.id}
                                              onClick={() => setSelectedAd({ ad, allAdsInGroup: scoredAds })}
                                              className="flex items-center gap-3 px-6 py-2 pl-20 hover:bg-slate-800/20 transition cursor-pointer"
                                            >
                                              {/* Ad indicator */}
                                              <div className="w-3 h-3 rounded bg-slate-700 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded bg-slate-500" />
                                              </div>

                                              {/* Ad Name + Score Badge */}
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[11px] text-slate-300 truncate">
                                                    {headline}
                                                  </span>
                                                  <ScoreBadge score={ad.score} />
                                                  <span className={`text-[8px] px-1 py-0.5 rounded border ${adStatusBadge.color}`}>
                                                    {adStatusBadge.label}
                                                  </span>
                                                </div>
                                                {ad.type && (
                                                  <div className="text-[9px] text-slate-600">{ad.type.replace(/_/g, " ")}</div>
                                                )}
                                              </div>

                                              {/* Pause Button (disabled) */}
                                              <button
                                                disabled
                                                className="px-1 py-0.5 rounded text-slate-600 text-[9px] cursor-not-allowed opacity-50"
                                                title="Coming Soon"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <Pause className="w-2.5 h-2.5" />
                                              </button>

                                              {/* Metrics */}
                                              <div className="flex items-center gap-2 text-right">
                                                <div className="w-10">
                                                  <div className="text-[10px] text-slate-300">${(ad.cost / 1_000_000).toFixed(2)}</div>
                                                </div>
                                                <div className="w-6">
                                                  <div className="text-[10px] text-slate-300">{ad.clicks}</div>
                                                </div>
                                                <div className="w-6">
                                                  <div className="text-[10px] text-slate-300">{ad.conversions.toFixed(1)}</div>
                                                </div>
                                                <div className="w-9">
                                                  <div className="text-[10px] text-slate-300">{(ad.ctr * 100).toFixed(2)}%</div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        });
                                      })()
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Show More Button */}
              {hasMoreCampaigns && !showAllCampaigns && (
                <button
                  onClick={() => setShowAllCampaigns(true)}
                  className="w-full px-6 py-3 text-center text-sm text-violet-400 hover:text-violet-300 hover:bg-slate-800/30 transition"
                >
                  Show all {campaigns.length} campaigns
                </button>
              )}
              {hasMoreCampaigns && showAllCampaigns && (
                <button
                  onClick={() => setShowAllCampaigns(false)}
                  className="w-full px-6 py-3 text-center text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-800/30 transition"
                >
                  Show less
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Other Actions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5 opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-300">Performance Reports</h3>
          </div>
          <p className="text-xs text-slate-500">Historical performance data and trends</p>
          <span className="inline-block mt-3 px-2 py-0.5 bg-slate-700/50 text-slate-500 text-[10px] rounded">Coming Soon</span>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5 opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-300">Automation Rules</h3>
          </div>
          <p className="text-xs text-slate-500">Set up automatic bid and budget adjustments</p>
          <span className="inline-block mt-3 px-2 py-0.5 bg-slate-700/50 text-slate-500 text-[10px] rounded">Coming Soon</span>
        </div>
      </div>

      {/* Ad Detail Panel */}
      {selectedAd && (
        <AdDetailPanel
          ad={selectedAd.ad}
          allAdsInGroup={selectedAd.allAdsInGroup}
          onClose={() => setSelectedAd(null)}
          accountId={account.id}
          customerId={customerId}
          onOpenChat={onOpenAdChat}
        />
      )}
    </div>
  );
}

// ============================================================================
// TOOLS VIEW
// ============================================================================

function ToolsView({ onNavigate }: { onNavigate?: (view: View) => void }) {
  return (
    <div className="space-y-6">
      {/* AI Tools Section */}
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h4 className="text-sm font-semibold text-slate-100">AI Tools</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Campaign Planner AI */}
          <button
            onClick={() => onNavigate?.("campaign-planner")}
            className="bg-slate-800/50 rounded-xl p-5 border border-violet-500/30 hover:border-violet-500/50 transition text-left group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg group-hover:scale-110 transition">
                <Target className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-medium text-slate-200">Campaign Planner AI</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              AI-powered campaign planning. Enter your product details and get a complete Google Ads strategy with keywords, ad copy, and budget recommendations.
            </p>
            <span className="text-xs text-violet-400 group-hover:text-violet-300 transition">
              Launch Planner →
            </span>
          </button>

          {/* Video Clipper AI */}
          <button
            onClick={() => onNavigate?.("video-clipper")}
            className="bg-slate-800/50 rounded-xl p-5 border border-pink-500/30 hover:border-pink-500/50 transition text-left group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-pink-500 to-violet-600 rounded-lg group-hover:scale-110 transition">
                <Play className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-medium text-slate-200">Video Clipper AI</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Transform long videos into high-converting vertical clips for Reels & TikTok with AI-powered marketing moment detection.
            </p>
            <span className="text-xs text-pink-400 group-hover:text-pink-300 transition">
              Create Clips →
            </span>
          </button>

          {/* Ads Image Creator AI */}
          <button
            onClick={() => onNavigate?.("ads-image-creator")}
            className="bg-slate-800/50 rounded-xl p-5 border border-orange-500/30 hover:border-orange-500/50 transition text-left group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg group-hover:scale-110 transition">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-medium text-slate-200">Ads Image Creator</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Generate high-converting ad creatives with AI. Analyze competitors, test marketing angles, and export to multiple formats.
            </p>
            <span className="text-xs text-orange-400 group-hover:text-orange-300 transition">
              Create Ads →
            </span>
          </button>

          {/* Ad Spy - Coming Soon */}
          <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/30 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-slate-700/50 rounded-lg">
                <Eye className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-slate-400">Ad Spy</h3>
                <ComingSoonBadge size="sm" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Research competitor ads and discover winning creative strategies.
            </p>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-4">Integrations</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* GoLogin Integration */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-violet-500/50 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <ExternalLink className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-200">GoLogin</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Manage browser profiles and sessions for secure account access.
            </p>
            <a
              href="https://app.gologin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition"
            >
              Open GoLogin App
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Google Ads */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-violet-500/50 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-200">Google Ads</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Direct access to Google Ads console for advanced management.
            </p>
            <a
              href="https://ads.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
            >
              Open Google Ads
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Account Sync */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-violet-500/50 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <RefreshCw className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-200">Sync Data</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Refresh account data and sync metrics from Google Ads.
            </p>
            <button className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition">
              <RefreshCw className="w-3 h-3" />
              Sync Now
            </button>
          </div>
        </div>
      </div>

      {/* Coming Soon Tools */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-medium text-slate-400">More Coming Soon</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
            <h5 className="text-xs font-medium text-slate-400 mb-1">Bulk Editor</h5>
            <p className="text-[11px] text-slate-500">Edit multiple campaigns at once</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
            <h5 className="text-xs font-medium text-slate-400 mb-1">Report Builder</h5>
            <p className="text-[11px] text-slate-500">Create custom performance reports</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
            <h5 className="text-xs font-medium text-slate-400 mb-1">Negative Keyword Tool</h5>
            <p className="text-[11px] text-slate-500">Find and add negative keywords</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// REQUESTS VIEW
// ============================================================================

function RequestsView({ requests, loading, onCreateRequest }: {
  requests: AccountRequest[];
  loading: boolean;
  onCreateRequest: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-slate-200">My Account Requests</h2>
        <button
          onClick={onCreateRequest}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg text-sm font-medium transition"
        >
          <PlusCircle className="w-4 h-4" />
          Request New Account
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            No account requests yet. Click the button above to request a new account.
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-slate-200">
                      {request.type === "CREATE_NEW" ? "New Account Request" : "Claim Existing Account"}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        request.status === "PENDING"
                          ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                          : request.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">{request.justification}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Submitted {formatDate(request.createdAt)}
                  </p>
                </div>
                {request.status === "PENDING" && (
                  <Clock className="w-5 h-5 text-yellow-400" />
                )}
                {request.status === "APPROVED" && (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              {request.rejectionReason && (
                <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-sm text-red-400">{request.rejectionReason}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// NOTIFICATIONS VIEW
// ============================================================================

function NotificationsView({ notifications, loading, onMarkRead }: {
  notifications: Notification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-slate-200">Notifications</h2>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            No notifications yet.
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-slate-800/50 rounded-xl p-5 border transition cursor-pointer ${
                notification.isRead
                  ? "border-slate-700/50"
                  : "border-violet-500/30 bg-violet-500/5"
              }`}
              onClick={() => !notification.isRead && onMarkRead(notification.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${notification.isRead ? "bg-slate-700/50" : "bg-violet-500/10"}`}>
                  <Bell className={`w-4 h-4 ${notification.isRead ? "text-slate-400" : "text-violet-400"}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-slate-200">{notification.title}</h3>
                  <p className="text-sm text-slate-400 mt-1">{notification.message}</p>
                  <p className="text-xs text-slate-500 mt-2">{formatDate(notification.createdAt)}</p>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-violet-400 rounded-full" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// REQUEST MODAL
// ============================================================================

function RequestModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (justification: string) => void }) {
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) return;
    setSubmitting(true);
    await onSubmit(justification);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">Request New Account</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Why do you need a new account?
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain your use case..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !justification.trim()}
              className="flex-1 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN KADABRA APP
// ============================================================================

type View = "dashboard" | "accounts" | "account-detail" | "automations" | "tools" | "campaign-planner" | "video-clipper" | "ads-image-creator" | "action-queue" | "requests" | "notifications";

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-slate-800/50 rounded-xl border border-slate-700/50 animate-pulse ${className}`}>
      <div className="p-5">
        <div className="h-4 bg-slate-700/50 rounded w-1/3 mb-3" />
        <div className="h-8 bg-slate-700/50 rounded w-1/2 mb-2" />
        <div className="h-3 bg-slate-700/50 rounded w-2/3" />
      </div>
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
      <div className="w-2 h-2 bg-slate-700/50 rounded-full" />
      <div className="flex-1">
        <div className="h-4 bg-slate-700/50 rounded w-1/3 mb-2" />
        <div className="h-3 bg-slate-700/50 rounded w-1/2" />
      </div>
      <div className="text-right">
        <div className="h-4 bg-slate-700/50 rounded w-16 mb-1" />
        <div className="h-3 bg-slate-700/50 rounded w-12" />
      </div>
    </div>
  );
}

// ============================================================================
// COMING SOON BADGE
// ============================================================================

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
// MAIN KADABRA APP
// ============================================================================

export function KadabraApp() {
  const { data: session, status, update: updateSession } = useSession();
  const [view, setView] = useState<View>("dashboard");
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  // Listen for video clip completion notifications
  useEffect(() => {
    const handleVideoClipComplete = (event: CustomEvent<{
      jobId: string;
      title: string;
      message: string;
    }>) => {
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-slate-800 border border-violet-500/30 shadow-lg rounded-xl pointer-events-auto flex items-center gap-3 p-4`}
        >
          <div className="p-2 bg-violet-500/20 rounded-lg flex-shrink-0">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100">{event.detail.title}</p>
            <p className="text-xs text-slate-400 truncate">{event.detail.message}</p>
          </div>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              setView("video-clipper");
            }}
            className="px-3 py-1.5 bg-violet-500 hover:bg-violet-400 text-white text-xs font-medium rounded-lg transition flex-shrink-0"
          >
            View
          </button>
        </div>
      ), { duration: 10000, position: "top-right" });
    };

    window.addEventListener("videoClipComplete", handleVideoClipComplete as EventListener);
    return () => {
      window.removeEventListener("videoClipComplete", handleVideoClipComplete as EventListener);
    };
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [accountsRes, requestsRes, notificationsRes] = await Promise.all([
        fetch("/api/accounts/my-accounts"),
        fetch("/api/requests"),
        fetch("/api/notifications"),
      ]);

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(Array.isArray(data) ? data : data.accounts || []);
      }
      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(Array.isArray(data) ? data : data.requests || []);
      }
      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotifications(Array.isArray(data) ? data : data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
    setLoading(false);
  }

  async function handleCreateRequest(justification: string) {
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CREATE_NEW", justification }),
      });
      if (res.ok) {
        setShowRequestModal(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create request:", error);
    }
  }

  async function handleMarkNotificationRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark notification read:", error);
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
    } catch (error) {
      console.error("Failed to mark all notifications read:", error);
    }
  }

  // ============================================================================
  // CHAT WINDOW MANAGEMENT
  // ============================================================================

  function openChatForAccount(account: AdAccount) {
    const accountName = `MM${String(account.internalId).padStart(3, "0")}`;
    const existing = findExistingWindow(chatWindows, account.id);

    if (existing) {
      // Bring to front and unminimize
      setChatWindows(bringWindowToFront(chatWindows, existing.id));
    } else {
      // Create new window with context
      const context = `Tell me about account ${accountName} (CID: ${formatCid(account.googleCid)}). It has ${account.campaignsCount} campaigns and ${account.adsCount} ads, with total spend of ${formatCurrency(account.currentSpendTotal)}.`;
      const newWindow = createChatWindow(account.id, accountName, context);
      setChatWindows([...chatWindows, newWindow]);
    }
  }

  function openGeneralChat() {
    const existing = findExistingWindow(chatWindows, null);

    if (existing) {
      setChatWindows(bringWindowToFront(chatWindows, existing.id));
    } else {
      const newWindow = createChatWindow(null, "Magimanager AI");
      setChatWindows([...chatWindows, newWindow]);
    }
  }

  function closeChatWindow(windowId: string) {
    setChatWindows(chatWindows.filter((w) => w.id !== windowId));
  }

  function toggleMinimize(windowId: string) {
    setChatWindows(
      chatWindows.map((w) =>
        w.id === windowId ? { ...w, isMinimized: !w.isMinimized } : w
      )
    );
  }

  function updateChatWindow(windowId: string, updates: Partial<ChatWindow>) {
    setChatWindows(
      chatWindows.map((w) =>
        w.id === windowId ? { ...w, ...updates } : w
      )
    );
  }

  async function handleSendChatMessage(windowId: string, messageText: string) {
    if (!messageText.trim()) return;

    // Add user message
    setChatWindows((prev) =>
      prev.map((w) =>
        w.id === windowId
          ? {
              ...w,
              messages: [...w.messages, { role: "user" as const, content: messageText }],
              isLoading: true,
            }
          : w
      )
    );

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatWindows((prev) =>
          prev.map((w) =>
            w.id === windowId
              ? {
                  ...w,
                  messages: [
                    ...w.messages,
                    { role: "assistant" as const, content: data.message },
                  ],
                  isLoading: false,
                }
              : w
          )
        );
      } else {
        setChatWindows((prev) =>
          prev.map((w) =>
            w.id === windowId
              ? {
                  ...w,
                  messages: [
                    ...w.messages,
                    {
                      role: "assistant" as const,
                      content: "Sorry, I encountered an error. Please try again.",
                    },
                  ],
                  isLoading: false,
                }
              : w
          )
        );
      }
    } catch {
      setChatWindows((prev) =>
        prev.map((w) =>
          w.id === windowId
            ? {
                ...w,
                messages: [
                  ...w.messages,
                  {
                    role: "assistant" as const,
                    content: "Failed to connect. Please check your connection.",
                  },
                ],
                isLoading: false,
              }
            : w
        )
      );
    }
  }

  // Mark all notifications as read when viewing notifications
  useEffect(() => {
    if (view === "notifications" && notifications.some((n) => !n.isRead)) {
      handleMarkAllNotificationsRead();
    }
  }, [view]);

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (status === "unauthenticated") {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return null;
  }

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // For now we'll mock 0 alerts until we fetch from DB
  const alertsCount = 0;
  const queueCount = 0;

  const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard; badge?: number; divider?: boolean }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts", label: "My Accounts", icon: Briefcase, divider: true },
    { id: "automations", label: "Automations", icon: Zap },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "action-queue", label: "Action Queue", icon: ListChecks, badge: queueCount > 0 ? queueCount : undefined, divider: true },
    { id: "requests", label: "Requests", icon: PlusCircle },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar - Sticky */}
      <aside className="w-64 h-screen sticky top-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <MagimanagerLogo size={40} />
            <div>
              <h1 className="text-lg font-bold text-emerald-400">MagiManager</h1>
              <p className="text-xs text-slate-400">Ads Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item, index) => (
            <div key={item.id}>
              {item.divider && index > 0 && (
                <div className="my-2 border-t border-slate-800" />
              )}
              <button
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                  view === item.id
                    ? "bg-violet-500/10 text-violet-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.badge ? (
                  <span className="ml-auto bg-violet-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition text-left"
          >
            <div className="text-sm font-medium text-slate-100">{user?.name || "User"}</div>
            <div className="text-xs text-slate-500">{user?.email || "No email"}</div>
          </button>
          <a
            href={`${ABRA_URL}/admin`}
            className="w-full px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg hover:from-indigo-500/20 hover:to-purple-500/20 transition text-sm flex flex-col items-center gap-0.5"
          >
            <span className="font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              MagiManager
            </span>
            <span className="text-[10px] text-indigo-400/70">Accounts Console</span>
          </a>
          <button
            onClick={() => {
              // Redirect to local logout page which handles cookie cleanup
              window.location.href = "/logout";
            }}
            className="w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm flex flex-col items-center gap-0.5"
          >
            <span className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </span>
            <span className="text-[10px] text-slate-500">Signs out of both apps</span>
          </button>
          <div className="mt-3 text-xs text-slate-500">
            <div className="font-medium">KADABRA v{APP_VERSION}</div>
            <div className="text-slate-600">Build: {BUILD_SHA}</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              {view === "account-detail" && selectedAccountId && (
                <button
                  onClick={() => { setView("accounts"); setSelectedAccountId(null); }}
                  className="p-1 hover:bg-slate-800 rounded-lg transition text-slate-400"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
              )}
              <h1 className="text-2xl font-bold text-slate-100">
                {view === "dashboard" && "Dashboard"}
                {view === "accounts" && "My Accounts"}
                {view === "account-detail" && selectedAccountId && `MM${String(accounts.find(a => a.id === selectedAccountId)?.internalId || "").padStart(3, "0")}`}
                {view === "automations" && "Automations"}
                {view === "tools" && "Tools"}
                {view === "campaign-planner" && "Campaign Planner AI"}
                {view === "action-queue" && "Action Queue"}
                {view === "requests" && "Account Requests"}
                {view === "notifications" && "Notifications"}
              </h1>
              {view === "account-detail" && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                  <Eye className="w-3 h-3" />
                  Read-only
                </div>
              )}
              {view === "automations" && (
                <div className="flex items-center gap-1 px-2 py-1 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs text-violet-400">
                  <Eye className="w-3 h-3" />
                  Monitoring Mode
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {view === "dashboard" && "Overview of your accounts and performance"}
              {view === "accounts" && "Manage your assigned Google Ads accounts"}
              {view === "account-detail" && "View campaigns, ad groups, and ads for this account"}
              {view === "automations" && "Monitor your campaigns with intelligent rules"}
              {view === "tools" && "Utilities and integrations for account management"}
              {view === "campaign-planner" && "Create AI-powered campaign plans with keywords and ad copy"}
              {view === "action-queue" && "Copy-paste ready fixes to apply in Google Ads"}
              {view === "requests" && "Request new accounts or claim existing ones"}
              {view === "notifications" && "Stay updated with account activities and alerts"}
            </p>
          </div>

          {/* View Content */}
          {view === "dashboard" && (
            <DashboardView
              accounts={accounts}
              loading={loading}
              onAccountClick={(accountId) => {
                setSelectedAccountId(accountId);
                setView("account-detail");
              }}
              onChatAboutAccount={(account) => {
                openChatForAccount(account);
              }}
            />
          )}
          {view === "accounts" && (
            <MyAccountsView
              accounts={accounts}
              loading={loading}
              onAccountClick={(accountId) => {
                setSelectedAccountId(accountId);
                setView("account-detail");
              }}
              onChatAboutAccount={(account) => {
                openChatForAccount(account);
              }}
            />
          )}
          {view === "account-detail" && selectedAccountId && (
            <AccountDetailView
              account={accounts.find(a => a.id === selectedAccountId)!}
              onOpenAdChat={(prompt, adContext) => {
                // Create a chat window with ad context and initial prompt
                const account = accounts.find(a => a.id === selectedAccountId);
                const contextWithPrompt = `${adContext}\n\nUser Request: ${prompt}`;
                const newWindow = createChatWindow(
                  account?.id || null,
                  account?.googleCid ? `Ad Chat (${formatCid(account.googleCid)})` : "Ad Chat",
                  contextWithPrompt
                );
                setChatWindows([...chatWindows, newWindow]);
              }}
            />
          )}
          {view === "automations" && <AutomationsPlaceholder />}
          {view === "tools" && <ToolsView onNavigate={setView} />}
          {view === "campaign-planner" && (
            <CampaignPlannerView
              onBack={() => setView("tools")}
              onOpenChat={(planName, context) => {
                // Create a chat window with campaign plan context
                const newWindow = createChatWindow(null, `Plan: ${planName}`, context);
                setChatWindows([...chatWindows, newWindow]);
              }}
              onCreateAds={(campaignPlanId) => {
                // Navigate to ads image creator with the campaign plan ID
                setView("ads-image-creator");
                // Store the campaignPlanId in sessionStorage for the AdsImageCreatorView to pick up
                sessionStorage.setItem("adsImageCreator_campaignPlanId", campaignPlanId);
              }}
            />
          )}
          {view === "video-clipper" && (
            <VideoClipperView onBack={() => setView("tools")} />
          )}
          {view === "ads-image-creator" && (
            <AdsImageCreatorView onBack={() => setView("tools")} />
          )}
          {view === "action-queue" && <ActionQueueView />}
          {view === "requests" && (
            <RequestsView
              requests={requests}
              loading={loading}
              onCreateRequest={() => setShowRequestModal(true)}
            />
          )}
          {view === "notifications" && (
            <NotificationsView
              notifications={notifications}
              loading={loading}
              onMarkRead={handleMarkNotificationRead}
            />
          )}
        </div>
      </main>

      {/* Multi-Chat Window Bar (Facebook Messenger style) */}
      <ChatWindowBar
        windows={chatWindows}
        onClose={closeChatWindow}
        onMinimize={toggleMinimize}
        onSendMessage={handleSendChatMessage}
        onUpdateWindow={updateChatWindow}
        onOpenGeneralChat={openGeneralChat}
      />

      {/* Request Modal */}
      {showRequestModal && (
        <RequestModal
          onClose={() => setShowRequestModal(false)}
          onSubmit={handleCreateRequest}
        />
      )}

      {/* Profile Modal */}
      {showProfileModal && user && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
          user={{
            name: user.name || "",
            email: user.email || "",
          }}
          onUpdate={() => {
            // Refresh the session to show updated user info
            updateSession();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// ACTION QUEUE VIEW
// ============================================================================

function ActionQueueView() {
  return (
    <div className="space-y-6">
      {/* Empty State */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
        <ListChecks className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-200 mb-2">Action Queue Empty</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
          When monitoring rules detect issues, they'll queue up copy-paste ready
          fixes here that you can apply manually in Google Ads.
        </p>
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-700/30 rounded-lg text-sm text-slate-500">
            <Lock className="w-4 h-4" />
            Auto-apply actions
            <ComingSoonBadge />
          </div>
        </div>
      </div>

      {/* Feature Preview */}
      <div className="bg-gradient-to-r from-violet-500/5 to-purple-500/5 rounded-xl border border-violet-500/20 p-6">
        <h4 className="text-sm font-medium text-slate-200 mb-4">What queued actions will look like:</h4>
        <div className="space-y-3">
          {/* Sample Action Card */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 opacity-60">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-200">Reduce Budget</span>
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded-full uppercase">High Priority</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Campaign "Display - Retargeting" is overspending with low ROAS</p>

                {/* Copy-paste instruction */}
                <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-slate-500 mb-2">Change daily budget from:</p>
                  <div className="flex items-center gap-3">
                    <code className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">$150.00</code>
                    <span className="text-slate-500">→</span>
                    <code className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-400">$75.00</code>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Open in Google Ads
                  </button>
                  <button className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg">
                    Mark Complete
                  </button>
                  <button className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:text-slate-300">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Another Sample */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 opacity-60">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-200">Add Negative Keyword</span>
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full uppercase">Medium</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Search term "free trial" converting at 0% - recommend adding as negative</p>

                <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-slate-500 mb-2">Add negative keyword (exact match):</p>
                  <code className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">[free trial]</code>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Open in Google Ads
                  </button>
                  <button className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg">
                    Mark Complete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AUTOMATIONS PLACEHOLDER
// ============================================================================

function AutomationsPlaceholder() {
  const [AutomationsView, setAutomationsView] = useState<React.ComponentType<{ accountId?: string }> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("./automations-view").then((mod) => {
      setAutomationsView(() => mod.AutomationsView);
      setLoading(false);
    });
  }, []);

  if (loading || !AutomationsView) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="bg-slate-800/50 rounded-xl h-64 animate-pulse" />
      </div>
    );
  }

  return <AutomationsView />;
}

// ============================================================================
// EXPORTS FOR URL-BASED ROUTING
// ============================================================================

export {
  DashboardView,
  MyAccountsView,
  AccountDetailView,
  ToolsView,
  RequestsView,
  NotificationsView,
  RequestModal,
  ActionQueueView,
  AutomationsPlaceholder,
  CardSkeleton,
  ComingSoonBadge,
  MagimanagerLogo,
};

export type { AdAccount, Notification, AccountRequest, View };
