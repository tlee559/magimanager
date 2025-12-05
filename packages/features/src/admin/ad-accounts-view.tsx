"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { GEO_OPTIONS, formatCid } from "@magimanager/shared";
import { AddAccountModal } from "./add-account-modal";


// ============================================================================
// TYPES
// ============================================================================

type AccountHealth = "active" | "limited" | "suspended" | "banned" | "unknown";
type BillingStatus = "not_started" | "verified" | "pending" | "failed";
type CertStatus = "pending" | "verified" | "errored" | "suspended" | null;
type AccountOrigin = "mcc-created" | "takeover";
type LifecycleStatus = "provisioned" | "warming-up" | "ready" | "handed-off";
type AlertPriority = "critical" | "warning" | "info";

type CheckIn = {
  id: string;
  adAccountId: string;
  dailySpend: number;
  totalSpend: number;
  adsCount: number;
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

type SyncStatus = "not_connected" | "syncing" | "synced" | "error";

type AdAccount = {
  id: string;
  internalId: number;
  googleCid: string | null;
  identityProfileId: string | null;
  origin: AccountOrigin;
  status: string;
  warmupTargetSpend: number;
  currentSpendTotal: number;
  todaySpend: number;
  adsCount: number;
  mccId: string | null;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  handoffStatus: string;
  mediaBuyerId: string | null;
  handoffDate: string | null;
  handoffNotes: string | null;
  notes: string | null;
  createdAt: string;
  // OAuth sync fields
  connectionType: string;
  syncStatus: SyncStatus;
  lastGoogleSyncAt: string | null;
  googleSyncError: string | null;
  googleCidVerified: boolean;
  identityProfile: {
    id: string;
    fullName: string;
    geo: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    // Billing info
    ccNumber: string | null;
    ccExp: string | null;
    ccCvv: string | null;
    ccName: string | null;
    billingZip: string | null;
    // GoLogin profile
    gologinProfile?: {
      id: string;
      profileId: string | null;
      status: string;
    } | null;
  } | null;
  mediaBuyer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  connection?: {
    id: string;
    googleEmail: string;
    status: string;
  } | null;
  checkIns?: CheckIn[];
  activities?: Activity[];
};

type Identity = {
  id: string;
  fullName: string;
  geo: string;
  email: string | null;
  adAccounts?: { id: string }[];
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
  } | null;
  lastCheckIn: string | null;
  alertPriority: AlertPriority;
  alertReason: string;
  alertType: AlertType;
  daysSinceCheckIn: number | null;
};

// Column tooltips for table headers
const COLUMN_TOOLTIPS: Record<string, string> = {
  internalId: "Internal ID number unique to this ad account.",
  account: "The Google Ads Customer ID (CID) and the identity profile name associated with this account.",
  lifecycle: "Account progression stage. Provisioned → Warming Up → Ready → Handed Off to media buyer.",
  progress: "Warmup progress toward the target spend threshold before the account is marked as ready.",
  spend: "Total amount spent on this account across all campaigns.",
  status: "Account status. A=Active, S=Suspended, P=In Appeal, U=Unknown. Click row for details.",
};

// Tooltip component for table headers
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="group relative inline-flex items-center gap-1">
      {children}
      <svg className="w-3.5 h-3.5 text-slate-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="absolute left-0 top-full mt-2 px-3 py-2 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-[100] pointer-events-none">
        {text}
        <div className="absolute bottom-full left-4 mb-0 border-4 border-transparent border-b-slate-800" />
      </div>
    </div>
  );
}

// Info icon with hover tooltip for DetailPanel fields
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tip">
      <svg className="w-3 h-3 text-slate-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-slate-700 text-slate-200 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 w-56 z-[100] pointer-events-none whitespace-normal">
        {text}
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-0 border-4 border-transparent border-r-slate-700" />
      </div>
    </span>
  );
}

// Masked credit card field with reveal toggle
function MaskedCCField({ value }: { value: string | null | undefined }) {
  const [revealed, setRevealed] = useState(false);

  if (!value) {
    return <span className="text-slate-500">—</span>;
  }

  const masked = value.replace(/\d(?=\d{4})/g, "•");

  return (
    <div className="flex items-center gap-2">
      <span className="text-white font-mono">
        {revealed ? value : masked}
      </span>
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        className="text-slate-400 hover:text-white transition"
        title={revealed ? "Hide card number" : "Show card number"}
      >
        {revealed ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getHealthColor(health: string): string {
  switch (health) {
    case "active": return "text-emerald-400";
    case "suspended": return "text-red-400";
    case "in-appeal": return "text-amber-400";
    case "unknown":
    default: return "text-slate-400";
  }
}

function getBillingColor(status: string): string {
  switch (status) {
    case "verified": return "text-emerald-400";
    case "pending": return "text-amber-400";
    case "failed": return "text-red-400";
    case "not_started": return "text-slate-500";
    default: return "text-slate-400";
  }
}

function getCertColor(status: string | null): string {
  switch (status) {
    case "verified": return "text-emerald-400";
    case "pending": return "text-amber-400";
    case "errored": return "text-red-400";
    case "suspended": return "text-orange-400";
    case "not-started": return "text-slate-500";
    default: return "text-slate-400";
  }
}

function getHealthBadge(health: string) {
  const colors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400",
    limited: "bg-amber-500/20 text-amber-400",
    suspended: "bg-orange-500/20 text-orange-400",
    "in-appeal": "bg-amber-500/20 text-amber-400",
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

function getLifecycleBadge(status: string) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    provisioned: { bg: "bg-slate-500/10", text: "text-slate-400", label: "Provisioned" },
    "warming-up": { bg: "bg-amber-500/10", text: "text-amber-400", label: "Warming Up" },
    ready: { bg: "bg-green-500/10", text: "text-green-400", label: "Ready" },
    "handed-off": { bg: "bg-blue-500/10", text: "text-blue-400", label: "Handed Off" },
  };
  const badge = badges[status] || badges.provisioned;
  return `${badge.bg} ${badge.text}`;
}

function getLifecycleLabel(status: string, handoffStatus: string) {
  if (handoffStatus === "handed-off") return "Handed Off";
  const labels: Record<string, string> = {
    provisioned: "Provisioned",
    "warming-up": "Warming Up",
    ready: "Ready",
  };
  return labels[status] || "Provisioned";
}

// ============================================================================
// NEEDS ATTENTION SECTION
// ============================================================================

function NeedsAttentionSection({
  onViewDetails,
  onRefresh,
}: {
  onViewDetails: (account: NeedsAttentionAccount) => void;
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
        <div className="text-slate-400 text-sm">Loading alerts...</div>
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
        return <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
      case "warning":
        return <div className="w-2 h-2 rounded-full bg-amber-500" />;
      case "info":
        return <div className="w-2 h-2 rounded-full bg-blue-500" />;
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
                      {formatCid(account.googleCid) || account.identityProfile?.fullName || "Unlinked"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {account.identityProfile?.geo || "—"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {account.alertReason}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewDetails(account)}
                  className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
                >
                  View
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
// KEYBOARD SHORTCUTS HELP
// ============================================================================

function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: "j / k", action: "Move selection down/up" },
    { key: "Enter", action: "Open detail panel" },
    { key: "a", action: "Set selected to Active" },
    { key: "s", action: "Set selected to Suspended" },
    { key: "u", action: "Set selected to Unknown" },
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
// QUICK STATUS BUTTONS
// ============================================================================

function QuickStatusButtons({
  account,
  onStatusChange,
}: {
  account: AdAccount;
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
    { key: "active", label: "A", activeColor: "bg-emerald-500 text-white", title: "Active" },
    { key: "suspended", label: "S", activeColor: "bg-red-500 text-white", title: "Suspended" },
    { key: "in-appeal", label: "P", activeColor: "bg-amber-500 text-white", title: "In Appeal" },
    { key: "unknown", label: "U", activeColor: "bg-slate-500 text-white", title: "Unknown" },
  ];

  return (
    <div className="flex gap-1">
      {buttons.map((btn) => {
        const isActive = account.accountHealth === btn.key;
        return (
          <button
            key={btn.key}
            onClick={(e) => {
              e.stopPropagation();
              handleClick(btn.key);
            }}
            disabled={updating !== null}
            className={`w-6 h-6 rounded text-xs font-bold transition ${
              isActive
                ? btn.activeColor
                : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300"
            } ${updating === btn.key ? "opacity-50" : ""}`}
            title={`Set to ${btn.title}`}
          >
            {updating === btn.key ? "·" : btn.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// LINK IDENTITY MODAL
// ============================================================================

function LinkIdentityModal({
  accountId,
  googleCid,
  prefillEmail,
  onClose,
  onSuccess,
}: {
  accountId: string;
  googleCid: string | null;
  prefillEmail?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<"create" | "link">("create");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create new identity state
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState(prefillEmail || "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [geo, setGeo] = useState("United States");

  // Link existing identity state
  const [identities, setIdentities] = useState<Array<{ id: string; fullName: string; geo: string; email: string | null; adAccounts?: { id: string }[] }>>([]);
  const [loadingIdentities, setLoadingIdentities] = useState(false);
  const [selectedIdentityId, setSelectedIdentityId] = useState("");
  const [identitySearch, setIdentitySearch] = useState("");

  // Fetch identities that don't have an account linked
  useEffect(() => {
    async function fetchIdentities() {
      setLoadingIdentities(true);
      try {
        const res = await fetch("/api/identities?available=true");
        if (res.ok) {
          const data = await res.json();
          setIdentities(data.identities || []);
        }
      } catch {
        console.error("Failed to fetch identities");
      } finally {
        setLoadingIdentities(false);
      }
    }
    fetchIdentities();
  }, []);

  // Filter identities: only show unassigned identities (no linked accounts) and match search
  const filteredIdentities = identities.filter(id => {
    // Only show identities that don't have an account assigned
    const isUnassigned = !id.adAccounts || id.adAccounts.length === 0;
    // Also match search term
    const matchesSearch = id.fullName.toLowerCase().includes(identitySearch.toLowerCase()) ||
      id.email?.toLowerCase().includes(identitySearch.toLowerCase());
    return isUnassigned && matchesSearch;
  });

  async function handleCreateAndLink() {
    if (!fullName || !dob || !address || !city || !state || !geo) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create identity
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("dob", dob);
      formData.append("address", address);
      formData.append("city", city);
      formData.append("state", state);
      formData.append("zipcode", zipcode);
      formData.append("geo", geo);
      if (email) {
        formData.append("email", email);
      }

      const createRes = await fetch("/api/identities", {
        method: "POST",
        body: formData,
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.error || "Failed to create identity");
      }

      const newIdentity = await createRes.json();

      // Link to account
      const linkRes = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityProfileId: newIdentity.id }),
      });

      if (!linkRes.ok) {
        throw new Error("Failed to link identity to account");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create and link identity");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkExisting() {
    if (!selectedIdentityId) {
      setError("Please select an identity");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityProfileId: selectedIdentityId }),
      });

      if (!res.ok) {
        throw new Error("Failed to link identity to account");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link identity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Link Identity</h2>
            <p className="text-sm text-slate-400">
              Account: <span className="font-mono text-cyan-400">{formatCid(googleCid) || "Unknown CID"}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              tab === "create"
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Create New Identity
          </button>
          <button
            onClick={() => setTab("link")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              tab === "link"
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Link Existing
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {tab === "create" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Email {prefillEmail && <span className="text-cyan-400 text-xs">(from Google OAuth)</span>}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@gmail.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Address *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">City *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New York"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">State *</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="NY"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Zipcode</label>
                  <input
                    type="text"
                    value={zipcode}
                    onChange={(e) => setZipcode(e.target.value)}
                    placeholder="10001"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Country *</label>
                  <select
                    value={geo}
                    onChange={(e) => setGeo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  >
                    {GEO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                * Required fields. You can add email, phone, billing info later from the Identities section.
              </p>
            </div>
          )}

          {tab === "link" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Search Identities</label>
                <input
                  type="text"
                  value={identitySearch}
                  onChange={(e) => setIdentitySearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>

              {loadingIdentities ? (
                <div className="text-center py-8 text-slate-400">Loading identities...</div>
              ) : filteredIdentities.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  {identities.length === 0
                    ? "No available identities. Create one using the other tab."
                    : "No identities match your search."}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredIdentities.map((identity) => (
                    <label
                      key={identity.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                        selectedIdentityId === identity.id
                          ? "bg-cyan-600/20 border border-cyan-600/50"
                          : "bg-slate-800 border border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="identity"
                        value={identity.id}
                        checked={selectedIdentityId === identity.id}
                        onChange={() => setSelectedIdentityId(identity.id)}
                        className="w-4 h-4 text-cyan-500 bg-slate-700 border-slate-600 focus:ring-cyan-500"
                      />
                      <div className="flex-1">
                        <div className="text-white font-medium">{identity.fullName}</div>
                        <div className="text-xs text-slate-400">
                          {identity.geo} {identity.email && `• ${identity.email}`}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={tab === "create" ? handleCreateAndLink : handleLinkExisting}
            disabled={saving || (tab === "create" && (!fullName || !dob || !address || !city || !state)) || (tab === "link" && !selectedIdentityId)}
            className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {tab === "create" ? "Creating..." : "Linking..."}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {tab === "create" ? "Create & Link" : "Link Identity"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DETAIL PANEL
// ============================================================================

function DetailPanel({
  account,
  onClose,
  onAddActivity,
  onRefresh,
  onUpdateAccount,
}: {
  account: AdAccount;
  onClose: () => void;
  onAddActivity: (action: string, details: string, spendData?: { type: string; amount: number }) => Promise<void>;
  onRefresh: () => void;
  onUpdateAccount: (accountId: string, updates: Record<string, unknown>) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "identity" | "timeline" | "thread" | "assign" | "actions">("details");
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Editable fields state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Quick log state
  const [quickAction, setQuickAction] = useState("");
  const [quickDetails, setQuickDetails] = useState("");
  const [quickValue, setQuickValue] = useState("");
  const [addingActivity, setAddingActivity] = useState(false);

  // Thread state
  const [threadMessages, setThreadMessages] = useState<Array<{
    id: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    message: string;
    createdAt: string;
    editedAt: string | null;
  }>>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");

  // Assignment state
  const [mediaBuyers, setMediaBuyers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  }>>([]);
  const [loadingMediaBuyers, setLoadingMediaBuyers] = useState(false);
  const [selectedMediaBuyerId, setSelectedMediaBuyerId] = useState<string>(account.mediaBuyerId || "");
  const [handoffNotes, setHandoffNotes] = useState(account.handoffNotes || "");
  const [assigning, setAssigning] = useState(false);

  // Actions that need a numeric value
  const needsValueActions = ["DAILY_SPEND", "ADD_SPEND", "SET_TOTAL_SPEND", "SET_ADS_COUNT", "SET_WARMUP_TARGET"];
  const isValueAction = needsValueActions.includes(quickAction);

  // Actions tab state
  const [archiving, setArchiving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [availableIdentities, setAvailableIdentities] = useState<Array<{ id: string; fullName: string; geo: string }>>([]);
  const [selectedNewIdentityId, setSelectedNewIdentityId] = useState("");
  const [linking, setLinking] = useState(false);
  const [loadingIdentities, setLoadingIdentities] = useState(false);

  // Delete account state (SUPER_ADMIN only)
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || "";
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteBlockers, setDeleteBlockers] = useState<Array<{ type: string; count: number; description: string }> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Link identity modal state
  const [showLinkIdentityModal, setShowLinkIdentityModal] = useState(false);

  useEffect(() => {
    if (activeTab === "timeline") {
      fetchHistory();
    }
    if (activeTab === "thread") {
      fetchThread();
    }
    if (activeTab === "assign") {
      fetchMediaBuyers();
    }
    if (activeTab === "actions") {
      fetchAvailableIdentities();
    }
  }, [activeTab, account.id]);

  async function fetchThread() {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}/thread`);
      if (res.ok) {
        const data = await res.json();
        setThreadMessages(data.thread?.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch thread:", error);
    } finally {
      setLoadingThread(false);
    }
  }

  async function fetchMediaBuyers() {
    setLoadingMediaBuyers(true);
    try {
      const res = await fetch("/api/media-buyers");
      if (res.ok) {
        const data = await res.json();
        setMediaBuyers(data.filter((mb: { isActive: boolean }) => mb.isActive));
      }
    } catch (error) {
      console.error("Failed to fetch media buyers:", error);
    } finally {
      setLoadingMediaBuyers(false);
    }
  }

  async function handleAssign() {
    if (!selectedMediaBuyerId) return;
    setAssigning(true);
    try {
      await onUpdateAccount(account.id, {
        mediaBuyerId: selectedMediaBuyerId,
        handoffStatus: "handed-off",
        handoffDate: new Date().toISOString(),
        handoffNotes: handoffNotes || null,
        status: "ready",
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to assign account:", error);
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    setAssigning(true);
    try {
      await onUpdateAccount(account.id, {
        mediaBuyerId: null,
        handoffStatus: "available",
        handoffDate: null,
        handoffNotes: null,
      });
      setSelectedMediaBuyerId("");
      setHandoffNotes("");
      onRefresh();
    } catch (error) {
      console.error("Failed to unassign account:", error);
    } finally {
      setAssigning(false);
    }
  }

  // Actions tab functions
  async function fetchAvailableIdentities() {
    setLoadingIdentities(true);
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        // Filter to only show identities that don't already have an ad account
        const available = (data.identities || []).filter((id: { adAccounts?: { id: string }[] }) =>
          !id.adAccounts || id.adAccounts.length === 0
        );
        setAvailableIdentities(available);
      }
    } catch (error) {
      console.error("Failed to fetch identities:", error);
    } finally {
      setLoadingIdentities(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await onUpdateAccount(account.id, {
        handoffStatus: "archived",
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to archive account:", error);
    } finally {
      setArchiving(false);
    }
  }

  async function handleUnarchive() {
    setArchiving(true);
    try {
      await onUpdateAccount(account.id, {
        handoffStatus: "available",
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to unarchive account:", error);
    } finally {
      setArchiving(false);
    }
  }

  async function handleUnlinkIdentity() {
    setUnlinking(true);
    try {
      await onUpdateAccount(account.id, {
        identityProfileId: null,
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to unlink identity:", error);
    } finally {
      setUnlinking(false);
    }
  }

  async function handleLinkIdentity() {
    if (!selectedNewIdentityId) return;
    setLinking(true);
    try {
      await onUpdateAccount(account.id, {
        identityProfileId: selectedNewIdentityId,
      });
      setSelectedNewIdentityId("");
      onRefresh();
    } catch (error) {
      console.error("Failed to link identity:", error);
    } finally {
      setLinking(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}/thread/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage("");
        fetchThread();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleEditMessage(messageId: string) {
    if (!editingMessageText.trim()) return;
    try {
      const res = await fetch(`/api/accounts/${account.id}/thread/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: editingMessageText.trim() }),
      });
      if (res.ok) {
        setEditingMessageId(null);
        setEditingMessageText("");
        fetchThread();
      }
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      const res = await fetch(`/api/accounts/${account.id}/thread/messages/${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchThread();
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  }

  async function handleDeleteAccount(forceDelete = false) {
    if (!isSuperAdmin || deleteConfirmText !== "delete") return;
    setDeleting(true);
    try {
      const url = forceDelete
        ? `/api/accounts/${account.id}?force=true`
        : `/api/accounts/${account.id}`;
      const res = await fetch(url, {
        method: "DELETE",
      });

      if (res.ok) {
        setShowDeleteConfirm(false);
        setDeleteBlockers(null);
        onClose();
        onRefresh();
      } else if (res.status === 409) {
        // Conflict - has blockers
        const data = await res.json();
        setDeleteBlockers(data.blockers || []);
        setShowDeleteConfirm(true);
      } else {
        const data = await res.json();
        alert("Failed to delete account: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to delete account:", error);
      alert("Network error while deleting account");
    } finally {
      setDeleting(false);
    }
  }

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

  async function handleQuickLog() {
    if (!quickAction) return;
    if (isValueAction && (!quickValue || parseFloat(quickValue) < 0)) return;

    setAddingActivity(true);
    try {
      const value = parseFloat(quickValue) || 0;

      // Handle different action types
      if (quickAction === "DAILY_SPEND" || quickAction === "ADD_SPEND") {
        await onAddActivity(quickAction, quickDetails, { type: quickAction, amount: value });
      } else if (quickAction === "SET_TOTAL_SPEND") {
        await onAddActivity(quickAction, quickDetails, { type: quickAction, amount: value });
      } else if (quickAction === "SET_ADS_COUNT") {
        await onUpdateAccount(account.id, { adsCount: Math.round(value) });
        await onAddActivity(quickAction, `Set ads count to ${Math.round(value)}. ${quickDetails}`.trim());
      } else if (quickAction === "SET_WARMUP_TARGET") {
        await onUpdateAccount(account.id, { warmupTargetSpend: Math.round(value) });
        await onAddActivity(quickAction, `Set warmup target to $${Math.round(value)}. ${quickDetails}`.trim());
      } else if (quickAction.startsWith("SET_HEALTH_")) {
        const health = quickAction.replace("SET_HEALTH_", "").toLowerCase();
        await onUpdateAccount(account.id, { accountHealth: health });
        await onAddActivity("STATUS_CHANGED", `Health changed to ${health}. ${quickDetails}`.trim());
      } else if (quickAction.startsWith("SET_BILLING_")) {
        const billing = quickAction.replace("SET_BILLING_", "").toLowerCase();
        await onUpdateAccount(account.id, { billingStatus: billing });
        await onAddActivity("BILLING_CHANGED", `Billing status changed to ${billing}. ${quickDetails}`.trim());
      } else if (quickAction.startsWith("SET_CERT_")) {
        const cert = quickAction.replace("SET_CERT_", "").toLowerCase();
        await onUpdateAccount(account.id, { certStatus: cert === "none" ? null : cert });
        await onAddActivity("CERT_CHANGED", `Cert status changed to ${cert}. ${quickDetails}`.trim());
      } else if (quickAction.startsWith("SET_LIFECYCLE_")) {
        const lifecycle = quickAction.replace("SET_LIFECYCLE_", "").toLowerCase();
        await onUpdateAccount(account.id, { status: lifecycle });
        await onAddActivity("LIFECYCLE_CHANGED", `Lifecycle changed to ${lifecycle}. ${quickDetails}`.trim());
      } else {
        // Regular activity log
        await onAddActivity(quickAction, quickDetails);
      }

      setQuickAction("");
      setQuickDetails("");
      setQuickValue("");
      fetchHistory();
      onRefresh();
    } finally {
      setAddingActivity(false);
    }
  }

  async function handleFieldSave(field: string, value: unknown) {
    setSaving(true);
    try {
      // Normalize googleCid - strip dashes before saving
      let normalizedValue = value;
      if (field === "googleCid" && typeof value === "string") {
        normalizedValue = value.replace(/[-\s]/g, "");
      }
      await onUpdateAccount(account.id, { [field]: normalizedValue });
      const fieldLabels: Record<string, string> = {
        googleCid: "Google CID",
        warmupTargetSpend: "Warmup target",
        currentSpendTotal: "Total spend",
        adsCount: "Ads count",
        accountHealth: "Health status",
        billingStatus: "Billing status",
        certStatus: "Cert status",
        status: "Lifecycle status",
        notes: "Notes",
        mccId: "MCC ID",
      };
      await onAddActivity("FIELD_UPDATED", `${fieldLabels[field] || field} updated`);
      onRefresh();
      setEditingField(null);
      setEditValue("");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(field: string, currentValue: string | number | null) {
    setEditingField(field);
    setEditValue(currentValue?.toString() || "");
  }

  // Tooltips for all detail panel fields
  const FIELD_TOOLTIPS: Record<string, string> = {
    // Status cards
    accountHealth: "Current account status: Active (running normally), Suspended (temporarily disabled), In Appeal (appealing suspension), or Unknown (status not verified).",
    billingStatus: "Payment method status: Not Started (no card added), Verified (working), Pending (awaiting verification), or Failed (payment issue).",
    status: "Account lifecycle stage: Provisioned (new), Warming Up (building spend history), Ready (can be assigned).",
    certStatus: "Google certification status: Not Started (not applied), Pending (awaiting review), Verified (approved), Errored (issue), Suspended.",
    // Metrics
    currentSpendTotal: "Total amount spent across all campaigns on this account (in dollars).",
    warmupTargetSpend: "Spend goal before account is considered warmed up and ready for assignment.",
    adsCount: "Number of active advertisements currently running on this account.",
    warmupProgress: "Percentage of warmup target spend achieved. Account is ready when this reaches 100%.",
    // Account info
    googleCid: "Google Ads Customer ID - the unique identifier for this account in Google Ads.",
    mccId: "Manager Account (MCC) ID that manages this account.",
    origin: "How the account was acquired. MCC Created = created through our Manager Account. Takeover = inherited from someone else.",
    notes: "Internal notes about this account for team reference.",
    // Identity fields
    fullName: "The full name used for this identity profile.",
    geo: "Geographic location/country associated with this identity.",
    email: "Gmail account associated with this identity for Google Ads access.",
    phone: "Phone number for 2FA verification on this identity.",
    website: "Website associated with this identity for ad campaigns.",
    // Assignment
    mediaBuyer: "The media buyer this account has been assigned to for management.",
  };

  function EditableField({
    field,
    label,
    value,
    type = "text",
    options,
    prefix,
    suffix,
    tooltip,
  }: {
    field: string;
    label: string;
    value: string | number | null;
    type?: "text" | "number" | "select";
    options?: { value: string; label: string }[];
    prefix?: string;
    suffix?: string;
    tooltip?: string;
  }) {
    const fieldTooltip = tooltip || FIELD_TOOLTIPS[field];
    const isEditing = editingField === field;
    const displayValue = value ?? "—";

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm w-28 flex-shrink-0">{label}:</span>
          {type === "select" && options ? (
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              autoFocus
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <div className="flex-1 flex items-center gap-1">
              {prefix && <span className="text-slate-400 text-sm">{prefix}</span>}
              <input
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                autoFocus
              />
              {suffix && <span className="text-slate-400 text-sm">{suffix}</span>}
            </div>
          )}
          <button
            onClick={() => {
              const finalValue = type === "number" ? parseFloat(editValue) || 0 : editValue;
              handleFieldSave(field, finalValue);
            }}
            disabled={saving}
            className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => { setEditingField(null); setEditValue(""); }}
            className="px-2 py-1 text-slate-400 text-xs hover:text-white"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div
        className="flex items-center justify-between group cursor-pointer hover:bg-slate-700/50 -mx-2 px-2 py-1 rounded transition relative"
        onClick={() => startEditing(field, value)}
      >
        <span className="text-slate-400 text-sm flex items-center gap-1">
          {label}:
          {fieldTooltip && <InfoTooltip text={fieldTooltip} />}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-white text-sm">
            {prefix}{typeof displayValue === "number" ? displayValue.toString() : displayValue}{suffix}
          </span>
          <svg className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
      </div>
    );
  }

  function SelectableField({
    field,
    label,
    value,
    options,
    colorFn,
    tooltip,
  }: {
    field: string;
    label: string;
    value: string | null;
    options: { value: string; label: string }[];
    colorFn?: (val: string) => string;
    tooltip?: string;
  }) {
    const fieldTooltip = tooltip || FIELD_TOOLTIPS[field];
    const isEditing = editingField === field;
    const displayValue = value || "—";
    const color = colorFn && value ? colorFn(value) : "text-white";

    if (isEditing) {
      return (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-2">{label}</div>
          <div className="flex flex-wrap gap-2">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  handleFieldSave(field, opt.value === "none" ? null : opt.value);
                }}
                disabled={saving}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${
                  (value || "none") === opt.value
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setEditingField(null)}
            className="mt-2 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div
        className="bg-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-700/80 transition group"
        onClick={() => startEditing(field, value)}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            {label}
            {fieldTooltip && <InfoTooltip text={fieldTooltip} />}
          </div>
          <svg className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <div className={`text-lg font-semibold capitalize ${color}`}>
          {displayValue}
        </div>
      </div>
    );
  }

  // Check if warmup threshold is met (spend >= target)
  const isWarmupComplete = (account.currentSpendTotal / 100) >= account.warmupTargetSpend;
  const isAlreadyAssigned = account.handoffStatus === "handed-off";

  const tabs = [
    { id: "details", label: "Details", locked: false },
    { id: "identity", label: "Identity", locked: false },
    { id: "timeline", label: "Timeline", locked: false },
    { id: "thread", label: "Thread", locked: false },
    { id: "assign", label: isAlreadyAssigned ? "Assigned" : "Assign", locked: !isWarmupComplete && !isAlreadyAssigned },
    { id: "actions", label: "Actions", locked: false },
  ] as const;

  return (
    <div className="fixed top-0 bottom-0 right-0 z-50 w-full max-w-xl bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              {formatCid(account.googleCid) || "No CID"}
            </h3>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              account.origin === "mcc-created"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-amber-500/20 text-amber-400"
            }`}>
              {account.origin === "mcc-created" ? "MCC" : "Takeover"}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            {account.identityProfile ? `${account.identityProfile.fullName} - ${account.identityProfile.geo}` : "No linked identity"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-6 border-b border-slate-700">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.locked && setActiveTab(tab.id)}
              disabled={tab.locked}
              className={`py-3 text-sm border-b-2 transition flex items-center gap-1 ${
                tab.locked
                  ? "border-transparent text-slate-600 cursor-not-allowed"
                  : activeTab === tab.id
                    ? "border-emerald-500 text-white"
                    : "border-transparent text-slate-400 hover:text-white"
              }`}
              title={tab.locked ? "Complete warmup target to unlock assignment" : undefined}
            >
              {tab.locked && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* DETAILS TAB - Editable account info */}
        {activeTab === "details" && (
          <div className="space-y-6">
            {/* Status Cards - Clickable to edit */}
            <div className="grid grid-cols-2 gap-3">
              <SelectableField
                field="accountHealth"
                label="Status"
                value={account.accountHealth}
                options={[
                  { value: "active", label: "Active" },
                  { value: "suspended", label: "Suspended" },
                  { value: "in-appeal", label: "In Appeal" },
                  { value: "unknown", label: "Unknown" },
                ]}
                colorFn={getHealthColor}
              />
              <SelectableField
                field="billingStatus"
                label="Billing"
                value={account.billingStatus}
                options={[
                  { value: "not_started", label: "Not Started" },
                  { value: "verified", label: "Verified" },
                  { value: "pending", label: "Pending" },
                  { value: "failed", label: "Failed" },
                ]}
                colorFn={getBillingColor}
              />
              <SelectableField
                field="status"
                label="Lifecycle"
                value={account.handoffStatus === "handed-off" ? "handed-off" : account.status}
                options={[
                  { value: "provisioned", label: "Provisioned" },
                  { value: "warming-up", label: "Warming Up" },
                  { value: "ready", label: "Ready" },
                ]}
              />
              <SelectableField
                field="certStatus"
                label="Certification"
                value={account.certStatus}
                options={[
                  { value: "none", label: "N/A" },
                  { value: "not-started", label: "Not Started" },
                  { value: "pending", label: "Pending" },
                  { value: "verified", label: "Verified" },
                  { value: "errored", label: "Errored" },
                  { value: "suspended", label: "Suspended" },
                ]}
                colorFn={getCertColor}
              />
            </div>

            {/* Metrics - Editable */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                Metrics
                <InfoTooltip text="Key performance metrics for this ad account" />
              </h4>
              <div className="space-y-2">
                <EditableField
                  field="currentSpendTotal"
                  label="Total Spend"
                  value={account.currentSpendTotal / 100}
                  type="number"
                  prefix="$"
                />
                {/* Today's Spend - Read only display (matches EditableField styling) */}
                <div className="flex items-center justify-between -mx-2 px-2 py-1 rounded">
                  <span className="text-slate-400 text-sm flex items-center gap-1">
                    Today&apos;s Spend:
                    <InfoTooltip text="Amount spent today on this account (synced from Google Ads)" />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">
                      ${(account.todaySpend / 100).toFixed(2)}
                    </span>
                    {/* Invisible spacer to match edit icon width */}
                    <span className="w-3 h-3" />
                  </div>
                </div>
                <EditableField
                  field="warmupTargetSpend"
                  label="Warmup Target"
                  value={account.warmupTargetSpend}
                  type="number"
                  prefix="$"
                />
                <EditableField
                  field="adsCount"
                  label="Ads Count"
                  value={account.adsCount}
                  type="number"
                />
              </div>
              {/* Progress bar */}
              <div className="mt-4 pt-3 border-t border-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    Warmup Progress
                    <InfoTooltip text={FIELD_TOOLTIPS.warmupProgress} />
                  </span>
                  <span className="text-xs text-slate-400">
                    {Math.min(Math.round((account.currentSpendTotal / 100 / account.warmupTargetSpend) * 100), 100)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min((account.currentSpendTotal / 100 / account.warmupTargetSpend) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Account Info - Editable */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                Account Info
                <InfoTooltip text="Google Ads account identifiers and origin information" />
              </h4>
              <div className="space-y-2">
                <EditableField field="googleCid" label="Google CID" value={formatCid(account.googleCid)} />
                <EditableField field="mccId" label="MCC ID" value={account.mccId} />
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400 text-sm flex items-center gap-1">
                    Origin:
                    <InfoTooltip text={FIELD_TOOLTIPS.origin} />
                  </span>
                  <span className={`text-sm ${account.origin === "mcc-created" ? "text-emerald-400" : "text-amber-400"}`}>
                    {account.origin === "mcc-created" ? "MCC Created" : "Takeover"}
                  </span>
                </div>
              </div>
            </div>

            {/* Sync Status */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                Sync Status
                <InfoTooltip text="OAuth connection status for automatic data syncing from Google Ads" />
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400 text-sm">Connection:</span>
                  <span className={`text-sm font-medium ${
                    account.connectionType === "oauth" ? "text-emerald-400" :
                    account.connectionType === "mcc" ? "text-blue-400" : "text-slate-500"
                  }`}>
                    {account.connectionType === "oauth" ? "OAuth Connected" :
                     account.connectionType === "mcc" ? "MCC Linked" : "Manual"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400 text-sm">Sync Status:</span>
                  <span className={`text-sm flex items-center gap-1.5 ${
                    account.syncStatus === "synced" ? "text-emerald-400" :
                    account.syncStatus === "syncing" ? "text-amber-400" :
                    account.syncStatus === "error" ? "text-red-400" : "text-slate-500"
                  }`}>
                    {account.syncStatus === "synced" && (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {account.syncStatus === "syncing" && (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {account.syncStatus === "error" && (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    {account.syncStatus === "synced" ? "Synced" :
                     account.syncStatus === "syncing" ? "Syncing..." :
                     account.syncStatus === "error" ? "Error" : "Not Connected"}
                  </span>
                </div>
                {account.lastGoogleSyncAt && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 text-sm">Last Sync:</span>
                    <span className="text-slate-300 text-sm">
                      {new Date(account.lastGoogleSyncAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {account.googleSyncError && (
                  <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">
                    {account.googleSyncError}
                  </div>
                )}
                {account.googleCidVerified && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    CID Verified
                  </div>
                )}

                {/* Connect to Google Button - Always show, use accountId for account picker flow */}
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                  {account.connectionType === "oauth" && account.syncStatus === "synced" ? (
                    // Already connected - show reconnect option
                    <button
                      onClick={() => {
                        if (window.confirm(`This account is already connected via ${account.connection?.googleEmail || "OAuth"}. Do you want to reconnect?`)) {
                          const width = 600, height = 700;
                          const left = (window.screen.width - width) / 2;
                          const top = (window.screen.height - height) / 2;
                          window.open(
                            `/api/oauth/google-ads/authorize?accountId=${account.id}`,
                            'oauth',
                            `width=${width},height=${height},left=${left},top=${top}`
                          );
                        }
                      }}
                      className="w-full px-3 py-2 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                      </svg>
                      Reconnect
                    </button>
                  ) : account.syncStatus === "error" ? (
                    // Has error - show reconnect button (amber)
                    <button
                      onClick={() => {
                        const width = 600, height = 700;
                        const left = (window.screen.width - width) / 2;
                        const top = (window.screen.height - height) / 2;
                        window.open(
                          `/api/oauth/google-ads/authorize?accountId=${account.id}`,
                          'oauth',
                          `width=${width},height=${height},left=${left},top=${top}`
                        );
                      }}
                      className="w-full px-3 py-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                      </svg>
                      Reconnect to Fix
                    </button>
                  ) : (
                    // Not connected - show connect button (green)
                    <button
                      onClick={() => {
                        const width = 600, height = 700;
                        const left = (window.screen.width - width) / 2;
                        const top = (window.screen.height - height) / 2;
                        window.open(
                          `/api/oauth/google-ads/authorize?accountId=${account.id}`,
                          'oauth',
                          `width=${width},height=${height},left=${left},top=${top}`
                        );
                      }}
                      className="w-full px-3 py-2 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                      </svg>
                      Connect to Google
                    </button>
                  )}

                  {/* Sync Now - Only show if OAuth connected */}
                  {account.connectionType === "oauth" && account.syncStatus !== "syncing" && (
                    <button
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        const originalContent = btn.innerHTML;
                        btn.disabled = true;
                        btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Syncing...</span>';

                        try {
                          const res = await fetch(`/api/accounts/${account.id}/sync`, { method: 'POST' });
                          const data = await res.json();

                          if (res.ok && data.success) {
                            btn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg><span>Synced!</span>';
                            btn.className = btn.className.replace('text-blue-400', 'text-emerald-400').replace('border-blue-500/30', 'border-emerald-500/30').replace('bg-blue-500/10', 'bg-emerald-500/10');
                            // Refresh the page data after short delay
                            setTimeout(() => window.location.reload(), 1500);
                          } else {
                            btn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg><span>${data.error || 'Failed'}</span>`;
                            btn.className = btn.className.replace('text-blue-400', 'text-red-400').replace('border-blue-500/30', 'border-red-500/30').replace('bg-blue-500/10', 'bg-red-500/10');
                            setTimeout(() => {
                              btn.innerHTML = originalContent;
                              btn.className = 'w-full px-3 py-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 rounded-lg transition flex items-center justify-center gap-2';
                              btn.disabled = false;
                            }, 3000);
                          }
                        } catch {
                          btn.innerHTML = originalContent;
                          btn.disabled = false;
                        }
                      }}
                      className="w-full px-3 py-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync Now
                    </button>
                  )}

                  {/* Launch & Connect - Only show if account has GoLogin profile */}
                    {account.identityProfile?.gologinProfile && (
                      <button
                        onClick={async () => {
                          const btn = document.activeElement as HTMLButtonElement;
                          const originalText = btn.innerHTML;
                          btn.disabled = true;
                          btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Launching...</span>';

                          try {
                            const res = await fetch(`/api/accounts/${account.id}/launch-oauth`, {
                              method: 'POST',
                            });
                            const data = await res.json();

                            if (data.success) {
                              alert('Browser launched! Complete the OAuth flow in the opened browser.');
                            } else {
                              alert(`Failed to launch: ${data.message}`);
                            }
                          } catch {
                            alert('Failed to launch browser. Make sure you have GoLogin desktop app installed.');
                          } finally {
                            btn.disabled = false;
                            btn.innerHTML = originalText;
                          }
                        }}
                        className="w-full px-3 py-2 text-xs text-violet-300 bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 rounded-lg transition flex items-center justify-center gap-2"
                        title="Launches the GoLogin browser profile and opens OAuth authorization (requires GoLogin desktop app)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Launch & Connect (GoLogin)
                      </button>
                    )}
                </div>
              </div>
            </div>

            {/* Notes - Editable */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                Notes
                <InfoTooltip text={FIELD_TOOLTIPS.notes} />
              </h4>
              {editingField === "notes" ? (
                <div>
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleFieldSave("notes", editValue || null)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingField(null); setEditValue(""); }}
                      className="px-3 py-1.5 text-slate-400 text-xs hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm text-slate-300 cursor-pointer hover:bg-slate-700/50 -mx-2 px-2 py-2 rounded transition group whitespace-pre-line"
                  onClick={() => startEditing("notes", account.notes)}
                >
                  {account.notes || <span className="text-slate-500 italic">Click to add notes...</span>}
                  <svg className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 inline ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Media Buyer Assignment */}
            {account.mediaBuyer && (
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-1">
                  Assigned To
                  <InfoTooltip text={FIELD_TOOLTIPS.mediaBuyer} />
                </h4>
                <div className="text-sm">
                  <div className="text-white">{account.mediaBuyer.name}</div>
                  <div className="text-slate-400">{account.mediaBuyer.email}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* IDENTITY TAB */}
        {activeTab === "identity" && (
          <div className="space-y-4">
            {account.identityProfile ? (
              <>
                <div className="bg-slate-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                    Identity Profile
                    <InfoTooltip text="The identity profile associated with this ad account" />
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        Name:
                        <InfoTooltip text={FIELD_TOOLTIPS.fullName} />
                      </span>
                      <span className="text-white">{account.identityProfile.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        Geo:
                        <InfoTooltip text={FIELD_TOOLTIPS.geo} />
                      </span>
                      <span className="text-white">{account.identityProfile.geo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        Email:
                        <InfoTooltip text={FIELD_TOOLTIPS.email} />
                      </span>
                      <span className="text-white font-mono">{account.identityProfile.email || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        Phone:
                        <InfoTooltip text={FIELD_TOOLTIPS.phone} />
                      </span>
                      <span className="text-white font-mono">{account.identityProfile.phone || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        Website:
                        <InfoTooltip text={FIELD_TOOLTIPS.website} />
                      </span>
                      <span className="text-white">{account.identityProfile.website || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Billing Info */}
                <div className="bg-slate-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                    Billing Info
                    <InfoTooltip text="Credit card and billing information for this identity" />
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-1">
                        Card:
                        <InfoTooltip text="Credit card number (click eye to reveal)" />
                      </span>
                      <MaskedCCField value={account.identityProfile.ccNumber} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Exp:</span>
                      <span className="text-white font-mono">{account.identityProfile.ccExp || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">CVV:</span>
                      <span className="text-white font-mono">{account.identityProfile.ccCvv ? "•••" : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name on Card:</span>
                      <span className="text-white">{account.identityProfile.ccName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Billing Zip:</span>
                      <span className="text-white">{account.identityProfile.billingZip || "—"}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 italic">
                  To edit identity or billing details, go to the Identities section.
                </p>
              </>
            ) : (
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <svg className="w-12 h-12 text-cyan-500/50 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <h4 className="text-white font-medium mb-1">No Identity Linked</h4>
                <p className="text-sm text-slate-400 mb-4">
                  This account is syncing via OAuth but needs an identity profile.
                </p>
                <button
                  onClick={() => setShowLinkIdentityModal(true)}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-500 transition inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Link Identity
                </button>
              </div>
            )}
          </div>
        )}

        {/* TIMELINE TAB - Quick Log + Activity History */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            {/* Comprehensive Quick Log */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                Quick Log
                <InfoTooltip text="Log account events, status changes, and metric updates. All actions are recorded in the activity timeline." />
              </h4>
              <div className="flex gap-2">
                <select
                  value={quickAction}
                  onChange={(e) => {
                    setQuickAction(e.target.value);
                    setQuickValue("");
                  }}
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="">Select event...</option>
                  <optgroup label="Spend & Metrics">
                    <option value="DAILY_SPEND">Log Daily Spend (+$)</option>
                    <option value="ADD_SPEND">Add to Spend (+$)</option>
                    <option value="SET_TOTAL_SPEND">Set Total Spend (=$)</option>
                    <option value="SET_ADS_COUNT">Set Ads Count</option>
                    <option value="SET_WARMUP_TARGET">Set Warmup Target ($)</option>
                  </optgroup>
                  <optgroup label="Account Status">
                    <option value="SET_HEALTH_ACTIVE">Set Active</option>
                    <option value="SET_HEALTH_SUSPENDED">Set Suspended</option>
                    <option value="SET_HEALTH_UNKNOWN">Set Unknown</option>
                  </optgroup>
                  <optgroup label="Billing Status">
                    <option value="SET_BILLING_VERIFIED">Billing Verified</option>
                    <option value="SET_BILLING_PENDING">Billing Pending</option>
                    <option value="SET_BILLING_FAILED">Billing Failed</option>
                  </optgroup>
                  <optgroup label="Certification">
                    <option value="SET_CERT_PENDING">Cert Pending</option>
                    <option value="SET_CERT_VERIFIED">Cert Verified</option>
                    <option value="SET_CERT_ERRORED">Cert Errored</option>
                    <option value="SET_CERT_SUSPENDED">Cert Suspended</option>
                    <option value="SET_CERT_NONE">Clear Cert Status</option>
                  </optgroup>
                  <optgroup label="Lifecycle">
                    <option value="SET_LIFECYCLE_PROVISIONED">Set Provisioned</option>
                    <option value="SET_LIFECYCLE_WARMING-UP">Set Warming Up</option>
                    <option value="SET_LIFECYCLE_READY">Set Ready</option>
                  </optgroup>
                  <optgroup label="Gmail">
                    <option value="GMAIL_SUS">Gmail Suspended</option>
                    <option value="GMAIL_RESTORED">Gmail Restored</option>
                  </optgroup>
                  <optgroup label="Appeals">
                    <option value="APPEAL_SUBMITTED">Appeal Submitted</option>
                    <option value="APPEAL_APPROVED">Appeal Approved</option>
                    <option value="APPEAL_DENIED">Appeal Denied</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="NOTE">Add Note</option>
                  </optgroup>
                </select>
                <button
                  onClick={handleQuickLog}
                  disabled={!quickAction || addingActivity || (isValueAction && (!quickValue || parseFloat(quickValue) < 0))}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-50 transition"
                >
                  Log
                </button>
              </div>

              {/* Value input for numeric actions */}
              {isValueAction && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    {(quickAction === "DAILY_SPEND" || quickAction === "ADD_SPEND" || quickAction === "SET_TOTAL_SPEND" || quickAction === "SET_WARMUP_TARGET") && (
                      <span className="text-slate-400 text-sm">$</span>
                    )}
                    <input
                      type="number"
                      step={quickAction === "SET_ADS_COUNT" ? "1" : "0.01"}
                      min="0"
                      value={quickValue}
                      onChange={(e) => setQuickValue(e.target.value)}
                      placeholder={
                        quickAction === "SET_TOTAL_SPEND" ? "New total..." :
                        quickAction === "SET_ADS_COUNT" ? "Number of ads..." :
                        quickAction === "SET_WARMUP_TARGET" ? "Target amount..." :
                        "Amount to add..."
                      }
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                      autoFocus
                    />
                  </div>
                  {/* Preview */}
                  {(quickAction === "DAILY_SPEND" || quickAction === "ADD_SPEND") && quickValue && parseFloat(quickValue) > 0 && (
                    <p className="text-xs text-emerald-400 mt-1">
                      New total: ${((account.currentSpendTotal / 100) + parseFloat(quickValue)).toFixed(2)}
                    </p>
                  )}
                  {quickAction === "SET_TOTAL_SPEND" && (
                    <p className="text-xs text-slate-500 mt-1">Current: ${(account.currentSpendTotal / 100).toFixed(2)}</p>
                  )}
                </div>
              )}

              {/* Notes input */}
              <input
                type="text"
                value={quickDetails}
                onChange={(e) => setQuickDetails(e.target.value)}
                placeholder={quickAction === "NOTE" ? "Enter note..." : "Optional notes..."}
                className="w-full mt-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
              />
            </div>

            {/* Activity Log */}
            <div>
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
                Activity Log
                <InfoTooltip text="Complete history of all events, status changes, and logged activities for this account" />
              </h4>
              {loadingHistory ? (
                <div className="text-sm text-slate-400">Loading...</div>
              ) : checkIns.length === 0 && activities.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No activity recorded yet</div>
              ) : (
                <div className="space-y-2">
                  {[
                    ...checkIns.map(ci => ({
                      type: "checkin" as const,
                      id: ci.id,
                      date: new Date(ci.checkedAt),
                      data: ci,
                    })),
                    ...activities.map(act => ({
                      type: "activity" as const,
                      id: act.id,
                      date: new Date(act.createdAt),
                      data: act,
                    })),
                  ]
                    .sort((a, b) => b.date.getTime() - a.date.getTime())
                    .slice(0, 20)
                    .map((item) => (
                      <div key={`${item.type}-${item.id}`} className="bg-slate-800 rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.type === "checkin" ? (
                              <>
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">CHECK-IN</span>
                                <span className="text-white">${Number((item.data as CheckIn).dailySpend).toFixed(0)} daily</span>
                                <span className="text-slate-400">•</span>
                                <span className={getHealthColor((item.data as CheckIn).accountHealth)}>
                                  {(item.data as CheckIn).accountHealth}
                                </span>
                              </>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-600 text-slate-300 text-xs rounded">
                                {(item.data as Activity).action.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                            {item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {item.type === "checkin" && (item.data as CheckIn).issues && (
                          <div className="text-xs text-amber-400 mt-1 whitespace-pre-line">{(item.data as CheckIn).issues}</div>
                        )}
                        {item.type === "checkin" && (item.data as CheckIn).notes && (
                          <div className="text-xs text-slate-400 mt-1 whitespace-pre-line">{(item.data as CheckIn).notes}</div>
                        )}
                        {item.type === "activity" && (item.data as Activity).details && (
                          <div className="text-xs text-slate-400 mt-1 whitespace-pre-line">{(item.data as Activity).details}</div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* THREAD TAB - Team Comments */}
        {activeTab === "thread" && (
          <div className="flex flex-col h-full">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1">
              Account Thread
              <InfoTooltip text="Team discussion thread for this account. Comments are visible to admins and the assigned media buyer." />
            </h4>

            {/* Messages List */}
            <div className="flex-1 space-y-3 overflow-y-auto mb-4">
              {loadingThread ? (
                <div className="text-sm text-slate-400">Loading...</div>
              ) : threadMessages.length === 0 ? (
                <div className="text-sm text-slate-500 italic">No comments yet. Start the conversation!</div>
              ) : (
                threadMessages.map((msg) => (
                  <div key={msg.id} className="bg-slate-800 rounded-lg p-3 group">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{msg.authorName}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          msg.authorRole === "SUPER_ADMIN" ? "bg-purple-500/20 text-purple-400" :
                          msg.authorRole === "ADMIN" ? "bg-blue-500/20 text-blue-400" :
                          "bg-slate-600 text-slate-300"
                        }`}>
                          {msg.authorRole.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {/* Edit/Delete buttons - show on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditingMessageText(msg.message);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-400 transition"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1 text-slate-400 hover:text-red-400 transition"
                            title="Delete"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    {editingMessageId === msg.id ? (
                      <div className="mt-2">
                        <textarea
                          value={editingMessageText}
                          onChange={(e) => setEditingMessageText(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm resize-none focus:outline-none focus:border-emerald-500"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditingMessageText("");
                            }}
                            className="px-3 py-1 text-xs text-slate-400 hover:text-white transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleEditMessage(msg.id)}
                            disabled={!editingMessageText.trim()}
                            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 transition"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{msg.message}</p>
                        {msg.editedAt && (
                          <span className="text-xs text-slate-500 italic">(edited)</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* New Message Input */}
            <div className="border-t border-slate-700 pt-4">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSendMessage();
                  }
                }}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500">Cmd+Enter to send</span>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-50 transition"
                >
                  {sendingMessage ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ASSIGN TAB */}
        {activeTab === "assign" && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-1">
                {isAlreadyAssigned ? "Current Assignment" : "Assign to Media Buyer"}
                <InfoTooltip text="Assign this account to a media buyer. They will be able to see and manage this account." />
              </h4>

              {/* Current assignment info */}
              {isAlreadyAssigned && account.mediaBuyer && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{account.mediaBuyer.name}</div>
                      <div className="text-xs text-slate-400">{account.mediaBuyer.email}</div>
                      {account.handoffDate && (
                        <div className="text-xs text-slate-500 mt-1">
                          Assigned on {new Date(account.handoffDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded">
                      Active
                    </span>
                  </div>
                  {account.handoffNotes && (
                    <div className="mt-3 pt-3 border-t border-emerald-500/20">
                      <div className="text-xs text-slate-400 mb-1">Handoff Notes:</div>
                      <div className="text-sm text-slate-300 whitespace-pre-line">{account.handoffNotes}</div>
                    </div>
                  )}
                </div>
              )}

              {loadingMediaBuyers ? (
                <div className="text-sm text-slate-400">Loading media buyers...</div>
              ) : mediaBuyers.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No active media buyers found. Create one in Team Management first.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Media Buyer Selection */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      {isAlreadyAssigned ? "Reassign to:" : "Select Media Buyer:"}
                    </label>
                    <select
                      value={selectedMediaBuyerId}
                      onChange={(e) => setSelectedMediaBuyerId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Select a media buyer --</option>
                      {mediaBuyers.map((mb) => (
                        <option key={mb.id} value={mb.id}>
                          {mb.name} ({mb.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Handoff Notes */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Handoff Notes (optional):
                    </label>
                    <textarea
                      value={handoffNotes}
                      onChange={(e) => setHandoffNotes(e.target.value)}
                      placeholder="Any special instructions or notes for the media buyer..."
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleAssign}
                      disabled={!selectedMediaBuyerId || assigning}
                      className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {assigning ? "Assigning..." : isAlreadyAssigned ? "Reassign Account" : "Assign Account"}
                    </button>
                    {isAlreadyAssigned && (
                      <button
                        onClick={handleUnassign}
                        disabled={assigning}
                        className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-600/30 disabled:opacity-50 transition"
                      >
                        {assigning ? "..." : "Unassign"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Account Summary for reference */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Account Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Account ID:</span>
                  <span className="text-white font-mono">{formatCid(account.googleCid) || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Identity:</span>
                  <span className="text-white">{account.identityProfile?.fullName || "Unlinked"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Geo:</span>
                  <span className="text-white">{account.identityProfile?.geo || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Spend:</span>
                  <span className="text-emerald-400">${(account.currentSpendTotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={getHealthColor(account.accountHealth)}>{account.accountHealth}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTIONS TAB */}
        {activeTab === "actions" && (
          <div className="space-y-6">
            {/* Archive/Unarchive Section */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive Management
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                {account.handoffStatus === "archived"
                  ? "This account is currently archived. Archived accounts are hidden from the main list."
                  : "Archive this account to remove it from active views. You can unarchive it later."}
              </p>
              {account.handoffStatus === "archived" ? (
                <button
                  onClick={handleUnarchive}
                  disabled={archiving}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  {archiving ? "Unarchiving..." : "Unarchive Account"}
                </button>
              ) : (
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  {archiving ? "Archiving..." : "Archive Account"}
                </button>
              )}
            </div>

            {/* Identity Management Section */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Identity Management
              </h4>

              {account.identityProfile ? (
                <>
                  <div className="bg-slate-900 rounded-lg p-3 mb-4">
                    <div className="text-sm text-slate-400 mb-1">Currently Linked To:</div>
                    <div className="text-white font-medium">{account.identityProfile.fullName}</div>
                    <div className="text-xs text-slate-500">{account.identityProfile.geo}</div>
                  </div>
                  <button
                    onClick={handleUnlinkIdentity}
                    disabled={unlinking}
                    className="w-full px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    {unlinking ? "Unlinking..." : "Unlink Identity"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-400 mb-4">
                    This account is not linked to any identity. Select an identity to link.
                  </p>
                  {loadingIdentities ? (
                    <div className="text-sm text-slate-400 text-center py-4">Loading identities...</div>
                  ) : availableIdentities.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-4">
                      No available identities. All identities are already linked to accounts.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={selectedNewIdentityId}
                        onChange={(e) => setSelectedNewIdentityId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                      >
                        <option value="">Select an identity...</option>
                        {availableIdentities.map((identity) => (
                          <option key={identity.id} value={identity.id}>
                            {identity.fullName} ({identity.geo})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleLinkIdentity}
                        disabled={!selectedNewIdentityId || linking}
                        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {linking ? "Linking..." : "Link Identity"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Danger Zone - SUPER_ADMIN only */}
            {isSuperAdmin && (
              <div className="bg-rose-950/30 border border-rose-900/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-rose-300 mb-2">Danger Zone</h4>
                <p className="text-xs text-rose-400/70 mb-3">
                  This action is permanent and cannot be undone.
                </p>

                {/* Show blockers if any */}
                {showDeleteConfirm && deleteBlockers && deleteBlockers.length > 0 && (
                  <div className="mb-4 p-3 bg-rose-900/30 border border-rose-800 rounded-lg">
                    <p className="text-xs text-rose-300 font-medium mb-2">
                      The following will be permanently deleted:
                    </p>
                    <ul className="text-xs text-rose-400/80 space-y-1">
                      {deleteBlockers.map((blocker, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {blocker.description}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleDeleteAccount(true)}
                        disabled={deleting}
                        className="flex-1 px-3 py-1.5 bg-rose-600 text-white text-xs rounded hover:bg-rose-500 transition disabled:opacity-50"
                      >
                        {deleting ? "Deleting..." : "Yes, Delete Everything"}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteBlockers(null);
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Type <span className="font-mono text-rose-400">delete</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value.toLowerCase())}
                      placeholder="delete"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none font-mono"
                    />
                  </div>

                  <button
                    onClick={() => handleDeleteAccount(false)}
                    disabled={deleteConfirmText !== "delete" || deleting || showDeleteConfirm}
                    className="w-full px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {deleting ? "Checking..." : "Delete Account Permanently"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link Identity Modal */}
      {showLinkIdentityModal && (
        <LinkIdentityModal
          accountId={account.id}
          googleCid={account.googleCid}
          prefillEmail={account.connection?.googleEmail}
          onClose={() => setShowLinkIdentityModal(false)}
          onSuccess={() => {
            onRefresh();
            setShowLinkIdentityModal(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// MAIN AD ACCOUNTS VIEW
// ============================================================================

type AdAccountsViewProps = {
  onDataChange?: () => void;
  onNavigate?: (view: "create-identity" | string) => void;
};

export function AdAccountsView({ onDataChange, onNavigate }: AdAccountsViewProps = {}) {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Filters
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      // Always fetch all accounts including archived - filter client-side
      const res = await fetch("/api/accounts?include=identity,checkins&includeArchived=true");
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

  const fetchIdentities = useCallback(async () => {
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data.identities || []);
      }
    } catch (error) {
      console.error("Failed to fetch identities:", error);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchIdentities();
  }, [fetchAccounts, fetchIdentities]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      // Hide archived accounts unless showArchived is enabled
      if (!showArchived && account.handoffStatus === "archived") return false;
      // Show only orphan accounts (no identity, but syncing via OAuth)
      if (showOrphansOnly && (account.identityProfileId !== null || account.connectionType !== "oauth")) return false;
      if (healthFilter !== "all" && account.accountHealth !== healthFilter) return false;
      if (billingFilter !== "all" && account.billingStatus !== billingFilter) return false;
      if (originFilter !== "all" && account.origin !== originFilter) return false;
      if (lifecycleFilter !== "all") {
        if (lifecycleFilter === "archived" && account.handoffStatus !== "archived") return false;
        if (lifecycleFilter === "handed-off" && account.handoffStatus !== "handed-off") return false;
        if (lifecycleFilter !== "handed-off" && lifecycleFilter !== "archived" && (account.status !== lifecycleFilter || account.handoffStatus === "handed-off" || account.handoffStatus === "archived")) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !account.googleCid?.toLowerCase().includes(query) &&
          !account.identityProfile?.fullName.toLowerCase().includes(query) &&
          !account.identityProfile?.email?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [accounts, healthFilter, billingFilter, lifecycleFilter, originFilter, showArchived, showOrphansOnly, searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === "Escape") {
        if (selectedAccount) {
          setSelectedAccount(null);
          return;
        }
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
          return;
        }
        if (showAddModal) {
          setShowAddModal(false);
          return;
        }
      }

      if (e.key === "?") {
        setShowKeyboardHelp(true);
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "r") {
        fetchAccounts();
        return;
      }

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

      if (focusedIndex >= 0 && focusedIndex < filteredLength) {
        const focusedAccount = filteredAccounts[focusedIndex];

        if (e.key === "Enter") {
          setSelectedAccount(focusedAccount);
          return;
        }

        if (e.key === "a" && !e.shiftKey) {
          handleQuickStatusChange(focusedAccount.id, "active");
          return;
        }
        if (e.key === "s") {
          handleQuickStatusChange(focusedAccount.id, "suspended");
          return;
        }
        if (e.key === "u") {
          handleQuickStatusChange(focusedAccount.id, "unknown");
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredAccounts, focusedIndex, selectedAccount, showKeyboardHelp, showAddModal, fetchAccounts]);

  async function handleQuickStatusChange(accountId: string, newHealth: string) {
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountHealth: newHealth }),
    });

    if (res.ok) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, accountHealth: newHealth } : a))
      );

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

  async function handleAddActivity(action: string, details: string, spendData?: { type: string; amount: number }) {
    if (!selectedAccount) return;

    // If this is a spend action, update the account spend and log activity
    if (spendData) {
      const { type, amount } = spendData;
      let newSpend = selectedAccount.currentSpendTotal;
      let activityDetails = details;

      if (type === "DAILY_SPEND" || type === "ADD_SPEND") {
        // Add to current spend (amount is in dollars, convert to cents)
        newSpend = selectedAccount.currentSpendTotal + Math.round(amount * 100);
        activityDetails = `Added $${amount.toFixed(2)} daily spend. New total: $${(newSpend / 100).toFixed(2)}`;
      } else if (type === "SET_TOTAL_SPEND") {
        // Set absolute spend (amount is in dollars, convert to cents)
        newSpend = Math.round(amount * 100);
        activityDetails = `Set total spend to $${amount.toFixed(2)}`;
      }

      // Update account spend
      const updateRes = await fetch(`/api/accounts/${selectedAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSpendTotal: newSpend }),
      });

      if (updateRes.ok) {
        // Update local state
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === selectedAccount.id ? { ...a, currentSpendTotal: newSpend } : a
          )
        );
        setSelectedAccount((prev) =>
          prev ? { ...prev, currentSpendTotal: newSpend } : null
        );

        // Log the activity
        await fetch(`/api/accounts/${selectedAccount.id}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, details: activityDetails }),
        });
      }
    } else {
      // Regular activity logging
      await fetch(`/api/accounts/${selectedAccount.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, details: details || null }),
      });
    }
  }

  async function handleUpdateAccount(accountId: string, updates: Record<string, unknown>) {
    // Handle special case for currentSpendTotal which is stored in cents
    const processedUpdates = { ...updates };
    if ("currentSpendTotal" in processedUpdates && typeof processedUpdates.currentSpendTotal === "number") {
      processedUpdates.currentSpendTotal = Math.round((processedUpdates.currentSpendTotal as number) * 100);
    }

    const res = await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(processedUpdates),
    });

    if (res.ok) {
      const updatedAccount = await res.json();
      // Update local state
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? updatedAccount : a))
      );
      if (selectedAccount?.id === accountId) {
        setSelectedAccount(updatedAccount);
      }
    }
  }

  // Summary stats - redesigned for operational visibility
  // IMPORTANT: Stats should NEVER include archived accounts
  const stats = useMemo(() => {
    // Filter out archived accounts from all stats calculations
    const activeAccounts = accounts.filter(a => a.handoffStatus !== "archived");

    // Pipeline stats based on account status field (matches what's displayed in cards)
    const warmingUp = activeAccounts.filter(a =>
      a.status === "warming-up" &&
      a.handoffStatus !== "handed-off"
    );
    const readyToHandoff = activeAccounts.filter(a =>
      a.status === "ready" &&
      a.handoffStatus !== "handed-off"
    );
    const handedOff = activeAccounts.filter(a => a.handoffStatus === "handed-off");

    // Problem accounts (only from non-archived)
    const suspended = activeAccounts.filter(a => a.accountHealth === "suspended" || a.accountHealth === "banned");
    const billingIssues = activeAccounts.filter(a => a.billingStatus === "pending" || a.billingStatus === "failed");

    // Orphan accounts (OAuth connected but no identity) - only from non-archived
    const orphans = activeAccounts.filter(a => a.identityProfileId === null && a.connectionType === "oauth");

    // Financial - only from non-archived accounts
    const totalSpend = activeAccounts.reduce((sum, a) => sum + (a.currentSpendTotal || 0), 0);
    const activeSpend = activeAccounts
      .filter(a => a.accountHealth === "active")
      .reduce((sum, a) => sum + (a.currentSpendTotal || 0), 0);

    // Calculate average warmup progress for warming accounts
    const avgWarmupProgress = warmingUp.length > 0
      ? warmingUp.reduce((sum, a) => sum + (a.warmupTargetSpend > 0 ? (a.currentSpendTotal / a.warmupTargetSpend) * 100 : 0), 0) / warmingUp.length
      : 0;

    // Count archived accounts separately (for reference only)
    const archivedCount = accounts.filter(a => a.handoffStatus === "archived").length;

    return {
      // Pipeline
      warmingUp: warmingUp.length,
      readyToHandoff: readyToHandoff.length,
      handedOff: handedOff.length,
      avgWarmupProgress: Math.round(avgWarmupProgress),

      // Problems
      suspended: suspended.length,
      billingIssues: billingIssues.length,
      orphans: orphans.length,

      // Money
      totalSpend,
      activeSpend,

      // Archived (separate tracking)
      archived: archivedCount,

      // Total for reference (non-archived only)
      total: activeAccounts.length,
    };
  }, [accounts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Ad Accounts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage all Google Ads accounts - check-ins, status tracking, and lifecycle management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyboardHelp(true)}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
          >
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">?</kbd>
            <span>Shortcuts</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 transition"
          >
            + Add Account
          </button>
        </div>
      </div>

      {/* Needs Attention Section */}
      <NeedsAttentionSection
        onViewDetails={(needsAttentionAccount) => {
          // Find the full account from our accounts list
          const fullAccount = accounts.find(a => a.id === needsAttentionAccount.id);
          if (fullAccount) {
            setSelectedAccount(fullAccount);
          }
        }}
        onRefresh={fetchAccounts}
      />

      {/* Stats Dashboard - Redesigned for operational visibility */}
      <div className="grid grid-cols-12 gap-4">
        {/* Pipeline Health - Left section */}
        <div className="col-span-5 bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-medium">Pipeline</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              {loading ? (
                <div className="h-8 w-12 mx-auto bg-slate-700 rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-blue-400">{stats.warmingUp}</div>
              )}
              <div className="text-xs text-slate-400 mt-1">Warming Up</div>
              {!loading && stats.warmingUp > 0 && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ~{stats.avgWarmupProgress}% avg
                </div>
              )}
            </div>
            <div className="text-center border-x border-slate-700 px-2">
              {loading ? (
                <div className="h-8 w-12 mx-auto bg-slate-700 rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-green-400">{stats.readyToHandoff}</div>
              )}
              <div className="text-xs text-slate-400 mt-1">Ready</div>
              <div className="text-[10px] text-slate-500 mt-0.5">for handoff</div>
            </div>
            <div className="text-center">
              {loading ? (
                <div className="h-8 w-12 mx-auto bg-slate-700 rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-purple-400">{stats.handedOff}</div>
              )}
              <div className="text-xs text-slate-400 mt-1">Handed Off</div>
              <div className="text-[10px] text-slate-500 mt-0.5">in production</div>
            </div>
          </div>
        </div>

        {/* Issues - Middle section */}
        <div className="col-span-4 bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-medium">Issues & Orphans</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              {loading ? (
                <div className="h-8 w-12 mx-auto bg-slate-700 rounded animate-pulse" />
              ) : (
                <div className={`text-2xl font-bold ${stats.suspended > 0 ? "text-red-400" : "text-slate-600"}`}>
                  {stats.suspended}
                </div>
              )}
              <div className="text-xs text-slate-400 mt-1">Suspended</div>
            </div>
            <div className="text-center border-x border-slate-700 px-2">
              {loading ? (
                <div className="h-8 w-12 mx-auto bg-slate-700 rounded animate-pulse" />
              ) : (
                <div className={`text-2xl font-bold ${stats.billingIssues > 0 ? "text-amber-400" : "text-slate-600"}`}>
                  {stats.billingIssues}
                </div>
              )}
              <div className="text-xs text-slate-400 mt-1">Billing</div>
            </div>
            <button
              onClick={() => setShowOrphansOnly(!showOrphansOnly)}
              className="text-center hover:bg-slate-700/50 rounded transition -m-2 p-2"
              title="Click to filter orphan accounts"
            >
              {loading ? (
                <div className="h-8 w-12 mx-auto bg-slate-700 rounded animate-pulse" />
              ) : (
                <div className={`text-2xl font-bold ${stats.orphans > 0 ? "text-cyan-400" : "text-slate-600"} ${showOrphansOnly ? "underline" : ""}`}>
                  {stats.orphans}
                </div>
              )}
              <div className="text-xs text-slate-400 mt-1">Orphans</div>
              <div className="text-[10px] text-slate-500 mt-0.5">no identity</div>
            </button>
          </div>
        </div>

        {/* Financials - Right section */}
        <div className="col-span-3 bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-medium">Spend</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              {loading ? (
                <div className="h-8 w-16 mx-auto bg-slate-700 rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-emerald-400">
                  ${(stats.totalSpend / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              )}
              <div className="text-xs text-slate-400 mt-1">Total Spend</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{stats.total} accounts</div>
            </div>
            <div className="text-center border-l border-slate-700 pl-4">
              {loading ? (
                <div className="h-8 w-16 mx-auto bg-slate-700 rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-emerald-400">
                  ${(stats.activeSpend / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              )}
              <div className="text-xs text-slate-400 mt-1">Active Spend</div>
              <div className="text-[10px] text-slate-500 mt-0.5">healthy accounts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by CID, name, or email... (press /)"
          className="flex-1 min-w-[200px] max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="unknown">Unknown</option>
        </select>
        <select
          value={billingFilter}
          onChange={(e) => setBillingFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Billing</option>
          <option value="not_started">Not Started</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={lifecycleFilter}
          onChange={(e) => {
            const value = e.target.value;
            setLifecycleFilter(value);
            // Auto-enable showArchived when filtering by archived
            if (value === "archived") {
              setShowArchived(true);
            }
          }}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Lifecycle</option>
          <option value="provisioned">Provisioned</option>
          <option value="warming-up">Warming Up</option>
          <option value="ready">Ready</option>
          <option value="handed-off">Handed Off</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Origins</option>
          <option value="mcc-created">MCC Created</option>
          <option value="takeover">Takeover</option>
        </select>

        {/* Orphan accounts toggle */}
        <button
          onClick={() => setShowOrphansOnly(!showOrphansOnly)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            showOrphansOnly
              ? "bg-cyan-600/20 text-cyan-400 border border-cyan-600/50"
              : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-300"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          {showOrphansOnly ? `Orphans (${stats.orphans})` : "Orphans"}
          {!showOrphansOnly && stats.orphans > 0 && (
            <span className="px-1.5 py-0.5 bg-cyan-600/30 text-cyan-400 rounded text-xs">{stats.orphans}</span>
          )}
        </button>

        {/* Archive toggle */}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            showArchived
              ? "bg-amber-600/20 text-amber-400 border border-amber-600/50"
              : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-300"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          {showArchived ? "Showing Archived" : "Show Archived"}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading accounts...</div>
      ) : filteredAccounts.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {accounts.length === 0 ? "No accounts yet. Click '+ Add Account' to create one." : "No accounts match the current filters."}
        </div>
      ) : (
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="pb-3 pr-4 font-medium">
                  <Tooltip text={COLUMN_TOOLTIPS.internalId}><span>ID</span></Tooltip>
                </th>
                <th className="pb-3 px-4 font-medium">
                  <Tooltip text={COLUMN_TOOLTIPS.account}><span>ACCOUNT</span></Tooltip>
                </th>
                <th className="pb-3 px-4 font-medium">
                  <Tooltip text={COLUMN_TOOLTIPS.lifecycle}><span>LIFECYCLE</span></Tooltip>
                </th>
                <th className="pb-3 px-4 font-medium">
                  <Tooltip text={COLUMN_TOOLTIPS.progress}><span>PROGRESS</span></Tooltip>
                </th>
                <th className="pb-3 px-4 font-medium text-right">
                  <Tooltip text={COLUMN_TOOLTIPS.spend}><span>SPEND</span></Tooltip>
                </th>
                <th className="pb-3 pl-4 font-medium">
                  <Tooltip text={COLUMN_TOOLTIPS.status}><span>STATUS</span></Tooltip>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredAccounts.map((account, index) => {
                const progress = (account.currentSpendTotal / 100 / account.warmupTargetSpend) * 100;
                return (
                  <tr
                    key={account.id}
                    className={`transition cursor-pointer ${
                      focusedIndex === index
                        ? "bg-emerald-900/20 ring-1 ring-emerald-500/50"
                        : "hover:bg-slate-800/50"
                    } ${account.handoffStatus === "archived" ? "opacity-60" : ""}`}
                    onClick={() => setSelectedAccount(account)}
                  >
                    {/* INTERNAL ID */}
                    <td className="py-3 pr-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-700/50 text-slate-300">
                        MM{String(account.internalId).padStart(3, '0')}
                      </span>
                    </td>
                    {/* ACCOUNT */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-white flex items-center gap-2">
                        {formatCid(account.googleCid) || "No CID"}
                        {account.connectionType === "oauth" && account.syncStatus === "synced" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">
                            <svg className="w-2.5 h-2.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Synced
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        {account.identityProfile?.fullName || (
                          <span className="text-cyan-400/80 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Needs Identity
                          </span>
                        )}
                      </div>
                    </td>
                    {/* LIFECYCLE */}
                    <td className="py-3 px-4">
                      {account.handoffStatus === "archived" ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs bg-slate-600/30 text-slate-400">
                          Archived
                        </span>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs ${getLifecycleBadge(account.handoffStatus === "handed-off" ? "handed-off" : account.status)}`}>
                          {getLifecycleLabel(account.status, account.handoffStatus)}
                        </span>
                      )}
                    </td>
                    {/* PROGRESS */}
                    <td className="py-3 px-4">
                      <div className="w-24">
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {Math.min(Math.round(progress), 100)}%
                        </div>
                      </div>
                    </td>
                    {/* SPEND */}
                    <td className="py-3 px-4 text-right">
                      <span className="text-white font-mono">
                        ${(account.currentSpendTotal / 100).toFixed(0)}
                      </span>
                    </td>
                    {/* QUICK STATUS */}
                    <td className="py-3 pl-4">
                      <QuickStatusButtons
                        account={account}
                        onStatusChange={handleQuickStatusChange}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onSubmit={() => {
            fetchAccounts();
            fetchIdentities();
          }}
          identities={identities}
          onCreateIdentity={onNavigate ? () => onNavigate("create-identity") : undefined}
        />
      )}

      {showKeyboardHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowKeyboardHelp(false)} />
      )}

      {selectedAccount && (
        <DetailPanel
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onAddActivity={handleAddActivity}
          onRefresh={fetchAccounts}
          onUpdateAccount={handleUpdateAccount}
        />
      )}
    </div>
  );
}
