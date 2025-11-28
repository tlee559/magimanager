"use client";

import { useState, useEffect } from "react";
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
  RefreshCw,
  ExternalLink,
  MessageSquare,
} from "lucide-react";

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

function formatCid(cid: string | null): string {
  if (!cid) return "—";
  const clean = cid.replace(/[-\s]/g, "");
  if (clean.length === 10 && /^\d+$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return cid;
}

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
// KADABRA LOGO
// ============================================================================

function KadabraLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="12" fill="url(#kadabraGradient)" />
      <path
        d="M30 70V30H40V47L55 30H68L50 50L70 70H56L40 52V70H30Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="kadabraGradient"
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ============================================================================
// DASHBOARD VIEW
// ============================================================================

function DashboardView({ accounts, loading }: { accounts: AdAccount[]; loading: boolean }) {
  const activeAccounts = accounts.filter((a) => a.accountHealth === "active");
  const totalSpend = accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0);
  const todaySpend = accounts.reduce((sum, a) => sum + a.todaySpend, 0);
  const suspendedCount = accounts.filter((a) => a.accountHealth === "suspended").length;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-violet-500/10 rounded-lg">
              <Briefcase className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-sm text-slate-400">My Accounts</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{loading ? "—" : accounts.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            {activeAccounts.length} active
          </p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-sm text-slate-400">Total Spend</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">
            {loading ? "—" : formatCurrency(totalSpend)}
          </p>
          <p className="text-xs text-slate-500 mt-1">All-time across accounts</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm text-slate-400">Today's Spend</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">
            {loading ? "—" : formatCurrency(todaySpend)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Across all accounts</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-sm text-slate-400">Issues</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{loading ? "—" : suspendedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Accounts needing attention</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://ads.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition"
          >
            <ExternalLink className="w-4 h-4" />
            Google Ads
          </a>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg text-sm transition">
            <RefreshCw className="w-4 h-4" />
            Sync Data
          </button>
        </div>
      </div>

      {/* Recent Accounts */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300">Recent Account Activity</h3>
        </div>
        <div className="divide-y divide-slate-700/50">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No accounts assigned yet. Request a new account to get started.
            </div>
          ) : (
            accounts.slice(0, 5).map((account) => (
              <div key={account.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-700/30 transition">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${account.accountHealth === "active" ? "bg-emerald-400" : account.accountHealth === "suspended" ? "bg-red-400" : "bg-slate-400"}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Account #{account.internalId}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCid(account.googleCid)} • {formatCurrency(account.currentSpendTotal)} total
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${getHealthColor(account.accountHealth)}`}>
                    {account.accountHealth}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(account.todaySpend)} today
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MY ACCOUNTS VIEW
// ============================================================================

function MyAccountsView({ accounts, loading }: { accounts: AdAccount[]; loading: boolean }) {
  const [filter, setFilter] = useState<"all" | "active" | "issues">("all");

  const filteredAccounts = accounts.filter((a) => {
    if (filter === "active") return a.accountHealth === "active";
    if (filter === "issues") return a.accountHealth !== "active";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["all", "active", "issues"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f
                ? "bg-violet-500 text-white"
                : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f === "all" ? "All" : f === "active" ? "Active" : "Issues"}
            <span className="ml-2 text-xs opacity-70">
              ({f === "all" ? accounts.length : f === "active" ? accounts.filter((a) => a.accountHealth === "active").length : accounts.filter((a) => a.accountHealth !== "active").length})
            </span>
          </button>
        ))}
      </div>

      {/* Accounts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            Loading your accounts...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-500">
            {filter === "all"
              ? "No accounts assigned to you yet."
              : filter === "active"
              ? "No active accounts."
              : "No accounts with issues."}
          </div>
        ) : (
          filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-100">
                      Account #{account.internalId}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getHealthBg(account.accountHealth)} ${getHealthColor(account.accountHealth)}`}>
                      {account.accountHealth}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    CID: {formatCid(account.googleCid)}
                  </p>
                </div>
                <a
                  href={`https://ads.google.com/aw/overview?ocid=${account.googleCid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition"
                >
                  Open in Google Ads
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total Spend</p>
                  <p className="text-sm font-medium text-slate-200">
                    {formatCurrency(account.currentSpendTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Today</p>
                  <p className="text-sm font-medium text-slate-200">
                    {formatCurrency(account.todaySpend)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Campaigns</p>
                  <p className="text-sm font-medium text-slate-200">{account.campaignsCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Handed Off</p>
                  <p className="text-sm font-medium text-slate-200">
                    {formatDate(account.handoffDate)}
                  </p>
                </div>
              </div>

              {account.identityProfile && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500">
                    Identity: {account.identityProfile.fullName} ({account.identityProfile.geo})
                  </p>
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

type View = "dashboard" | "accounts" | "requests" | "notifications";

export function KadabraApp() {
  const { data: session, status } = useSession();
  const [view, setView] = useState<View>("dashboard");
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Fetch data
  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

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

  const navItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts" as const, label: "My Accounts", icon: Briefcase },
    { id: "requests" as const, label: "Requests", icon: PlusCircle },
    { id: "notifications" as const, label: "Notifications", icon: Bell, badge: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <KadabraLogo size={40} />
            <div>
              <h1 className="text-lg font-bold text-slate-100">Kadabra</h1>
              <p className="text-xs text-violet-400">Optimization Hub</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
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
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-violet-500/20 rounded-full flex items-center justify-center">
              <span className="text-violet-400 font-medium">
                {user?.name?.charAt(0) || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              // Unified logout: sign out and redirect to abra (auth hub)
              const abraUrl = process.env.NEXT_PUBLIC_ABRA_URL || "http://localhost:3000";
              signOut({ callbackUrl: abraUrl });
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-100">
              {view === "dashboard" && "Dashboard"}
              {view === "accounts" && "My Accounts"}
              {view === "requests" && "Account Requests"}
              {view === "notifications" && "Notifications"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {view === "dashboard" && "Overview of your accounts and performance"}
              {view === "accounts" && "Manage your assigned Google Ads accounts"}
              {view === "requests" && "Request new accounts or claim existing ones"}
              {view === "notifications" && "Stay updated with account activities"}
            </p>
          </div>

          {/* View Content */}
          {view === "dashboard" && <DashboardView accounts={accounts} loading={loading} />}
          {view === "accounts" && <MyAccountsView accounts={accounts} loading={loading} />}
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

      {/* Request Modal */}
      {showRequestModal && (
        <RequestModal
          onClose={() => setShowRequestModal(false)}
          onSubmit={handleCreateRequest}
        />
      )}
    </div>
  );
}
