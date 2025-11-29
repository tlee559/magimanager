"use client";

import { useState } from "react";
import { CampaignsTab } from "./campaigns-tab";
import { AdGroupsTab } from "./ad-groups-tab";
import { AdsTab } from "./ads-tab";
import { KeywordsTab } from "./keywords-tab";
import { ChevronRight } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export type DateRange = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_14_DAYS" | "LAST_30_DAYS";
export type ActiveTab = "campaigns" | "adGroups" | "ads" | "keywords";

export interface CampaignManagerProps {
  accountId: string;
  customerId: string;
  accountName: string;
}

export interface BreadcrumbItem {
  type: "campaign" | "adGroup";
  id: string;
  name: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CampaignManager({ accountId, customerId, accountName }: CampaignManagerProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("campaigns");
  const [dateRange, setDateRange] = useState<DateRange>("LAST_7_DAYS");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedCampaignName, setSelectedCampaignName] = useState<string | null>(null);
  const [selectedAdGroupId, setSelectedAdGroupId] = useState<string | null>(null);
  const [selectedAdGroupName, setSelectedAdGroupName] = useState<string | null>(null);

  // Handle campaign drill-down
  function handleCampaignSelect(campaignId: string, campaignName: string) {
    setSelectedCampaignId(campaignId);
    setSelectedCampaignName(campaignName);
    setSelectedAdGroupId(null);
    setSelectedAdGroupName(null);
    setActiveTab("adGroups");
  }

  // Handle ad group drill-down
  function handleAdGroupSelect(adGroupId: string, adGroupName: string) {
    setSelectedAdGroupId(adGroupId);
    setSelectedAdGroupName(adGroupName);
    setActiveTab("ads");
  }

  // Handle breadcrumb navigation
  function handleBreadcrumbClick(type: "root" | "campaign" | "adGroup") {
    if (type === "root") {
      setSelectedCampaignId(null);
      setSelectedCampaignName(null);
      setSelectedAdGroupId(null);
      setSelectedAdGroupName(null);
      setActiveTab("campaigns");
    } else if (type === "campaign") {
      setSelectedAdGroupId(null);
      setSelectedAdGroupName(null);
      setActiveTab("adGroups");
    }
  }

  // Build breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = [];
  if (selectedCampaignId && selectedCampaignName) {
    breadcrumbs.push({ type: "campaign", id: selectedCampaignId, name: selectedCampaignName });
  }
  if (selectedAdGroupId && selectedAdGroupName) {
    breadcrumbs.push({ type: "adGroup", id: selectedAdGroupId, name: selectedAdGroupName });
  }

  const tabs = [
    { id: "campaigns" as const, label: "Campaigns" },
    { id: "adGroups" as const, label: "Ad Groups" },
    { id: "ads" as const, label: "Ads" },
    { id: "keywords" as const, label: "Keywords" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{accountName}</h2>
          <p className="text-sm text-slate-500">Customer ID: {customerId}</p>
        </div>
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
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-700">
        {tabs.map((tab) => (
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

      {/* Breadcrumb */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => handleBreadcrumbClick("root")}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            All Campaigns
          </button>
          {breadcrumbs.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-600" />
              {index === breadcrumbs.length - 1 ? (
                <span className="text-slate-200">{item.name}</span>
              ) : (
                <button
                  onClick={() => handleBreadcrumbClick(item.type)}
                  className="text-slate-400 hover:text-slate-200 transition"
                >
                  {item.name}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "campaigns" && (
        <CampaignsTab
          accountId={accountId}
          customerId={customerId}
          dateRange={dateRange}
          onCampaignSelect={handleCampaignSelect}
        />
      )}
      {activeTab === "adGroups" && (
        <AdGroupsTab
          accountId={accountId}
          customerId={customerId}
          dateRange={dateRange}
          campaignId={selectedCampaignId}
          onAdGroupSelect={handleAdGroupSelect}
        />
      )}
      {activeTab === "ads" && (
        <AdsTab
          accountId={accountId}
          customerId={customerId}
          dateRange={dateRange}
          campaignId={selectedCampaignId}
          adGroupId={selectedAdGroupId}
        />
      )}
      {activeTab === "keywords" && (
        <KeywordsTab
          accountId={accountId}
          customerId={customerId}
          dateRange={dateRange}
          campaignId={selectedCampaignId}
          adGroupId={selectedAdGroupId}
        />
      )}
    </div>
  );
}
