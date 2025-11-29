"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Settings,
  DollarSign,
  Target,
  TrendingUp,
  Calendar,
  Info,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { formatCost } from "@magimanager/shared";
import type { Campaign, BiddingStrategy } from "@magimanager/shared";

// ============================================================================
// HELPERS
// ============================================================================

function getBiddingStrategyLabel(strategy: BiddingStrategy): string {
  switch (strategy) {
    case "MANUAL_CPC": return "Manual CPC";
    case "MAXIMIZE_CLICKS": return "Maximize Clicks";
    case "MAXIMIZE_CONVERSIONS": return "Maximize Conversions";
    case "MAXIMIZE_CONVERSION_VALUE": return "Maximize Conversion Value";
    case "TARGET_CPA": return "Target CPA";
    case "TARGET_ROAS": return "Target ROAS";
    case "TARGET_IMPRESSION_SHARE": return "Target Impression Share";
    case "ENHANCED_CPC": return "Enhanced CPC";
    default: return strategy;
  }
}

// ============================================================================
// VIEW-ONLY FIELD COMPONENT
// ============================================================================

interface ViewOnlyFieldProps {
  label: string;
  value: string | number | undefined;
  format?: "currency" | "percentage" | "text" | "date";
  tooltip?: string;
  icon?: React.ReactNode;
}

function ViewOnlyField({ label, value, format = "text", tooltip, icon }: ViewOnlyFieldProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const formattedValue = (() => {
    if (value === undefined || value === null || value === "") return "Not set";
    switch (format) {
      case "currency":
        return formatCost(value as number);
      case "percentage":
        return `${(value as number * 100).toFixed(0)}%`;
      case "date":
        return value as string;
      default:
        return String(value);
    }
  })();

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-400 mb-2">
        {label}
      </label>
      <div className="relative">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400">
              {icon}
            </div>
          )}
          <input
            type="text"
            value={formattedValue}
            readOnly
            disabled
            className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 cursor-not-allowed opacity-70"
          />
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400 cursor-help">
              <Lock className="w-3 h-3" />
              View Only
            </div>

            {/* Tooltip */}
            {showTooltip && tooltip && (
              <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-50">
                <div className="text-xs text-slate-200">{tooltip}</div>
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-8 border-transparent border-t-slate-700" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION COMPONENT
// ============================================================================

interface SectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, description, icon, children }: SectionProps) {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center gap-3">
          {icon && <div className="text-violet-400">{icon}</div>}
          <div>
            <h3 className="text-sm font-medium text-slate-200">{title}</h3>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE CONTENT
// ============================================================================

function SettingsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const campaignId = params.campaignId as string;
  const dateRange = searchParams.get("dateRange") || "LAST_7_DAYS";
  const accountId = searchParams.get("accountId");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch campaign details
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

        // Fetch campaigns and find the one we need
        const res = await fetch(
          `/api/campaigns?accountId=${accountId}&customerId=${customerId}&dateRange=${dateRange}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch campaign");
        }

        const data = await res.json();
        const foundCampaign = data.campaigns?.find((c: Campaign) => c.id === campaignId);

        if (!foundCampaign) {
          throw new Error("Campaign not found");
        }

        setCampaign(foundCampaign);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load campaign");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [campaignId, dateRange, accountId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <div className="text-red-400 mb-2">Failed to load campaign settings</div>
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
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/campaigns/${campaignId}/ad-groups?dateRange=${dateRange}${accountId ? `&accountId=${accountId}` : ""}`}
          className="p-2 hover:bg-slate-800 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{campaign.name}</h2>
          <p className="text-sm text-slate-500">Campaign Settings (View Only)</p>
        </div>
      </div>

      {/* Write Access Banner */}
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-violet-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-slate-200">View-Only Mode</h4>
            <p className="text-xs text-slate-400 mt-1">
              Editing campaign settings requires Google Ads API write access, which is coming soon.
              For now, you can view all settings but changes must be made directly in Google Ads.
            </p>
          </div>
        </div>
      </div>

      {/* Budget & Bidding Section */}
      <Section
        title="Budget & Bidding"
        description="Daily budget and bidding strategy settings"
        icon={<DollarSign className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ViewOnlyField
            label="Daily Budget"
            value={campaign.budgetAmount}
            format="currency"
            icon={<DollarSign className="w-4 h-4" />}
            tooltip="Editing requires Google Ads API write access - Coming Soon"
          />

          <ViewOnlyField
            label="Bidding Strategy"
            value={getBiddingStrategyLabel(campaign.biddingStrategy)}
            icon={<TrendingUp className="w-4 h-4" />}
            tooltip="Editing requires Google Ads API write access - Coming Soon"
          />
        </div>
      </Section>

      {/* Target CPA & ROAS Section */}
      <Section
        title="Performance Targets"
        description="Target CPA and ROAS settings for automated bidding"
        icon={<Target className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ViewOnlyField
            label="Target CPA"
            value={campaign.targetCpa}
            format="currency"
            icon={<Target className="w-4 h-4" />}
            tooltip="Editing requires Google Ads API write access - Coming Soon"
          />

          <ViewOnlyField
            label="Target ROAS"
            value={campaign.targetRoas}
            format="percentage"
            icon={<TrendingUp className="w-4 h-4" />}
            tooltip="Editing requires Google Ads API write access - Coming Soon"
          />
        </div>

        {/* Explanation */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <h5 className="text-xs font-medium text-slate-300 mb-2">How Targets Work</h5>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>
              <strong className="text-slate-400">Target CPA:</strong> Google will try to get you conversions at or below this cost
            </li>
            <li>
              <strong className="text-slate-400">Target ROAS:</strong> Google will try to maximize conversion value while maintaining this return on ad spend
            </li>
          </ul>
        </div>
      </Section>

      {/* Schedule Section */}
      <Section
        title="Campaign Schedule"
        description="Start and end dates for the campaign"
        icon={<Calendar className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ViewOnlyField
            label="Start Date"
            value={campaign.startDate}
            format="date"
            icon={<Calendar className="w-4 h-4" />}
            tooltip="Editing requires Google Ads API write access - Coming Soon"
          />

          <ViewOnlyField
            label="End Date"
            value={campaign.endDate || "No end date (ongoing)"}
            format="text"
            icon={<Calendar className="w-4 h-4" />}
            tooltip="Editing requires Google Ads API write access - Coming Soon"
          />
        </div>
      </Section>

      {/* Campaign Details Section */}
      <Section
        title="Campaign Details"
        description="Basic campaign information"
        icon={<Settings className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ViewOnlyField
            label="Campaign ID"
            value={campaign.id}
          />

          <ViewOnlyField
            label="Campaign Type"
            value={campaign.type}
          />

          <ViewOnlyField
            label="Status"
            value={campaign.status}
          />

          <ViewOnlyField
            label="Budget Name"
            value={campaign.budgetName || "Unnamed Budget"}
          />
        </div>
      </Section>

      {/* Current Performance Summary */}
      <Section
        title="Performance Summary"
        description={`Metrics for the selected date range`}
        icon={<TrendingUp className="w-5 h-5" />}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="text-xs text-slate-500 mb-1">Spend</div>
            <div className="text-lg font-semibold text-slate-100">{formatCost(campaign.cost)}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="text-xs text-slate-500 mb-1">Clicks</div>
            <div className="text-lg font-semibold text-slate-100">{campaign.clicks.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="text-xs text-slate-500 mb-1">Conversions</div>
            <div className="text-lg font-semibold text-slate-100">{campaign.conversions.toFixed(1)}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="text-xs text-slate-500 mb-1">Actual CPA</div>
            <div className="text-lg font-semibold text-slate-100">
              {campaign.conversions > 0 ? formatCost(campaign.cost / campaign.conversions) : "—"}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ============================================================================
// MAIN PAGE (with Suspense wrapper)
// ============================================================================

export default function CampaignSettingsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
