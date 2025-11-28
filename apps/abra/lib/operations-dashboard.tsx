"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Skeleton,
  SkeletonOperationsTable,
  SkeletonAlertCards,
  SkeletonCheckInHistory,
  SkeletonTimeline,
} from "@/lib/skeleton-loaders";

// ============================================================================
// TYPES
// ============================================================================

type AccountHealth = "active" | "limited" | "suspended" | "banned" | "unknown";
type BillingStatus = "verified" | "pending" | "failed";
type CertStatus = "pending" | "verified" | "errored" | "suspended" | null;
type AlertPriority = "critical" | "warning" | "info";

type CheckIn = {
  id: string;
  adAccountId: string;
  dailySpend: number;
  totalSpend: number;
  adsCount: number;
  campaignsCount: number;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  issues: string | null;
  notes: string | null;
  checkedAt: string;
  checkedBy: string | null;
};

type Activity = {
  id: string;
  adAccountId: string;
  action: string;
  details: string | null;
  createdAt: string;
  createdBy: string | null;
};

type OperationsAccount = {
  id: string;
  googleCid: string | null;
  status: string;
  warmupTargetSpend: number;
  currentSpendTotal: number;
  adsCount: number;
  campaignsCount: number;
  mccId: string | null;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  ipSetup: string | null;
  emailSetup: string | null;
  adsAcctSetup: string | null;
  siteType: string | null;
  appealKeywords: string | null;
  handoffStatus: string;
  mediaBuyerId: string | null;
  createdAt: string;
  identityProfile: {
    id: string;
    fullName: string;
    geo: string;
    email: string | null;
    phone: string | null;
    website: string | null;
  };
  mediaBuyer?: {
    id: string;
    name: string;
  } | null;
  checkIns?: CheckIn[];
  activities?: Activity[];
};

type AlertType = "suspended" | "banned" | "billing_failed" | "limited" | "no_checkin" | "cert_error" | "ready_handoff";

type NeedsAttentionAccount = {
  id: string;
  googleCid: string | null;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  currentSpendTotal: number;
  warmupTargetSpend: number;
  handoffStatus: string;
  identityProfile: {
    id: string;
    fullName: string;
    geo: string;
  };
  lastCheckIn: string | null;
  alertPriority: AlertPriority;
  alertReason: string;
  alertType: AlertType;
  daysSinceCheckIn: number | null;
};

type CheckInFormData = {
  dailySpend: number;
  totalSpend: number;
  adsCount: number;
  campaignsCount: number;
  accountHealth: AccountHealth;
  billingStatus: BillingStatus;
  certStatus: CertStatus;
  issues: string;
  notes: string;
};

// Issue presets for quick selection
const ISSUE_PRESETS = [
  { label: "Cert Error", value: "Cert Error", suggestHealth: "limited" as AccountHealth },
  { label: "Billing Failed", value: "Billing Failed", suggestHealth: "limited" as AccountHealth },
  { label: "Gmail Suspended", value: "Gmail Suspended", suggestHealth: "suspended" as AccountHealth },
  { label: "Cloaking Flag", value: "Cloaking Flag", suggestHealth: "suspended" as AccountHealth },
  { label: "Appeal Denied", value: "Appeal Denied", suggestHealth: "banned" as AccountHealth },
  { label: "Under Review", value: "Under Review", suggestHealth: "limited" as AccountHealth },
  { label: "Policy Violation", value: "Policy Violation", suggestHealth: "suspended" as AccountHealth },
  { label: "Custom...", value: "", suggestHealth: null },
];

// ============================================================================
// NEEDS ATTENTION SECTION
// ============================================================================

function NeedsAttentionSection({
  onCheckIn,
  onRefresh,
}: {
  onCheckIn: (account: NeedsAttentionAccount) => void;
  onRefresh: () => void;
}) {
  const [accounts, setAccounts] = useState<NeedsAttentionAccount[]>([]);
  const [summary, setSummary] = useState({ total: 0, critical: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchNeedsAttention();
  }, []);

  async function fetchNeedsAttention() {
    try {
      const res = await fetch("/api/accounts/needs-attention");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setSummary(data.summary || { total: 0, critical: 0, warning: 0, info: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch needs attention:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <SkeletonAlertCards count={2} />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-700/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div className="text-emerald-400 font-medium">All Clear</div>
            <div className="text-sm text-slate-400">No accounts need immediate attention</div>
          </div>
        </div>
      </div>
    );
  }

  const getPriorityIcon = (priority: AlertPriority) => {
    switch (priority) {
      case "critical":
        return (
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        );
      case "warning":
        return (
          <div className="w-2 h-2 rounded-full bg-amber-500" />
        );
      case "info":
        return (
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        );
    }
  };

  const getPriorityBg = (priority: AlertPriority) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/10 border-red-500/30 hover:bg-red-500/20";
      case "warning":
        return "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20";
      case "info":
        return "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20";
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold text-white">Needs Attention</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {summary.critical > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                {summary.critical} critical
              </span>
            )}
            {summary.warning > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                {summary.warning} warning
              </span>
            )}
            {summary.info > 0 && (
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                {summary.info} info
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchNeedsAttention();
              onRefresh();
            }}
            className="px-2 py-1 text-xs text-slate-400 hover:text-white transition"
          >
            Refresh
          </button>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {accounts.slice(0, 10).map((account) => (
            <div
              key={account.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition ${getPriorityBg(account.alertPriority)}`}
            >
              <div className="flex items-center gap-3">
                {getPriorityIcon(account.alertPriority)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {account.googleCid || account.identityProfile.fullName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {account.identityProfile.geo}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {account.alertReason}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCheckIn(account)}
                  className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
                >
                  Check-In
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const res = await fetch("/api/accounts/alerts/dismiss", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          accountId: account.id,
                          alertType: account.alertType,
                        }),
                      });
                      if (res.ok) {
                        // Remove from local state
                        setAccounts(prev => prev.filter(a => a.id !== account.id || a.alertType !== account.alertType));
                        setSummary(prev => ({
                          ...prev,
                          total: prev.total - 1,
                          [account.alertPriority]: prev[account.alertPriority] - 1,
                        }));
                      }
                    } catch (error) {
                      console.error("Failed to dismiss alert:", error);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
                  title="Dismiss this alert"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {accounts.length > 10 && (
            <div className="text-center text-xs text-slate-500 pt-2">
              +{accounts.length - 10} more accounts need attention
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHECK-IN MODAL (Enhanced with pre-fill and presets)
// ============================================================================

function CheckInModal({
  account,
  onClose,
  onSubmit,
}: {
  account: OperationsAccount | NeedsAttentionAccount;
  onClose: () => void;
  onSubmit: (data: CheckInFormData, accountId: string) => Promise<void>;
}) {
  const [formData, setFormData] = useState<CheckInFormData>({
    dailySpend: 0,
    totalSpend: account.currentSpendTotal / 100,
    adsCount: "adsCount" in account ? account.adsCount : 0,
    campaignsCount: "campaignsCount" in account ? account.campaignsCount : 0,
    accountHealth: account.accountHealth as AccountHealth,
    billingStatus: account.billingStatus as BillingStatus,
    certStatus: (account.certStatus || null) as CertStatus,
    issues: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null);
  const [loadingLastCheckIn, setLoadingLastCheckIn] = useState(true);

  // Fetch last check-in to pre-fill
  useEffect(() => {
    async function fetchLastCheckIn() {
      try {
        const res = await fetch(`/api/accounts/${account.id}/check-in?limit=1`);
        if (res.ok) {
          const data = await res.json();
          if (data.checkIns && data.checkIns.length > 0) {
            const last = data.checkIns[0];
            setLastCheckIn(last);
            // Pre-fill with last check-in values
            setFormData(prev => ({
              ...prev,
              adsCount: last.adsCount,
              campaignsCount: last.campaignsCount,
              // Keep current status from account, not last check-in
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch last check-in:", error);
      } finally {
        setLoadingLastCheckIn(false);
      }
    }
    fetchLastCheckIn();
  }, [account.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData, account.id);
      onClose();
    } catch (error) {
      console.error("Check-in failed:", error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleIssuePreset(preset: typeof ISSUE_PRESETS[0]) {
    setFormData(prev => ({
      ...prev,
      issues: preset.value,
      ...(preset.suggestHealth && { accountHealth: preset.suggestHealth }),
    }));
  }

  function handleSameAsLast() {
    if (!lastCheckIn) return;
    setFormData(prev => ({
      ...prev,
      dailySpend: Number(lastCheckIn.dailySpend),
      adsCount: lastCheckIn.adsCount,
      campaignsCount: lastCheckIn.campaignsCount,
    }));
  }

  const accountName = "identityProfile" in account && account.identityProfile
    ? account.identityProfile.fullName
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Check-In: {account.googleCid || accountName}
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white transition rounded hover:bg-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-400">
              {accountName}
            </p>
            {lastCheckIn && (
              <span className="text-xs text-slate-500">
                - Last: {new Date(lastCheckIn.checkedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick Actions */}
          {lastCheckIn && !loadingLastCheckIn && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSameAsLast}
                className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition"
              >
                Same as last (${Number(lastCheckIn.dailySpend).toFixed(0)} daily)
              </button>
            </div>
          )}

          {/* Spend Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Daily Spend ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.dailySpend}
                onChange={(e) => setFormData({ ...formData, dailySpend: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Total Spend ($)
                <span className="ml-1 text-slate-500">auto-updates</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={(account.currentSpendTotal / 100 + formData.dailySpend).toFixed(2)}
                readOnly
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          {/* Counts Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ads Count</label>
              <input
                type="number"
                min="0"
                value={formData.adsCount}
                onChange={(e) => setFormData({ ...formData, adsCount: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Campaigns Count</label>
              <input
                type="number"
                min="0"
                value={formData.campaignsCount}
                onChange={(e) => setFormData({ ...formData, campaignsCount: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Status Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Health</label>
              <select
                value={formData.accountHealth}
                onChange={(e) => setFormData({ ...formData, accountHealth: e.target.value as AccountHealth })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="active">Active</option>
                <option value="limited">Limited</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Billing</label>
              <select
                value={formData.billingStatus}
                onChange={(e) => setFormData({ ...formData, billingStatus: e.target.value as BillingStatus })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cert Status</label>
              <select
                value={formData.certStatus || ""}
                onChange={(e) => setFormData({ ...formData, certStatus: e.target.value ? e.target.value as CertStatus : null })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">N/A</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="errored">Errored</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Quick Issues */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Quick Issues</label>
            <div className="flex flex-wrap gap-2">
              {ISSUE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleIssuePreset(preset)}
                  className={`px-2 py-1 text-xs rounded-lg transition ${
                    formData.issues === preset.value
                      ? "bg-amber-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Issues Text */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Issues/Flags</label>
            <input
              type="text"
              value={formData.issues || ""}
              onChange={(e) => setFormData({ ...formData, issues: e.target.value })}
              placeholder="Any problems or flags..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <div className="text-xs text-slate-500">
              Press <kbd className="px-1 py-0.5 bg-slate-700 rounded">Esc</kbd> to cancel
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                {submitting ? "Saving..." : "Save Check-In"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// BULK CHECK-IN MODAL
// ============================================================================

function BulkCheckInModal({
  selectedCount,
  onClose,
  onSubmit,
}: {
  selectedCount: number;
  onClose: () => void;
  onSubmit: (data: { dailySpend?: number; accountHealth: string; billingStatus: string; notes?: string }) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    dailySpend: "",
    accountHealth: "keep",
    billingStatus: "keep",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        dailySpend: formData.dailySpend ? parseFloat(formData.dailySpend) : undefined,
        accountHealth: formData.accountHealth,
        billingStatus: formData.billingStatus,
        notes: formData.notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Bulk check-in failed:", error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-md border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Bulk Check-In
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white transition rounded hover:bg-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Apply to {selectedCount} selected accounts
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Daily Spend ($) <span className="text-slate-500">- leave empty to skip</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.dailySpend}
              onChange={(e) => setFormData({ ...formData, dailySpend: e.target.value })}
              placeholder="Same for all selected"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Health Status</label>
            <select
              value={formData.accountHealth}
              onChange={(e) => setFormData({ ...formData, accountHealth: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="keep">Keep Current</option>
              <option value="active">Set All to Active</option>
              <option value="limited">Set All to Limited</option>
              <option value="suspended">Set All to Suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Billing Status</label>
            <select
              value={formData.billingStatus}
              onChange={(e) => setFormData({ ...formData, billingStatus: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="keep">Keep Current</option>
              <option value="verified">Set All to Verified</option>
              <option value="pending">Set All to Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add note to all check-ins..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {submitting ? "Applying..." : `Apply to ${selectedCount} Accounts`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// KEYBOARD SHORTCUTS HELP
// ============================================================================

function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: "j / k", action: "Move selection down/up" },
    { key: "c", action: "Open check-in for selected row" },
    { key: "a", action: "Set selected to Active" },
    { key: "l", action: "Set selected to Limited" },
    { key: "s", action: "Set selected to Suspended" },
    { key: "Space", action: "Toggle row selection (for bulk)" },
    { key: "Shift + A", action: "Select all accounts" },
    { key: "Enter", action: "Open detail panel" },
    { key: "Esc", action: "Close modal/panel" },
    { key: "/", action: "Focus search" },
    { key: "r", action: "Refresh data" },
    { key: "?", action: "Show this help" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-md border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-2">
            {shortcuts.map(({ key, action }) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{action}</span>
                <kbd className="px-2 py-1 bg-slate-800 rounded text-slate-300 font-mono text-xs">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DETAIL SLIDE-OUT PANEL
// ============================================================================

function DetailPanel({
  account,
  onClose,
  onCheckIn,
  onAddActivity,
}: {
  account: OperationsAccount;
  onClose: () => void;
  onCheckIn: () => void;
  onAddActivity: (action: string, details: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "credentials" | "billing" | "timeline">("overview");
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quick action state
  const [quickAction, setQuickAction] = useState("");
  const [quickDetails, setQuickDetails] = useState("");
  const [addingActivity, setAddingActivity] = useState(false);

  useEffect(() => {
    if (activeTab === "timeline") {
      fetchHistory();
    }
  }, [activeTab, account.id]);

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const [checkInRes, activityRes] = await Promise.all([
        fetch(`/api/accounts/${account.id}/check-in?limit=10`),
        fetch(`/api/accounts/${account.id}/activity?limit=20`),
      ]);

      if (checkInRes.ok) {
        const data = await checkInRes.json();
        setCheckIns(data.checkIns || []);
      }
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleAddQuickActivity() {
    if (!quickAction) return;
    setAddingActivity(true);
    try {
      await onAddActivity(quickAction, quickDetails);
      setQuickAction("");
      setQuickDetails("");
      fetchHistory();
    } finally {
      setAddingActivity(false);
    }
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "credentials", label: "Credentials" },
    { id: "billing", label: "Billing" },
    { id: "timeline", label: "Timeline" },
  ] as const;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {account.googleCid || "No CID"}
          </h3>
          <p className="text-sm text-slate-400">
            {account.identityProfile.fullName} - {account.identityProfile.geo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCheckIn}
            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition"
          >
            Check-In
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-slate-700">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm border-b-2 transition ${
                activeTab === tab.id
                  ? "border-emerald-500 text-white"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Health</div>
                <div className={`text-lg font-semibold ${getHealthColor(account.accountHealth)}`}>
                  {account.accountHealth}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Billing</div>
                <div className={`text-lg font-semibold ${getBillingColor(account.billingStatus)}`}>
                  {account.billingStatus}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Total Spend</div>
                <div className="text-lg font-semibold text-white">
                  ${(account.currentSpendTotal / 100).toFixed(2)}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Cert Status</div>
                <div className={`text-lg font-semibold ${getCertColor(account.certStatus)}`}>
                  {account.certStatus || "N/A"}
                </div>
              </div>
            </div>

            {/* Setup Info */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Setup Configuration</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-400">IP Setup:</span>
                  <span className="ml-2 text-white">{account.ipSetup || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400">Email Setup:</span>
                  <span className="ml-2 text-white">{account.emailSetup || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400">Ads Acct:</span>
                  <span className="ml-2 text-white">{account.adsAcctSetup || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400">Site Type:</span>
                  <span className="ml-2 text-white">{account.siteType || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400">MCC ID:</span>
                  <span className="ml-2 text-white">{account.mccId || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400">Google CID:</span>
                  <span className="ml-2 text-white">{account.googleCid || "—"}</span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Current Metrics</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{account.adsCount}</div>
                  <div className="text-xs text-slate-400">Ads</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{account.campaignsCount}</div>
                  <div className="text-xs text-slate-400">Campaigns</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-400">
                    ${(account.currentSpendTotal / 100).toFixed(0)}
                  </div>
                  <div className="text-xs text-slate-400">Spend</div>
                </div>
              </div>
            </div>

            {/* Appeal Keywords */}
            {account.appealKeywords && (
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-2">Appeal Keywords</h4>
                <p className="text-sm text-slate-300">{account.appealKeywords}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "credentials" && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Identity Credentials</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-white font-mono">{account.identityProfile.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="text-white font-mono">{account.identityProfile.phone || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Website:</span>
                  <span className="text-white">{account.identityProfile.website || "—"}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 italic">
              Full credentials are stored encrypted. Edit in Identity details.
            </p>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Billing Information</h4>
              <p className="text-sm text-slate-400">
                Billing details are stored encrypted in the database.
                View/edit in account settings.
              </p>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-4">
            {/* Quick Add Activity */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Add Activity</h4>
              <div className="flex gap-2">
                <select
                  value={quickAction}
                  onChange={(e) => setQuickAction(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="">Select action...</option>
                  <option value="GMAIL_SUS">Gmail Suspended</option>
                  <option value="GMAIL_RESTORED">Gmail Restored</option>
                  <option value="CERT_SUBMITTED">Cert Submitted</option>
                  <option value="CERT_APPROVED">Cert Approved</option>
                  <option value="CERT_DENIED">Cert Denied</option>
                  <option value="APPEAL_SUBMITTED">Appeal Submitted</option>
                  <option value="APPEAL_APPROVED">Appeal Approved</option>
                  <option value="APPEAL_DENIED">Appeal Denied</option>
                  <option value="SUSPENDED">Account Suspended</option>
                  <option value="BANNED">Account Banned</option>
                  <option value="REINSTATED">Account Reinstated</option>
                  <option value="NOTE_ADDED">Note Added</option>
                </select>
                <button
                  onClick={handleAddQuickActivity}
                  disabled={!quickAction || addingActivity}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-50 transition"
                >
                  Add
                </button>
              </div>
              {quickAction && (
                <input
                  type="text"
                  value={quickDetails}
                  onChange={(e) => setQuickDetails(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full mt-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                />
              )}
            </div>

            {/* Recent Check-ins */}
            <div>
              <h4 className="text-sm font-medium text-white mb-2">Recent Check-ins</h4>
              {loadingHistory ? (
                <SkeletonCheckInHistory />
              ) : checkIns.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No check-ins yet</div>
              ) : (
                <div className="space-y-2">
                  {checkIns.slice(0, 5).map((ci) => (
                    <div key={ci.id} className="bg-slate-800 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-white">${Number(ci.dailySpend).toFixed(2)} daily</span>
                          <span className="text-slate-400 mx-2">|</span>
                          <span className={getHealthColor(ci.accountHealth)}>{ci.accountHealth}</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(ci.checkedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {ci.issues && (
                        <div className="text-xs text-amber-400 mt-1">{ci.issues}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div>
              <h4 className="text-sm font-medium text-white mb-2">Activity Timeline</h4>
              {loadingHistory ? (
                <SkeletonTimeline />
              ) : activities.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No activity recorded</div>
              ) : (
                <div className="space-y-2">
                  {activities.map((act) => (
                    <div key={act.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-white font-medium">{act.action.replace(/_/g, " ")}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(act.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {act.details && (
                          <div className="text-slate-400 text-xs mt-0.5">{act.details}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getHealthColor(health: string): string {
  switch (health) {
    case "active": return "text-emerald-400";
    case "limited": return "text-amber-400";
    case "suspended": return "text-orange-400";
    case "banned": return "text-red-400";
    default: return "text-slate-400";
  }
}

function getBillingColor(status: string): string {
  switch (status) {
    case "verified": return "text-emerald-400";
    case "pending": return "text-amber-400";
    case "failed": return "text-red-400";
    default: return "text-slate-400";
  }
}

function getCertColor(status: string | null): string {
  switch (status) {
    case "verified": return "text-emerald-400";
    case "pending": return "text-amber-400";
    case "errored": return "text-red-400";
    case "suspended": return "text-orange-400";
    default: return "text-slate-400";
  }
}

function getHealthBadge(health: string) {
  const colors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400",
    limited: "bg-amber-500/20 text-amber-400",
    suspended: "bg-orange-500/20 text-orange-400",
    banned: "bg-red-500/20 text-red-400",
    unknown: "bg-slate-500/20 text-slate-400",
  };
  return colors[health] || colors.unknown;
}

function getBillingBadge(status: string) {
  const colors: Record<string, string> = {
    verified: "bg-emerald-500/20 text-emerald-400",
    pending: "bg-amber-500/20 text-amber-400",
    failed: "bg-red-500/20 text-red-400",
  };
  return colors[status] || colors.pending;
}

// ============================================================================
// QUICK STATUS BUTTONS
// ============================================================================

function QuickStatusButtons({
  account,
  onStatusChange,
}: {
  account: OperationsAccount;
  onStatusChange: (accountId: string, newHealth: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleClick(health: string) {
    if (account.accountHealth === health) return;
    setUpdating(health);
    try {
      await onStatusChange(account.id, health);
    } finally {
      setUpdating(null);
    }
  }

  const buttons = [
    { key: "active", label: "A", color: "bg-emerald-600 hover:bg-emerald-500", activeColor: "bg-emerald-500 ring-2 ring-emerald-400" },
    { key: "limited", label: "L", color: "bg-amber-600 hover:bg-amber-500", activeColor: "bg-amber-500 ring-2 ring-amber-400" },
    { key: "suspended", label: "S", color: "bg-orange-600 hover:bg-orange-500", activeColor: "bg-orange-500 ring-2 ring-orange-400" },
    { key: "banned", label: "B", color: "bg-red-600 hover:bg-red-500", activeColor: "bg-red-500 ring-2 ring-red-400" },
  ];

  return (
    <div className="flex gap-1">
      {buttons.map((btn) => (
        <button
          key={btn.key}
          onClick={(e) => {
            e.stopPropagation();
            handleClick(btn.key);
          }}
          disabled={updating !== null}
          className={`w-6 h-6 rounded text-xs font-bold text-white transition ${
            account.accountHealth === btn.key ? btn.activeColor : btn.color
          } ${updating === btn.key ? "opacity-50" : ""}`}
          title={`Set to ${btn.key}`}
        >
          {updating === btn.key ? "..." : btn.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN OPERATIONS DASHBOARD
// ============================================================================

type OperationsDashboardProps = {
  onDataChange?: () => void; // Called when data is mutated (check-ins, status changes)
};

export function OperationsDashboard({ onDataChange }: OperationsDashboardProps = {}) {
  const [accounts, setAccounts] = useState<OperationsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<OperationsAccount | null>(null);
  const [checkInAccount, setCheckInAccount] = useState<OperationsAccount | NeedsAttentionAccount | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkCheckIn, setShowBulkCheckIn] = useState(false);

  // Filters
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts?include=identity,checkins");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (healthFilter !== "all" && account.accountHealth !== healthFilter) return false;
      if (billingFilter !== "all" && account.billingStatus !== billingFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !account.googleCid?.toLowerCase().includes(query) &&
          !account.identityProfile.fullName.toLowerCase().includes(query) &&
          !account.identityProfile.email?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [accounts, healthFilter, billingFilter, searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't handle if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // Close modals on Escape
      if (e.key === "Escape") {
        if (checkInAccount) {
          setCheckInAccount(null);
          return;
        }
        if (selectedAccount) {
          setSelectedAccount(null);
          return;
        }
        if (showBulkCheckIn) {
          setShowBulkCheckIn(false);
          return;
        }
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
          return;
        }
      }

      // Show keyboard help
      if (e.key === "?") {
        setShowKeyboardHelp(true);
        return;
      }

      // Focus search
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Refresh
      if (e.key === "r") {
        fetchAccounts();
        return;
      }

      // Navigation
      const filteredLength = filteredAccounts.length;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filteredLength - 1));
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      // Actions on focused row
      if (focusedIndex >= 0 && focusedIndex < filteredLength) {
        const focusedAccount = filteredAccounts[focusedIndex];

        // Open check-in
        if (e.key === "c") {
          setCheckInAccount(focusedAccount);
          return;
        }

        // Open detail panel
        if (e.key === "Enter") {
          setSelectedAccount(focusedAccount);
          return;
        }

        // Toggle selection
        if (e.key === " ") {
          e.preventDefault();
          toggleSelection(focusedAccount.id);
          return;
        }

        // Quick status changes
        if (e.key === "a" && !e.shiftKey) {
          handleQuickStatusChange(focusedAccount.id, "active");
          return;
        }
        if (e.key === "l") {
          handleQuickStatusChange(focusedAccount.id, "limited");
          return;
        }
        if (e.key === "s") {
          handleQuickStatusChange(focusedAccount.id, "suspended");
          return;
        }
      }

      // Select all
      if (e.key === "A" && e.shiftKey) {
        e.preventDefault();
        setSelectedIds(new Set(filteredAccounts.map((a) => a.id)));
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredAccounts, focusedIndex, checkInAccount, selectedAccount, showBulkCheckIn, showKeyboardHelp, fetchAccounts]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredAccounts.map((a) => a.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  async function handleCheckIn(data: CheckInFormData, accountId: string) {
    const res = await fetch(`/api/accounts/${accountId}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error("Failed to save check-in");
    }

    // Update local state if status changed
    if (data.accountHealth) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? { ...a, accountHealth: data.accountHealth, currentSpendTotal: a.currentSpendTotal + Math.round(data.dailySpend * 100) }
            : a
        )
      );
    }

    // Refresh accounts
    fetchAccounts();
  }

  async function handleBulkCheckIn(data: { dailySpend?: number; accountHealth: string; billingStatus: string; notes?: string }) {
    const res = await fetch("/api/accounts/bulk-check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountIds: Array.from(selectedIds),
        ...data,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to perform bulk check-in");
    }

    // Clear selection and refresh
    setSelectedIds(new Set());
    fetchAccounts();
  }

  async function handleQuickStatusChange(accountId: string, newHealth: string) {
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountHealth: newHealth }),
    });

    if (res.ok) {
      // Update local state
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, accountHealth: newHealth } : a))
      );

      // Log activity
      await fetch(`/api/accounts/${accountId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "STATUS_CHANGED",
          details: `Health changed to ${newHealth}`,
        }),
      });
    }
  }

  async function handleAddActivity(action: string, details: string) {
    if (!selectedAccount) return;

    await fetch(`/api/accounts/${selectedAccount.id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, details: details || null }),
    });
  }

  // Summary stats
  const stats = {
    total: accounts.length,
    active: accounts.filter(a => a.accountHealth === "active").length,
    limited: accounts.filter(a => a.accountHealth === "limited").length,
    suspended: accounts.filter(a => a.accountHealth === "suspended" || a.accountHealth === "banned").length,
    pendingBilling: accounts.filter(a => a.billingStatus === "pending").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Operations Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Spreadsheet-style view for daily account monitoring
          </p>
        </div>
        <button
          onClick={() => setShowKeyboardHelp(true)}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
        >
          <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">?</kbd>
          <span>Shortcuts</span>
        </button>
      </div>

      {/* Needs Attention Section */}
      <NeedsAttentionSection
        onCheckIn={(account) => setCheckInAccount(account)}
        onRefresh={fetchAccounts}
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          {loading ? (
            <div className="h-8 w-12 bg-slate-700 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          )}
          <div className="text-xs text-slate-400">Total Accounts</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          {loading ? (
            <div className="h-8 w-12 bg-slate-700 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-emerald-400">{stats.active}</div>
          )}
          <div className="text-xs text-slate-400">Active</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          {loading ? (
            <div className="h-8 w-12 bg-slate-700 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-amber-400">{stats.limited}</div>
          )}
          <div className="text-xs text-slate-400">Limited</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          {loading ? (
            <div className="h-8 w-12 bg-slate-700 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-red-400">{stats.suspended}</div>
          )}
          <div className="text-xs text-slate-400">Suspended/Banned</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          {loading ? (
            <div className="h-8 w-12 bg-slate-700 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-amber-400">{stats.pendingBilling}</div>
          )}
          <div className="text-xs text-slate-400">Pending Billing</div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-emerald-400 font-medium">
              {selectedIds.size} account{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={selectNone}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Clear selection
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkCheckIn(true)}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition"
            >
              Bulk Check-In
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by CID, name, or email... (press /)"
          className="flex-1 max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Health</option>
          <option value="active">Active</option>
          <option value="limited">Limited</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="unknown">Unknown</option>
        </select>
        <select
          value={billingFilter}
          onChange={(e) => setBillingFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Billing</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <div className="flex-1" />
        <div className="flex gap-2">
          {filteredAccounts.length > 0 && (
            <button
              onClick={selectedIds.size === filteredAccounts.length ? selectNone : selectAll}
              className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition"
            >
              {selectedIds.size === filteredAccounts.length ? "Deselect All" : "Select All"}
            </button>
          )}
          <button
            onClick={() => window.open("/api/reports?type=daily&format=csv", "_blank")}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition flex items-center gap-2"
          >
            <span>Daily CSV</span>
          </button>
          <button
            onClick={() => window.open("/api/reports?type=weekly&format=csv", "_blank")}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition flex items-center gap-2"
          >
            <span>Weekly CSV</span>
          </button>
          <button
            onClick={fetchAccounts}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonOperationsTable />
      ) : filteredAccounts.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No accounts found</div>
      ) : (
        <div ref={tableRef} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="pb-3 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredAccounts.length && filteredAccounts.length > 0}
                    onChange={() => selectedIds.size === filteredAccounts.length ? selectNone() : selectAll()}
                    className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                </th>
                <th className="pb-3 pr-4 font-medium">ACCT / NAME</th>
                <th className="pb-3 px-4 font-medium">GEO</th>
                <th className="pb-3 px-4 font-medium">HEALTH</th>
                <th className="pb-3 px-4 font-medium">BILLING</th>
                <th className="pb-3 px-4 font-medium">CERT</th>
                <th className="pb-3 px-4 font-medium text-right">SPEND</th>
                <th className="pb-3 px-4 font-medium text-center">ADS</th>
                <th className="pb-3 px-4 font-medium">QUICK STATUS</th>
                <th className="pb-3 pl-4 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredAccounts.map((account, index) => (
                <tr
                  key={account.id}
                  className={`transition cursor-pointer ${
                    focusedIndex === index
                      ? "bg-emerald-900/20 ring-1 ring-emerald-500/50"
                      : selectedIds.has(account.id)
                      ? "bg-slate-800/70"
                      : "hover:bg-slate-800/50"
                  }`}
                  onClick={() => setSelectedAccount(account)}
                >
                  <td className="py-3 pr-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(account.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(account.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-white">
                      {account.googleCid || "No CID"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {account.identityProfile.fullName}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-300">{account.identityProfile.geo}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${getHealthBadge(account.accountHealth)}`}>
                      {account.accountHealth}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${getBillingBadge(account.billingStatus)}`}>
                      {account.billingStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs ${getCertColor(account.certStatus)}`}>
                      {account.certStatus || "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-white font-mono">
                      ${(account.currentSpendTotal / 100).toFixed(0)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-slate-300">{account.adsCount}</span>
                  </td>
                  <td className="py-3 px-4">
                    <QuickStatusButtons
                      account={account}
                      onStatusChange={handleQuickStatusChange}
                    />
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCheckInAccount(account);
                      }}
                      className="px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 transition"
                    >
                      Check-In
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Check-In Modal */}
      {checkInAccount && (
        <CheckInModal
          account={checkInAccount}
          onClose={() => setCheckInAccount(null)}
          onSubmit={handleCheckIn}
        />
      )}

      {/* Bulk Check-In Modal */}
      {showBulkCheckIn && (
        <BulkCheckInModal
          selectedCount={selectedIds.size}
          onClose={() => setShowBulkCheckIn(false)}
          onSubmit={handleBulkCheckIn}
        />
      )}

      {/* Detail Panel */}
      {selectedAccount && (
        <DetailPanel
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onCheckIn={() => {
            setCheckInAccount(selectedAccount);
          }}
          onAddActivity={handleAddActivity}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      {showKeyboardHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowKeyboardHelp(false)} />
      )}
    </div>
  );
}
