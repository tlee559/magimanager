"use client";

import { useState, useEffect, FormEvent, ChangeEvent, useMemo } from "react";
import { GEO_OPTIONS, formatDateForDisplay, formatDateToInputString, formatCid } from "@magimanager/shared";
import { useRealtimeNotifications } from "@magimanager/realtime";
import { signOut, useSession } from "next-auth/react";
import { useModal } from "./modal-context";
import { AdAccountsView } from "./ad-accounts-view";
import { AddAccountModal } from "./add-account-modal";
import { ProfileModal } from "./profile-modal";
// SMSDashboard import removed - feature coming soon
// import { SMSDashboard } from "@/lib/sms-dashboard";
import {
  Skeleton,
  SkeletonStatCards,
  SkeletonIdentitiesTable,
  SkeletonAccountsTable,
  SkeletonTeamTable,
  SkeletonRecentIdentities,
  SkeletonSettingsForm,
  SkeletonIdentityDetail,
  SkeletonNotifications,
  SkeletonTableRows,
  LoadingSpinner,
} from "./skeleton-loaders";


// ============================================================================
// TYPES
// ============================================================================

type GoLoginProfile = {
  id: string;
  profileId: string | null;
  profileName: string | null;
  status: string;
  errorMessage: string | null;
  proxyMode: string;
  proxyHost: string | null;
  proxyPort: number | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  proxyCountry: string | null;
  lastUsedAt: Date | null;
  fingerprintRefreshedAt: Date | null;
  browserVersion: string | null;
  createdAt: Date;
};

type Identity = {
  id: string;
  fullName: string;
  dob: Date;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  geo: string;
  website: string | null;
  notes: string | null;
  // Credential fields
  email: string | null;
  emailPassword: string | null;
  phone: string | null;
  twoFactorSecret: string | null;
  backupCodes: string | null;
  // Billing fields
  ccNumber: string | null;
  ccExp: string | null;
  ccCvv: string | null;
  ccName: string | null;
  billingZip: string | null;
  // Archive status
  archived: boolean;
  archivedAt: Date | null;
  // Phone verification fields
  verificationPhone: string | null;
  verificationPhoneId: string | null;
  verificationStatus: string | null;
  verificationCode: string | null;
  verificationExpiresAt: Date | null;
  createdAt: Date;
  updatedAt?: Date;
  documents: IdentityDoc[];
  gologinProfile?: GoLoginProfile | null;
  adAccounts?: { id: string; internalId: number; googleCid: string | null }[];
};

type IdentityDoc = {
  id: string;
  type: string;
  filePath: string;
  uploadedAt: Date;
};

type MediaBuyer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  adAccounts?: AdAccount[];
};

type AdAccount = {
  id: string;
  internalId: number;
  googleCid: string | null;
  identityProfileId: string | null;
  origin: string;
  status: string;
  warmupTargetSpend: number;
  currentSpendTotal: number;
  adsCount: number;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  handoffStatus: string;
  mediaBuyerId: string | null;
  handoffDate: Date | null;
  handoffNotes: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  identityProfile?: Identity | null; // Now includes gologinProfile
  mediaBuyer?: MediaBuyer;
};

type AppSettings = {
  id: string;
  warmupTargetSpend: number;
  updatedAt: Date;
};


type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";

type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  unreadNotifications: number;
  mediaBuyer?: MediaBuyer;
};

type ThreadMessage = {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

type AccountThread = {
  id: string;
  adAccountId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ThreadMessage[];
};

type AccountRequest = {
  id: string;
  requesterId: string;
  type: "CLAIM_EXISTING" | "CREATE_NEW";
  existingAccountId?: string | null;
  justification: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";
  reviewedBy?: string | null;
  reviewedAt?: string | Date | null;
  rejectionReason?: string | null;
  createdAccountId?: string | null;
  createdAt: string | Date;
  requester?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

type View = "dashboard" | "identities" | "create-identity" | "identity-detail" | "edit-identity" | "ad-accounts" | "team" | "settings" | "my-accounts" | "requests" | "admin-requests" | "system" | "sms-dashboard";

// ============================================================================
// LOGO COMPONENT
// ============================================================================

function SquareMLogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="12" fill="url(#logoGradient)" />
      <path
        d="M25 70V30H35L50 55L65 30H75V70H65V45L50 70L35 45V70H25Z"
        fill="white"
      />
      <defs>
        <linearGradient id="logoGradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f46e5" />
          <stop offset="1" stopColor="#9333ea" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ============================================================================
// MAIN ADMIN COMPONENT
// ============================================================================

export function AdminApp() {
  const { data: session } = useSession();
  const [view, setView] = useState<View>("dashboard");
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);
  const [criticalAlertsCount, setCriticalAlertsCount] = useState(0);
  // Get user role from session
  const userRole = ((session?.user as any)?.role as UserRole) || "SUPER_ADMIN";
  // TODO: Get from session - for now hardcoded as false for testing
  const [firstLogin, setFirstLogin] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

  // Fetch identities on mount and when view changes
  useEffect(() => {
    if (view === "identities" || view === "dashboard") {
      fetchIdentities();
    }
    if (view === "dashboard") {
      fetchAccounts();
    }
  }, [view]);

  async function fetchIdentities() {
    setLoading(true);
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data.identities || []);
      }
    } catch (error) {
      console.error("Failed to fetch identities:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }

  async function fetchAlertsCounts() {
    try {
      const res = await fetch("/api/accounts/needs-attention");
      if (res.ok) {
        const data = await res.json();
        setAlertsCount(data.summary?.total || 0);
        setCriticalAlertsCount(data.summary?.critical || 0);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    }
  }

  async function markAsRead(notificationId: string) {
    // Optimistically update UI immediately
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, isRead: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${notificationId}`, { method: "PATCH" });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Revert on error
      fetchNotifications();
    }
  }

  async function markAllAsRead() {
    // Optimistically update UI immediately
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      // Revert on error
      fetchNotifications();
    }
  }

  // Fetch notifications and alerts on mount and periodically
  useEffect(() => {
    fetchNotifications();
    fetchAlertsCounts();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchAlertsCounts();
    }, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Subscribe to real-time notifications via Pusher
  const userId = (session?.user as any)?.id || null;
  useRealtimeNotifications(userId, () => {
    // When a real-time notification arrives, refresh the notifications list
    fetchNotifications();
  });

  // Show password change modal on first login
  useEffect(() => {
    if (firstLogin) {
      setShowPasswordChangeModal(true);
    }
  }, [firstLogin]);

  async function fetchIdentity(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/identities/${id}`);
      if (res.ok) {
        const identity = await res.json();
        setSelectedIdentity(identity);
        setView("identity-detail");
      }
    } catch (error) {
      console.error("Failed to fetch identity:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateSuccess() {
    setView("identities");
    fetchIdentities();
  }

  function handleDeleteSuccess() {
    setView("identities");
    setSelectedIdentity(null);
    fetchIdentities();
  }

  // Build navigation based on role
  const navItems = (() => {
    const items: { id: View; label: string; icon: string; comingSoon?: boolean }[] = [
      { id: "dashboard" as View, label: "Dashboard", icon: "📊" },
    ];

    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
      items.push(
        { id: "ad-accounts" as View, label: "Account Profiles", icon: "💳" },
        { id: "identities" as View, label: "ID Profiles", icon: "👥" },
        { id: "admin-requests" as View, label: "Account Requests", icon: "📥" },
        { id: "team" as View, label: "Team", icon: "👨‍👩‍👧‍👦" }
      );
    }

    // SMS Dashboard - Super Admin and Admin only (Coming Soon teaser)
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") {
      items.push(
        { id: "sms-dashboard" as View, label: "SMS", icon: "📱", comingSoon: true }
      );
    }

    // Only Super Admin gets the System view
    if (userRole === "SUPER_ADMIN") {
      items.push(
        { id: "system" as View, label: "System", icon: "🔧" }
      );
    }

    // Super Admin, Admin, and Media Buyer get My Accounts view
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MEDIA_BUYER") {
      items.push(
        { id: "my-accounts" as View, label: "My Accounts", icon: "💼" }
      );
    }

    // All users can see "My Requests"
    items.push(
      { id: "requests" as View, label: "My Requests", icon: "📝" }
    );

    // Settings always last for admins/managers
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
      items.push(
        { id: "settings" as View, label: "Settings", icon: "⚙️" }
      );
    }

    return items;
  })();

  return (
    <div className="h-screen flex bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar - Fixed */}
      <aside className="w-72 h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950/90 flex flex-col overflow-hidden">
        <div className="h-16 flex-shrink-0 px-6 flex items-center gap-3 border-b border-slate-800">
          <SquareMLogoIcon size={40} />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-emerald-400">
              Magimanager
            </span>
            <span className="text-xs text-slate-400">
              Account Factory Console
            </span>
          </div>
        </div>

        <nav className="flex-1 mt-4 space-y-1 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => !item.comingSoon && setView(item.id)}
              disabled={item.comingSoon}
              className={`w-full text-left flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                item.comingSoon
                  ? "text-slate-500 cursor-not-allowed opacity-60"
                  : view === item.id
                  ? "bg-slate-800 text-white"
                  : "text-slate-200 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className={`text-base ${item.comingSoon ? "grayscale" : ""}`}>{item.icon}</span>
              <span className="flex items-center gap-2">
                {item.label}
                {item.comingSoon && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded uppercase tracking-wide">
                    Soon
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>

        <div className="flex-shrink-0 w-full px-6 py-4 border-t border-slate-800">
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full mb-3 px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition text-left"
          >
            <div className="text-sm font-medium text-slate-100">{session?.user?.name || "User"}</div>
            <div className="text-xs text-slate-500">{session?.user?.email || "No email"}</div>
          </button>
          <button
            onClick={() => signOut({ callbackUrl: window.location.origin })}
            className="w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm flex items-center justify-center gap-2"
          >
            <span>🚪</span>
            Logout
          </button>
          <div className="mt-3 text-xs text-slate-600 opacity-50 cursor-not-allowed select-none">
            <div className="font-medium text-slate-500">Dev Environment · Local</div>
            <div className="text-slate-600">Coming soon</div>
          </div>
        </div>
      </aside>

      {/* Main content - Scrollable */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top bar - Fixed */}
        <header className="h-16 flex-shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950">
          <div>
            {view === "dashboard" && <h1 className="text-lg font-semibold text-slate-50">Dashboard</h1>}
            {view === "identities" && <h1 className="text-lg font-semibold text-slate-50">Identity Profiles</h1>}
            {view === "create-identity" && <h1 className="text-lg font-semibold text-slate-50">New Identity Profile</h1>}
            {view === "identity-detail" && selectedIdentity && (
              <h1 className="text-lg font-semibold text-slate-50">{selectedIdentity.fullName}</h1>
            )}
            {view === "edit-identity" && selectedIdentity && (
              <h1 className="text-lg font-semibold text-slate-50">Edit {selectedIdentity.fullName}</h1>
            )}
            {view === "ad-accounts" && <h1 className="text-lg font-semibold text-slate-50">Account Profiles</h1>}
            {view === "team" && <h1 className="text-lg font-semibold text-slate-50">Team Management</h1>}
            {view === "my-accounts" && <h1 className="text-lg font-semibold text-slate-50">My Accounts</h1>}
            {view === "requests" && <h1 className="text-lg font-semibold text-slate-50">My Requests</h1>}
            {view === "admin-requests" && <h1 className="text-lg font-semibold text-slate-50">Account Requests</h1>}
            {view === "settings" && <h1 className="text-lg font-semibold text-slate-50">Settings</h1>}
            {view === "system" && <h1 className="text-lg font-semibold text-slate-50">System Overview</h1>}
            {view === "sms-dashboard" && (
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-400">SMS Verifications</h1>
                <span className="px-2 py-0.5 text-xs font-bold bg-red-500/20 text-red-400 rounded uppercase">Coming Soon</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-6">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-slate-200 transition rounded-lg hover:bg-slate-800"
                title="Notifications"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {/* Show badge for critical alerts (red) or other alerts (amber) or unread notifications (blue) */}
                {(criticalAlertsCount > 0 || alertsCount > 0 || unreadCount > 0) && (
                  <span className={`absolute -top-0.5 -right-0.5 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-semibold px-1 ${
                    criticalAlertsCount > 0 ? "bg-rose-500 animate-pulse" : alertsCount > 0 ? "bg-amber-500" : "bg-blue-500"
                  }`}>
                    {(unreadCount + alertsCount) > 9 ? "9+" : (unreadCount + alertsCount)}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-100">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Needs Attention Alerts Summary */}
                  {alertsCount > 0 && (
                    <div
                      className={`p-3 border-b cursor-pointer hover:bg-slate-800/50 transition ${
                        criticalAlertsCount > 0 ? "bg-rose-500/10 border-rose-500/30" : "bg-amber-500/10 border-amber-500/30"
                      }`}
                      onClick={() => {
                        setShowNotifications(false);
                        setView("ad-accounts");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          criticalAlertsCount > 0 ? "bg-rose-500/20" : "bg-amber-500/20"
                        }`}>
                          <svg className={`w-4 h-4 ${criticalAlertsCount > 0 ? "text-rose-400" : "text-amber-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${criticalAlertsCount > 0 ? "text-rose-300" : "text-amber-300"}`}>
                            {alertsCount} Account{alertsCount !== 1 ? "s" : ""} Need Attention
                          </div>
                          <div className="text-xs text-slate-400">
                            {criticalAlertsCount > 0 && `${criticalAlertsCount} critical • `}
                            Click to view in Ad Accounts
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  )}

                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 && alertsCount === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm">
                        No notifications yet
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm">
                        No other notifications
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            if (!notif.isRead) markAsRead(notif.id);
                          }}
                          className={`p-4 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/30 transition ${
                            !notif.isRead ? "bg-indigo-500/5" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-medium text-slate-200">{notif.title}</h4>
                                {!notif.isRead && (
                                  <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{notif.message}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {formatDateForDisplay(notif.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <a
              href="https://magimanager.com/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg transition flex flex-col items-center"
            >
              <span className="text-xs font-semibold">Kadabra</span>
              <span className="text-[9px] opacity-80">Ad Manager</span>
            </a>
          </div>
        </header>

        {/* Page body */}
        <div className="flex-1 overflow-y-auto px-8 py-8 bg-slate-950">
          {/* Ad Accounts needs full width */}
          {view === "ad-accounts" && (
            <AdAccountsView onDataChange={fetchAccounts} onNavigate={(v) => setView(v as View)} />
          )}

          {/* Other views use constrained width */}
          <div className={`max-w-5xl mx-auto ${view === "ad-accounts" ? "hidden" : ""}`}>
            {view === "dashboard" && <DashboardView identities={identities} accounts={accounts} loading={loading} onNavigate={setView} />}
            {view === "identities" && (
              <IdentitiesListView
                identities={identities}
                loading={loading}
                onCreateNew={() => setView("create-identity")}
                onSelectIdentity={fetchIdentity}
              />
            )}
            {view === "create-identity" && (
              <CreateIdentityView
                onSuccess={handleCreateSuccess}
                onCancel={() => setView("identities")}
                requestId={pendingRequestId}
              />
            )}
            {view === "identity-detail" && selectedIdentity && (
              <IdentityDetailView
                identity={selectedIdentity}
                onBack={() => setView("identities")}
                onDelete={handleDeleteSuccess}
                onEdit={() => setView("edit-identity")}
                onRefresh={() => fetchIdentity(selectedIdentity.id)}
                onViewAccount={() => setView("ad-accounts")}
              />
            )}
            {view === "edit-identity" && selectedIdentity && (
              <EditIdentityView
                identity={selectedIdentity}
                onSuccess={() => {
                  fetchIdentity(selectedIdentity.id);
                  setView("identity-detail");
                }}
                onCancel={() => setView("identity-detail")}
              />
            )}
            {view === "team" && <TeamView />}
            {view === "my-accounts" && <MyAccountsView />}
            {view === "requests" && <MyRequestsView />}
            {view === "admin-requests" && (
              <AdminRequestsView
                onApprove={(requestId) => {
                  setPendingRequestId(requestId);
                  setView("create-identity");
                }}
              />
            )}
            {view === "settings" && <SettingsView />}
            {view === "system" && <SystemView />}
            {view === "sms-dashboard" && (
              <div className="p-8 max-w-2xl mx-auto text-center">
                <div className="mb-6">
                  <span className="text-6xl grayscale opacity-50">📱</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-200 mb-3">
                  SMS Verification
                  <span className="ml-2 text-sm font-bold px-2 py-1 bg-red-500/20 text-red-400 rounded uppercase">
                    Coming Soon
                  </span>
                </h2>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  Streamlined phone verification management is on the way. Rent numbers, receive codes,
                  and manage all your SMS verifications from one centralized dashboard.
                </p>
                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left">
                  <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Feature</div>
                    <div className="text-slate-300 text-sm">Bulk Verification</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Feature</div>
                    <div className="text-slate-300 text-sm">Auto Code Extraction</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Feature</div>
                    <div className="text-slate-300 text-sm">Balance Tracking</div>
                  </div>
                  <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Feature</div>
                    <div className="text-slate-300 text-sm">TextVerified Integration</div>
                  </div>
                </div>
                <p className="text-slate-600 text-xs mt-6">
                  We&apos;re working hard to bring you this feature. Stay tuned!
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* First Login Password Change Modal */}
      {showPasswordChangeModal && (
        <FirstLoginPasswordChangeModal
          onSuccess={() => {
            setShowPasswordChangeModal(false);
            setFirstLogin(false);
          }}
        />
      )}

      {/* Profile Modal */}
      {showProfileModal && session?.user && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
          user={{
            name: session.user.name || "",
            email: session.user.email || "",
          }}
          onUpdate={() => {
            // Trigger session refresh
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// DASHBOARD VIEW
// ============================================================================

function DashboardView({ identities, accounts, loading, onNavigate }: {
  identities: Identity[];
  accounts: AdAccount[];
  loading: boolean;
  onNavigate: (view: View) => void;
}) {
  // Filter out archived items for dashboard stats
  const activeIdentities = identities.filter(i => !i.archived);
  const activeAccounts = accounts.filter(a => a.handoffStatus !== "archived");

  const recentIdentities = activeIdentities.slice(0, 4);

  // Compute real metrics (exclude archived)
  const warmingUpCount = activeAccounts.filter(a => a.status === "warming-up").length;
  const readyCount = activeAccounts.filter(a => a.status === "ready").length;
  const handedOffCount = activeAccounts.filter(a => a.handoffStatus === "handed-off").length;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          High-level overview of your Account Factory. See identities, accounts, and warmup status at a glance.
        </p>
        <div className="mt-4 p-3 rounded-lg border border-slate-800 bg-slate-900/40">
          <p className="text-xs font-semibold text-slate-300 mb-2">Current Manual Pipeline We Are Solving:</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <div className="whitespace-nowrap">👤 User creates Identity Profile + Website</div>
            <div className="text-slate-500">→</div>
            <div className="whitespace-nowrap">🔐 User creates GoLogin Profile</div>
            <div className="text-slate-500">→</div>
            <div className="whitespace-nowrap">💳 User creates Ad Account</div>
            <div className="text-slate-500">→</div>
            <div className="whitespace-nowrap">🔥 User warms up Account</div>
            <div className="text-slate-500">→</div>
            <div className="whitespace-nowrap">🤝 User hands off Account to Media Buyer</div>
          </div>
        </div>
      </div>

      {loading ? (
        <>
          <SkeletonStatCards count={4} />
          <div className="mt-10">
            <SkeletonRecentIdentities />
          </div>
        </>
      ) : (
      <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              ID Profiles
            </p>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xl">
              👤
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-50 mb-1">{activeIdentities.length}</p>
          <p className="text-xs text-slate-500">
            Stored ID profiles (KYC records).
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              In Warmup
            </p>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-xl">
              ⏳
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-50 mb-1">{warmingUpCount}</p>
          <p className="text-xs text-slate-500">
            Accounts currently warming up.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Ready to Deploy
            </p>
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-xl">
              ✓
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-50 mb-1">{readyCount}</p>
          <p className="text-xs text-slate-500">
            Warmup complete, ready for handoff.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Handed Off
            </p>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-xl">
              🚀
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-50 mb-1">{handedOffCount}</p>
          <p className="text-xs text-slate-500">
            Assigned to media buyers.
          </p>
        </div>
      </div>

      {/* Recent Identities */}
      {recentIdentities.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Recent ID Profiles
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Your most recently created profiles
              </p>
            </div>
            <button
              onClick={() => onNavigate("identities")}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View all →
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {recentIdentities.map((identity) => (
              <button
                key={identity.id}
                onClick={() => onNavigate("identities")}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                    {identity.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">
                      {identity.fullName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {identity.geo}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {new Date(identity.createdAt).toLocaleDateString()}
                  </span>
                  {identity.documents.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      {identity.documents.length} docs
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-slate-200 mb-2">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            onClick={() => onNavigate("create-identity")}
            className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition"
          >
            + New Identity Profile
          </button>
          <button
            onClick={() => onNavigate("identities")}
            className="inline-flex items-center rounded-lg border border-slate-700 px-4 py-2 text-slate-100 hover:bg-slate-800 transition"
          >
            View ID Profiles
          </button>
        </div>
      </div>
      </>
      )}
    </>
  );
}

// ============================================================================
// IDENTITIES LIST VIEW (with search, filters, pagination, and archive)
// ============================================================================

const ITEMS_PER_PAGE = 20;

function IdentitiesListView({
  identities,
  loading,
  onCreateNew,
  onSelectIdentity,
}: {
  identities: Identity[];
  loading: boolean;
  onCreateNew: () => void;
  onSelectIdentity: (id: string) => void;
}) {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [geoFilter, setGeoFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Get unique geos for filter dropdown
  const uniqueGeos = useMemo(() => {
    const geos = new Set(identities.map(i => i.geo));
    return Array.from(geos).sort();
  }, [identities]);

  // Filter and search identities
  const filteredIdentities = useMemo(() => {
    return identities.filter((identity) => {
      // Archive filter
      if (!showArchived && identity.archived) return false;
      if (showArchived && !identity.archived) return false;

      // Geo filter
      if (geoFilter !== "all" && identity.geo !== geoFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          identity.fullName,
          identity.geo,
          identity.email,
          identity.address,
          identity.city,
          identity.state,
        ].filter(Boolean);
        return searchFields.some(field => field?.toLowerCase().includes(query));
      }

      return true;
    });
  }, [identities, searchQuery, geoFilter, showArchived]);

  // Pagination
  const totalPages = Math.ceil(filteredIdentities.length / ITEMS_PER_PAGE);
  const paginatedIdentities = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredIdentities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredIdentities, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, geoFilter, showArchived]);

  const hasIdentities = filteredIdentities.length > 0;
  const totalCount = identities.filter(i => showArchived ? i.archived : !i.archived).length;
  const archivedCount = identities.filter(i => i.archived).length;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1">
          Internal identity records used to create and manage future Google Ads accounts.
        </p>
      </div>

      {/* Header with Create Button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            {showArchived ? "Archived ID Profiles" : "Stored ID Profiles"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {filteredIdentities.length} of {totalCount} profiles
            {archivedCount > 0 && !showArchived && (
              <span className="text-slate-500"> ({archivedCount} archived)</span>
            )}
          </p>
        </div>

        <button
          onClick={onCreateNew}
          className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition"
        >
          + New Identity Profile
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, location..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Geo Filter */}
        <select
          value={geoFilter}
          onChange={(e) => setGeoFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Countries</option>
          {uniqueGeos.map((geo) => (
            <option key={geo} value={geo}>{geo}</option>
          ))}
        </select>

        {/* Show Archived Toggle */}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
            showArchived
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
          }`}
        >
          {showArchived ? "Showing Archived" : "Show Archived"}
          {archivedCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-slate-700 rounded">
              {archivedCount}
            </span>
          )}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Country
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Email
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400" title="Ad Account linked">
                Account
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400" title="Documents uploaded">
                Docs
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400" title="GoLogin profile created">
                GoLogin
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-4 rounded-full mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-4 rounded-full mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-4 rounded-full mx-auto" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                </tr>
              ))
            ) : hasIdentities ? (
              paginatedIdentities.map((identity) => {
                const hasAdAccount = identity.adAccounts && identity.adAccounts.length > 0;
                const hasDocs = identity.documents.length > 0;
                const hasGoLogin = !!identity.gologinProfile?.profileId;

                return (
                  <tr
                    key={identity.id}
                    onClick={() => onSelectIdentity(identity.id)}
                    className={`border-t border-slate-800 hover:bg-slate-800/60 transition cursor-pointer ${
                      identity.archived ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-100">
                      <div className="flex items-center gap-2">
                        {identity.fullName}
                        {identity.archived && (
                          <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                            Archived
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {identity.geo}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {identity.email || "-"}
                    </td>
                    {/* Ad Account Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${
                          hasAdAccount ? "bg-emerald-500" : "bg-red-500"
                        }`}
                        title={hasAdAccount ? "Ad account linked" : "No ad account"}
                      />
                    </td>
                    {/* Docs Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${
                          hasDocs ? "bg-emerald-500" : "bg-red-500"
                        }`}
                        title={hasDocs ? `${identity.documents.length} document(s)` : "No documents"}
                      />
                    </td>
                    {/* GoLogin Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${
                          hasGoLogin ? "bg-emerald-500" : "bg-red-500"
                        }`}
                        title={hasGoLogin ? "GoLogin profile active" : "No GoLogin profile"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <span className="text-emerald-400">
                        View →
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  {searchQuery || geoFilter !== "all" ? (
                    <>
                      No identities match your search.{" "}
                      <button
                        onClick={() => { setSearchQuery(""); setGeoFilter("all"); }}
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        Clear filters
                      </button>
                    </>
                  ) : showArchived ? (
                    "No archived identities."
                  ) : (
                    <>
                      No identities yet.{" "}
                      <button
                        onClick={onCreateNew}
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        Create the first one.
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-xs text-slate-400">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredIdentities.length)} of {filteredIdentities.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      currentPage === pageNum
                        ? "bg-emerald-500 text-slate-950 font-medium"
                        : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// ACCOUNTS VIEW
// ============================================================================

function AccountsView({
  accounts,
  loading,
  onAccountAssigned,
}: {
  accounts: AdAccount[];
  loading: boolean;
  onAccountAssigned: () => void;
}) {
  const { showAlert, showConfirm, showSuccess, showError } = useModal();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [simulating, setSimulating] = useState<string | null>(null);
  const [assigningAccount, setAssigningAccount] = useState<string | null>(null);
  const [selectedMediaBuyer, setSelectedMediaBuyer] = useState<string>("");
  const [assignmentNotes, setAssignmentNotes] = useState<string>("");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [mediaBuyers, setMediaBuyers] = useState<MediaBuyer[]>([]);

  // Fetch media buyers when component mounts
  useEffect(() => {
    async function fetchMediaBuyers() {
      try {
        const res = await fetch("/api/media-buyers");
        if (res.ok) {
          const data = await res.json();
          setMediaBuyers(data || []);
        }
      } catch (error) {
        console.error("Failed to fetch media buyers:", error);
      }
    }
    fetchMediaBuyers();
  }, []);

  const filteredAccounts = accounts.filter((account) => {
    if (statusFilter === "all") return true;
    return account.status === statusFilter;
  });

  async function handleSimulateWarmup(accountId: string) {
    setSimulating(accountId);
    try {
      const res = await fetch(`/api/accounts/${accountId}/simulate-warmup`, {
        method: "POST",
      });

      if (res.ok) {
        // Refresh the page to see updated data
        window.location.reload();
      } else {
        await showError("Warmup Failed", "Failed to simulate warmup");
      }
    } catch (error) {
      console.error("Simulate warmup error:", error);
      await showError("Network Error", "Network error occurred");
    } finally {
      setSimulating(null);
    }
  }

  async function handleAssignAccount(accountId: string) {
    if (!selectedMediaBuyer) {
      await showAlert("Select Media Buyer", "Please select a media buyer");
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${accountId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaBuyerId: selectedMediaBuyer,
          notes: assignmentNotes || null,
        }),
      });

      if (res.ok) {
        await showSuccess("Account Assigned", "Account assigned successfully! Email notification sent to media buyer.");
        setAssigningAccount(null);
        setSelectedMediaBuyer("");
        setAssignmentNotes("");
        onAccountAssigned();
      } else {
        const data = await res.json();
        await showError("Assignment Failed", "Failed to assign account: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Assign account error:", error);
      await showError("Network Error", "Network error occurred");
    }
  }

  function openNotesModal(account: AdAccount) {
    setEditingNotes(account.id);
  }

  async function handleDeleteAccount(accountId: string) {
    const account = accounts.find(a => a.id === accountId);
    const confirmed = await showConfirm(
      "Delete Account",
      `Are you sure you want to delete account ${account?.googleCid || 'this account'}? This action cannot be undone.`,
      { confirmText: "Delete", cancelText: "Cancel" }
    );
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onAccountAssigned(); // Refresh the accounts list
      } else {
        const data = await res.json();
        await showError("Delete Failed", "Failed to delete account: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Delete account error:", error);
      await showError("Network Error", "Network error occurred");
    }
  }

  function getStatusBadge(status: string) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      provisioned: { bg: "bg-slate-500/10", text: "text-slate-400", label: "Provisioned" },
      "warming-up": { bg: "bg-amber-500/10", text: "text-amber-400", label: "Warming Up" },
      ready: { bg: "bg-green-500/10", text: "text-green-400", label: "Ready" },
      "handed-off": { bg: "bg-blue-500/10", text: "text-blue-400", label: "Handed Off" },
      available: { bg: "bg-slate-500/10", text: "text-slate-400", label: "Available" },
    };

    const badge = badges[status] || badges.provisioned;
    return (
      <span className={`inline-flex rounded-full ${badge.bg} px-2 py-1 text-xs ${badge.text}`}>
        {badge.label}
      </span>
    );
  }

  const hasAccounts = accounts.length > 0;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Manage Google Ads accounts, track warmup progress, and handle handoffs to media buyers.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-2 text-xs">
        <button
          onClick={() => setStatusFilter("all")}
          className={`rounded-lg px-3 py-1.5 transition ${
            statusFilter === "all"
              ? "bg-emerald-500 text-slate-950 font-medium"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          All ({accounts.length})
        </button>
        <button
          onClick={() => setStatusFilter("provisioned")}
          className={`rounded-lg px-3 py-1.5 transition ${
            statusFilter === "provisioned"
              ? "bg-emerald-500 text-slate-950 font-medium"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Provisioned ({accounts.filter((a) => a.status === "provisioned").length})
        </button>
        <button
          onClick={() => setStatusFilter("warming-up")}
          className={`rounded-lg px-3 py-1.5 transition ${
            statusFilter === "warming-up"
              ? "bg-emerald-500 text-slate-950 font-medium"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Warming Up ({accounts.filter((a) => a.status === "warming-up").length})
        </button>
        <button
          onClick={() => setStatusFilter("ready")}
          className={`rounded-lg px-3 py-1.5 transition ${
            statusFilter === "ready"
              ? "bg-emerald-500 text-slate-950 font-medium"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Ready ({accounts.filter((a) => a.status === "ready").length})
        </button>
        <button
          onClick={() => setStatusFilter("handed-off")}
          className={`rounded-lg px-3 py-1.5 transition ${
            statusFilter === "handed-off"
              ? "bg-emerald-500 text-slate-950 font-medium"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Handed Off ({accounts.filter((a) => a.status === "handed-off").length})
        </button>
      </div>

      {/* Accounts table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Identity
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Google CID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Warmup Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Ads
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                GoLogin
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Assigned To
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : hasAccounts ? (
              filteredAccounts.map((account) => {
                const progress = (account.currentSpendTotal / account.warmupTargetSpend) * 100;
                return (
                  <tr
                    key={account.id}
                    className="border-t border-slate-800 hover:bg-slate-800/60 transition"
                  >
                    <td className="px-4 py-3 text-sm text-slate-100">
                      {account.identityProfile?.fullName || "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                      {formatCid(account.googleCid) || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {getStatusBadge(account.handoffStatus === "handed-off" ? "handed-off" : account.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-16 text-right">
                          ${account.currentSpendTotal}/${account.warmupTargetSpend}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {account.adsCount}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {account.identityProfile?.gologinProfile ? (
                        <span className="text-emerald-400">{account.identityProfile.gologinProfile.status}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {account.mediaBuyer ? (
                        <div>
                          <div className="text-slate-200">{account.mediaBuyer.name}</div>
                          <div className="text-slate-500">{account.mediaBuyer.email}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openNotesModal(account)}
                          className="text-xs text-slate-400 hover:text-slate-300"
                          title="View conversation thread"
                        >
                          💬 Thread
                        </button>
                        {account.status !== "ready" && account.handoffStatus !== "handed-off" && (
                          <button
                            onClick={() => handleSimulateWarmup(account.id)}
                            disabled={simulating === account.id}
                            className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                          >
                            {simulating === account.id ? "..." : "Simulate +1 Day"}
                          </button>
                        )}
                        {account.status === "ready" && account.handoffStatus !== "handed-off" && (
                          <button
                            onClick={() => setAssigningAccount(account.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Assign
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-xs text-rose-400 hover:text-rose-300"
                          title="Delete account"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  No accounts yet. Create an identity first, then create an ad account from the identity detail page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Assignment Modal */}
      {assigningAccount && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              Assign Account to Media Buyer
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Select Media Buyer <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedMediaBuyer}
                  onChange={(e) => setSelectedMediaBuyer(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Select a media buyer --</option>
                  {mediaBuyers.filter(mb => mb.isActive).map((mb) => (
                    <option key={mb.id} value={mb.id}>
                      {mb.name} ({mb.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Any special instructions or notes..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setAssigningAccount(null);
                  setSelectedMediaBuyer("");
                  setAssignmentNotes("");
                }}
                className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssignAccount(assigningAccount)}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-400 transition"
              >
                Assign Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thread Conversation Modal */}
      {editingNotes && (
        <ThreadConversationModal
          accountId={editingNotes}
          onClose={() => setEditingNotes(null)}
        />
      )}
    </>
  );
}

// ============================================================================
// CREATE IDENTITY VIEW
// ============================================================================

function CreateIdentityView({
  onSuccess,
  onCancel,
  requestId,
}: {
  onSuccess: () => void;
  onCancel: () => void;
  requestId?: string | null;
}) {
  const { showError } = useModal();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<File[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingAccount, setHasExistingAccount] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);

    // Append documents
    documents.forEach((doc) => {
      formData.append("documents", doc);
    });

    try {
      const res = await fetch("/api/identities", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        // If this was triggered from an approved request, update the request status
        if (requestId) {
          try {
            await fetch(`/api/requests/${requestId}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "PROFILE_CREATED" }),
            });
          } catch (error) {
            console.error("Failed to update request status:", error);
          }
        }
        onSuccess();
      } else if (data.errors) {
        setErrors(data.errors);
      } else {
        await showError("Create Failed", "Failed to create identity: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Submit error:", error);
      await showError("Network Error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files));
    }
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Enter identity details for a future Google Ads account. This information is stored internally as part of the Account Factory system.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        {/* Full Name + DOB + Country row */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-5 space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              name="fullName"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="John Doe"
              required
            />
            {errors.fullName && <p className="text-xs text-rose-400 mt-1">{errors.fullName}</p>}
          </div>
          <div className="col-span-3 space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              DOB <span className="text-rose-400">*</span>
            </label>
            <input
              name="dob"
              type="date"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              required
            />
            {errors.dob && <p className="text-xs text-rose-400 mt-1">{errors.dob}</p>}
          </div>
          <div className="col-span-4 space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Country <span className="text-rose-400">*</span>
            </label>
            <select
              name="geo"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              defaultValue="United States"
              required
            >
              {GEO_OPTIONS.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            {errors.geo && <p className="text-xs text-rose-400 mt-1">{errors.geo}</p>}
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Phone Number (optional)
          </label>
          <input
            name="phone"
            type="tel"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="+1 555 123 4567"
          />
          {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
        </div>

        {/* Address */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Street Address <span className="text-rose-400">*</span>
          </label>
          <input
            name="address"
            type="text"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="123 Main Street"
            autoComplete="street-address"
            required
          />
          {errors.address && <p className="text-xs text-rose-400 mt-1">{errors.address}</p>}
        </div>

        {/* City, State, and Zipcode */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-5 space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              City <span className="text-rose-400">*</span>
            </label>
            <input
              name="city"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="New York"
              autoComplete="address-level2"
              required
            />
            {errors.city && <p className="text-xs text-rose-400 mt-1">{errors.city}</p>}
          </div>
          <div className="col-span-4 space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              State <span className="text-rose-400">*</span>
            </label>
            <select
              name="state"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              required
            >
              <option value="">Select</option>
              <option value="AL">AL</option>
              <option value="AK">AK</option>
              <option value="AZ">AZ</option>
              <option value="AR">AR</option>
              <option value="CA">CA</option>
              <option value="CO">CO</option>
              <option value="CT">CT</option>
              <option value="DE">DE</option>
              <option value="FL">FL</option>
              <option value="GA">GA</option>
              <option value="HI">HI</option>
              <option value="ID">ID</option>
              <option value="IL">IL</option>
              <option value="IN">IN</option>
              <option value="IA">IA</option>
              <option value="KS">KS</option>
              <option value="KY">KY</option>
              <option value="LA">LA</option>
              <option value="ME">ME</option>
              <option value="MD">MD</option>
              <option value="MA">MA</option>
              <option value="MI">MI</option>
              <option value="MN">MN</option>
              <option value="MS">MS</option>
              <option value="MO">MO</option>
              <option value="MT">MT</option>
              <option value="NE">NE</option>
              <option value="NV">NV</option>
              <option value="NH">NH</option>
              <option value="NJ">NJ</option>
              <option value="NM">NM</option>
              <option value="NY">NY</option>
              <option value="NC">NC</option>
              <option value="ND">ND</option>
              <option value="OH">OH</option>
              <option value="OK">OK</option>
              <option value="OR">OR</option>
              <option value="PA">PA</option>
              <option value="RI">RI</option>
              <option value="SC">SC</option>
              <option value="SD">SD</option>
              <option value="TN">TN</option>
              <option value="TX">TX</option>
              <option value="UT">UT</option>
              <option value="VT">VT</option>
              <option value="VA">VA</option>
              <option value="WA">WA</option>
              <option value="WV">WV</option>
              <option value="WI">WI</option>
              <option value="WY">WY</option>
              <option value="DC">DC</option>
            </select>
            {errors.state && <p className="text-xs text-rose-400 mt-1">{errors.state}</p>}
          </div>
          <div className="col-span-3 space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Zip <span className="text-rose-400">*</span>
            </label>
            <input
              name="zipcode"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="10001"
              autoComplete="postal-code"
              required
            />
            {errors.zipcode && <p className="text-xs text-rose-400 mt-1">{errors.zipcode}</p>}
          </div>
        </div>

        {/* Website */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Website (optional)
          </label>
          <input
            name="website"
            type="url"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="https://example.com"
          />
          {errors.website && <p className="text-xs text-rose-400 mt-1">{errors.website}</p>}
        </div>

        {/* Divider - Ad Account Credentials */}
        <div className="border-t border-slate-700 pt-6 mt-6">
          <h3 className="text-sm font-medium text-slate-200 mb-1">Ad Account Credentials</h3>
          <p className="text-xs text-slate-500 mb-4">
            Check below if this identity has an existing Google Ads account or is taking over one.
          </p>

          {/* Checkbox for existing account */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={hasExistingAccount}
              onChange={(e) => setHasExistingAccount(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-slate-300 group-hover:text-slate-100 transition">
              This identity has an existing ad account or is taking over one
            </span>
          </label>
        </div>

        {/* Conditional Ad Account Fields */}
        {hasExistingAccount && (
          <>
            {/* Google Ads CID */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200 flex items-center gap-2">
                Google Ads CID (optional)
                <span
                  className="text-slate-500 hover:text-slate-300 cursor-help transition"
                  title="Customer ID (CID) is your unique Google Ads account identifier. Find it in Google Ads at the top right corner next to your account name, formatted as XXX-XXX-XXXX."
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                </span>
              </label>
              <input
                name="googleCid"
                type="text"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                placeholder="123-456-7890"
                maxLength={12}
              />
              <p className="text-xs text-slate-500">
                The 10-digit Customer ID from Google Ads (format: XXX-XXX-XXXX). Find it in Google Ads → top right corner.
              </p>
            </div>

            {/* Ad Account Email */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Ad Account Email
              </label>
              <input
                name="email"
                type="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="adaccount@gmail.com"
              />
              <p className="text-xs text-slate-500">
                The Gmail address used for the Google Ads account
              </p>
              {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email}</p>}
            </div>

            {/* Email Password */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Email Password
              </label>
              <div className="relative">
                <input
                  name="emailPassword"
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Password for the ad account email
              </p>
              {errors.emailPassword && <p className="text-xs text-rose-400 mt-1">{errors.emailPassword}</p>}
            </div>

          </>
        )}

        {/* Divider - Billing Information */}
        <div className="border-t border-slate-700 pt-6 mt-6">
          <h3 className="text-sm font-medium text-slate-200 mb-1">Billing Information</h3>
          <p className="text-xs text-slate-500 mb-4">
            Credit card and billing details for this identity. One card per identity profile.
          </p>
        </div>

        {/* CC Number and Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Card Number (optional)
            </label>
            <input
              name="ccNumber"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="4111 1111 1111 1111"
              maxLength={19}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Name on Card (optional)
            </label>
            <input
              name="ccName"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="John Doe"
            />
          </div>
        </div>

        {/* CC Exp, CVV, Billing Zip */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Expiration (optional)
            </label>
            <input
              name="ccExp"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="MM/YY"
              maxLength={5}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              CVV (optional)
            </label>
            <input
              name="ccCvv"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="123"
              maxLength={4}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Billing Zip (optional)
            </label>
            <input
              name="billingZip"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="10001"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Notes (optional)
          </label>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="Any additional notes about this identity..."
          />
          {errors.notes && <p className="text-xs text-rose-400 mt-1">{errors.notes}</p>}
        </div>

        {/* Documents */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Documents (optional)
          </label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-50 hover:file:bg-slate-700"
          />
          <p className="text-xs text-slate-500">
            Attach KYC documents, screenshots, or PDFs. Files are stored internally in the dev environment for now.
          </p>
          {documents.length > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              {documents.length} file(s) selected
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Identity"}
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          This is a development form for the internal Account Factory. Data is stored in your local PostgreSQL database.
        </p>
      </form>
    </>
  );
}

// ============================================================================
// EDIT IDENTITY VIEW
// ============================================================================

const DOCUMENT_TYPES = [
  { value: 'drivers_license_front', label: "Driver's License (Front)" },
  { value: 'drivers_license_back', label: "Driver's License (Back)" },
  { value: 'passport', label: 'Passport' },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'selfie', label: 'Selfie with ID' },
  { value: 'other', label: 'Other' },
];

function EditIdentityView({
  identity,
  onSuccess,
  onCancel,
}: {
  identity: Identity;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { showError, showConfirm } = useModal();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Document upload state
  const [documents, setDocuments] = useState<IdentityDoc[]>(identity.documents || []);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-detect document type from filename
  function detectDocType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('license') || lower.includes('dl')) {
      return lower.includes('back') ? 'drivers_license_back' : 'drivers_license_front';
    }
    if (lower.includes('passport')) return 'passport';
    if (lower.includes('bill') || lower.includes('utility')) return 'utility_bill';
    if (lower.includes('bank') || lower.includes('statement')) return 'bank_statement';
    if (lower.includes('selfie')) return 'selfie';
    return 'other';
  }

  async function uploadFile(file: File) {
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', detectDocType(file.name));

      const res = await fetch(`/api/identities/${identity.id}/documents`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        setDocuments([result, ...documents]);
        onSuccess();
      } else {
        await showError('Upload Failed', result.error || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Upload error:', error);
      await showError('Upload Failed', 'Network error. Please try again.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleDocumentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDocumentDelete(docId: string, docType: string) {
    const confirmed = await showConfirm(
      'Delete Document',
      `Are you sure you want to delete this ${DOCUMENT_TYPES.find(t => t.value === docType)?.label || docType}?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/identities/${identity.id}/documents?documentId=${docId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDocuments(documents.filter(d => d.id !== docId));
        // Refresh parent data so dashboard indicators update
        onSuccess();
      } else {
        const result = await res.json();
        await showError('Delete Failed', result.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Delete error:', error);
      await showError('Delete Failed', 'Network error. Please try again.');
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get("fullName"),
      dob: formData.get("dob"),
      address: formData.get("address"),
      city: formData.get("city"),
      state: formData.get("state"),
      zipcode: formData.get("zipcode"),
      geo: formData.get("geo"),
      website: formData.get("website"),
      notes: formData.get("notes"),
      // Credential fields
      email: formData.get("email"),
      emailPassword: formData.get("emailPassword"),
      phone: formData.get("phone"),
      backupCodes: formData.get("backupCodes"),
      // Billing fields
      ccNumber: formData.get("ccNumber"),
      ccExp: formData.get("ccExp"),
      ccCvv: formData.get("ccCvv"),
      ccName: formData.get("ccName"),
      billingZip: formData.get("billingZip"),
    };

    try {
      const res = await fetch(`/api/identities/${identity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        onSuccess();
      } else if (result.errors) {
        setErrors(result.errors);
      } else {
        await showError("Update Failed", "Failed to update identity: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Submit error:", error);
      await showError("Network Error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Update identity details. Changes will be saved immediately.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        {/* Full Name */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Full Name <span className="text-rose-400">*</span>
          </label>
          <input
            name="fullName"
            type="text"
            defaultValue={identity.fullName}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="John Doe"
            required
          />
          {errors.fullName && <p className="text-xs text-rose-400 mt-1">{errors.fullName}</p>}
        </div>

        {/* Date of Birth and Phone */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Date of Birth <span className="text-rose-400">*</span>
            </label>
            <input
              name="dob"
              type="date"
              defaultValue={formatDateToInputString(new Date(identity.dob))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              required
            />
            {errors.dob && <p className="text-xs text-rose-400 mt-1">{errors.dob}</p>}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Phone Number (optional)
            </label>
            <input
              name="phone"
              type="tel"
              defaultValue={identity.phone || ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="+1 555 123 4567"
            />
            {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Address <span className="text-rose-400">*</span>
          </label>
          <input
            name="address"
            type="text"
            defaultValue={identity.address}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="123 Example St"
            required
          />
          {errors.address && <p className="text-xs text-rose-400 mt-1">{errors.address}</p>}
        </div>

        {/* City, State, and Zipcode */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              City <span className="text-rose-400">*</span>
            </label>
            <input
              name="city"
              type="text"
              defaultValue={identity.city}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="New York"
              required
            />
            {errors.city && <p className="text-xs text-rose-400 mt-1">{errors.city}</p>}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              State <span className="text-rose-400">*</span>
            </label>
            <input
              name="state"
              type="text"
              defaultValue={identity.state}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="NY"
              required
            />
            {errors.state && <p className="text-xs text-rose-400 mt-1">{errors.state}</p>}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Zipcode <span className="text-rose-400">*</span>
            </label>
            <input
              name="zipcode"
              type="text"
              defaultValue={identity.zipcode}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="10001"
              required
            />
            {errors.zipcode && <p className="text-xs text-rose-400 mt-1">{errors.zipcode}</p>}
          </div>
        </div>

        {/* Country */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Country/Region <span className="text-rose-400">*</span>
          </label>
          <select
            name="geo"
            defaultValue={identity.geo}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            required
          >
            <option value="">Select a country</option>
            {GEO_OPTIONS.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {errors.geo && <p className="text-xs text-rose-400 mt-1">{errors.geo}</p>}
        </div>

        {/* Website */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Website (optional)
          </label>
          <input
            name="website"
            type="url"
            defaultValue={identity.website || ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="https://example.com"
          />
          {errors.website && <p className="text-xs text-rose-400 mt-1">{errors.website}</p>}
        </div>

        {/* Divider - Ad Account Credentials */}
        <div className="border-t border-slate-700 pt-6 mt-6">
          <h3 className="text-sm font-medium text-slate-200 mb-1">Ad Account Credentials</h3>
          <p className="text-xs text-slate-500 mb-4">
            Email and credentials for the Google Ads account. Only fill this if the identity already has or is taking over an ad account.
          </p>
        </div>

        {/* Ad Account Email */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Ad Account Email (optional)
          </label>
          <input
            name="email"
            type="email"
            defaultValue={identity.email || ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="adaccount@gmail.com"
          />
          <p className="text-xs text-slate-500">
            The Gmail address used for the Google Ads account (not personal email)
          </p>
          {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email}</p>}
        </div>

        {/* Email Password */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Email Password (optional)
          </label>
          <div className="relative">
            <input
              name="emailPassword"
              type={showPassword ? "text" : "password"}
              defaultValue={identity.emailPassword || ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="Enter password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Password for the ad account email
          </p>
          {errors.emailPassword && <p className="text-xs text-rose-400 mt-1">{errors.emailPassword}</p>}
        </div>

        {/* Divider - Billing Information */}
        <div className="border-t border-slate-700 pt-6 mt-6">
          <h3 className="text-sm font-medium text-slate-200 mb-1">Billing Information</h3>
          <p className="text-xs text-slate-500 mb-4">
            Credit card and billing details for this identity. One card per identity profile.
          </p>
        </div>

        {/* CC Number and Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Card Number (optional)
            </label>
            <input
              name="ccNumber"
              type="text"
              defaultValue={identity.ccNumber || ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="4111 1111 1111 1111"
              maxLength={19}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Name on Card (optional)
            </label>
            <input
              name="ccName"
              type="text"
              defaultValue={identity.ccName || ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="John Doe"
            />
          </div>
        </div>

        {/* CC Exp, CVV, Billing Zip */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Expiration (optional)
            </label>
            <input
              name="ccExp"
              type="text"
              defaultValue={identity.ccExp || ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="MM/YY"
              maxLength={5}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              CVV (optional)
            </label>
            <input
              name="ccCvv"
              type="text"
              defaultValue={identity.ccCvv || ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="123"
              maxLength={4}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200">
              Billing Zip (optional)
            </label>
            <input
              name="billingZip"
              type="text"
              defaultValue={identity.billingZip || ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="10001"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Notes (optional)
          </label>
          <textarea
            name="notes"
            defaultValue={identity.notes || ""}
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="Internal notes about this identity..."
          />
          <p className="text-xs text-slate-500">
            These notes are for internal use only and are not shared externally.
          </p>
        </div>

        {/* Divider - Documents */}
        <div className="border-t border-slate-700 pt-6 mt-6">
          <h3 className="text-sm font-medium text-slate-200 mb-1">Identity Documents</h3>
          <p className="text-xs text-slate-500 mb-4">
            Upload ID, utility bills, bank statements, etc.
          </p>
        </div>

        {/* Document Upload - Drag & Drop Zone */}
        <div className="space-y-4">
          <label
            className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : uploadingDoc
                ? 'border-slate-600 bg-slate-800/50 cursor-not-allowed'
                : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleDocumentUpload}
              disabled={uploadingDoc}
              className="sr-only"
            />
            {uploadingDoc ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm">
                  {isDragging ? 'Drop file here' : 'Drag & drop or click to upload'}
                </span>
                <span className="text-xs text-slate-500">Images or PDF, max 10MB</span>
              </div>
            )}
          </label>

          {/* Document List */}
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-slate-400">
                      {doc.filePath.endsWith('.pdf') ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-200">
                        {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                      </p>
                      <p className="text-xs text-slate-500">
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-slate-200 transition"
                      title="View document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDocumentDelete(doc.id, doc.type)}
                      className="p-2 text-slate-400 hover:text-rose-400 transition"
                      title="Delete document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No documents uploaded yet.</p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-700 px-6 py-2 text-sm text-slate-100 hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}

// ============================================================================
// ASSIGN EXISTING ACCOUNT MODAL
// ============================================================================

function AssignExistingAccountModal({
  identity,
  onClose,
  onAssign,
}: {
  identity: Identity;
  onClose: () => void;
  onAssign: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [unassignedAccounts, setUnassignedAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUnassignedAccounts();
  }, []);

  async function fetchUnassignedAccounts() {
    setLoading(true);
    try {
      // Fetch accounts that don't have an identity profile linked
      const res = await fetch("/api/accounts?unassigned=true");
      if (res.ok) {
        const data = await res.json();
        setUnassignedAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error("Failed to fetch unassigned accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!selectedAccountId) return;

    setAssigning(true);
    setError("");
    try {
      const res = await fetch(`/api/accounts/${selectedAccountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityProfileId: identity.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign account");
      }

      onAssign();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign account");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Assign Existing Account</h3>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white transition rounded hover:bg-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Link an unassigned ad account to {identity.fullName}
          </p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : unassignedAccounts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-slate-500 text-4xl mb-3">📭</div>
              <p className="text-slate-400">No unassigned accounts available</p>
              <p className="text-slate-500 text-sm mt-1">
                All accounts are already linked to identity profiles
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-400 mb-3">
                Select an account to assign ({unassignedAccounts.length} available):
              </p>
              {unassignedAccounts.map((account) => (
                <label
                  key={account.id}
                  className={`block p-4 rounded-lg border cursor-pointer transition ${
                    selectedAccountId === account.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="account"
                    value={account.id}
                    checked={selectedAccountId === account.id}
                    onChange={() => setSelectedAccountId(account.id)}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      selectedAccountId === account.id ? "border-emerald-500" : "border-slate-500"
                    }`}>
                      {selectedAccountId === account.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {formatCid(account.googleCid) || "No CID"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          account.origin === "takeover"
                            ? "bg-purple-500/20 text-purple-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}>
                          {account.origin === "takeover" ? "Takeover" : "MCC"}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1 flex items-center gap-3">
                        <span>Health: {account.accountHealth}</span>
                        <span>•</span>
                        <span>Billing: {account.billingStatus}</span>
                      </div>
                      {account.notes && (
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {account.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedAccountId || assigning}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
          >
            {assigning ? "Assigning..." : "Assign Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// IDENTITY DETAIL VIEW
// ============================================================================

function IdentityDetailView({
  identity,
  onBack,
  onDelete,
  onEdit,
  onRefresh,
  onViewAccount,
}: {
  identity: Identity;
  onBack: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  onViewAccount?: (accountId: string) => void;
}) {
  const { showConfirm, showSuccess, showError, showAlert } = useModal();
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [creatingGoLogin, setCreatingGoLogin] = useState(false);
  const [deletingGoLogin, setDeletingGoLogin] = useState(false);
  const [updatingProxy, setUpdatingProxy] = useState(false);
  const [refreshingFingerprint, setRefreshingFingerprint] = useState(false);
  const [launchingBrowser, setLaunchingBrowser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAssignAccountModal, setShowAssignAccountModal] = useState(false);
  const [unlinkingAccount, setUnlinkingAccount] = useState(false);
  // Phone verification state
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    status: string;
    phone?: string;
    phoneFormatted?: string;
    code?: string;
    expiresAt?: string;
    error?: string;
  } | null>(null);

  // Check if identity already has an ad account
  const hasExistingAccount = identity.adAccounts && identity.adAccounts.length > 0;

  // Phone verification functions
  async function handleStartVerification() {
    setVerificationLoading(true);
    setVerificationStatus(null);
    try {
      const res = await fetch(`/api/identities/${identity.id}/phone-verification`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationStatus({
          status: "pending",
          phone: data.phone,
          phoneFormatted: data.phoneFormatted,
          expiresAt: data.expiresAt,
        });
        await showSuccess("Verification Started", `Phone number obtained: ${data.phoneFormatted}. Use this number for Google verification.`);
      } else {
        setVerificationStatus({ status: "error", error: data.error });
        await showError("Verification Failed", data.error || "Failed to start verification");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setVerificationStatus({ status: "error", error: "Network error" });
      await showError("Network Error", "Failed to connect to verification service");
    } finally {
      setVerificationLoading(false);
    }
  }

  async function handleCheckVerification() {
    setVerificationLoading(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}/phone-verification`);
      const data = await res.json();
      if (res.ok) {
        setVerificationStatus({
          status: data.status,
          phone: data.phone,
          phoneFormatted: data.phoneFormatted,
          code: data.code,
          expiresAt: data.expiresAt,
        });
        if (data.code) {
          await showSuccess("Code Received!", `Verification code: ${data.code}`);
        }
      } else {
        if (data.status === "expired") {
          setVerificationStatus({ status: "expired", error: "Verification expired" });
        } else if (data.status === "none") {
          setVerificationStatus(null);
        }
      }
    } catch (error) {
      console.error("Check verification error:", error);
    } finally {
      setVerificationLoading(false);
    }
  }

  async function handleCancelVerification() {
    setVerificationLoading(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}/phone-verification`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVerificationStatus(null);
        await showSuccess("Verification Cancelled", "Phone verification has been cancelled.");
      }
    } catch (error) {
      console.error("Cancel verification error:", error);
    } finally {
      setVerificationLoading(false);
    }
  }

  // Initialize verification status from identity data
  useEffect(() => {
    if (identity.verificationPhone && identity.verificationStatus) {
      setVerificationStatus({
        status: identity.verificationStatus,
        phone: identity.verificationPhone,
        phoneFormatted: identity.verificationPhone,
        code: identity.verificationCode || undefined,
        expiresAt: identity.verificationExpiresAt?.toString(),
      });
    }
  }, [identity.verificationPhone, identity.verificationStatus, identity.verificationCode, identity.verificationExpiresAt]);

  async function handleDelete() {
    const confirmed = await showConfirm(
      "Delete Identity",
      `Are you sure you want to delete ${identity.fullName}?`,
      { confirmText: "Delete", cancelText: "Cancel" }
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onDelete();
      } else {
        const data = await res.json();
        await showError("Delete Failed", data.error || "Failed to delete identity");
      }
    } catch (error) {
      console.error("Delete error:", error);
      await showError("Network Error", "Network error occurred");
    } finally {
      setDeleting(false);
    }
  }

  async function handleArchive() {
    const action = identity.archived ? "unarchive" : "archive";
    const confirmed = await showConfirm(
      identity.archived ? "Unarchive Identity" : "Archive Identity",
      identity.archived
        ? `Unarchive ${identity.fullName}? This will make it visible in the main list again.`
        : `Archive ${identity.fullName}? Archived identities are hidden from the main list but can be viewed later.`,
      { confirmText: identity.archived ? "Unarchive" : "Archive", cancelText: "Cancel" }
    );
    if (!confirmed) return;

    setArchiving(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !identity.archived }),
      });

      if (res.ok) {
        await showSuccess(
          identity.archived ? "Identity Unarchived" : "Identity Archived",
          identity.archived
            ? `${identity.fullName} has been restored to the main list.`
            : `${identity.fullName} has been archived.`
        );
        onRefresh();
      } else {
        const data = await res.json();
        await showError("Action Failed", data.error || `Failed to ${action} identity`);
      }
    } catch (error) {
      console.error(`${action} error:`, error);
      await showError("Network Error", "Network error occurred");
    } finally {
      setArchiving(false);
    }
  }

  async function handleCreateGoLoginProfile() {
    const confirmed = await showConfirm(
      "Create GoLogin Profile",
      `Create a GoLogin browser profile for ${identity.fullName}?`,
      { confirmText: "Create", cancelText: "Cancel" }
    );
    if (!confirmed) {
      return;
    }

    setCreatingGoLogin(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}/gologin`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        await showSuccess(
          "GoLogin Profile Created",
          `Profile ID: ${data.gologinProfile?.profileId || 'Pending'}`
        );
        onRefresh(); // Refresh to show new profile
      } else {
        // Show detailed error message
        const errorMsg = data.details || data.error || "Unknown error";
        await showError("Create Failed", errorMsg);
        // Still refresh to show any error state saved to DB
        onRefresh();
      }
    } catch (error) {
      console.error("Create GoLogin profile error:", error);
      await showError("Network Error", "Network error occurred");
    } finally {
      setCreatingGoLogin(false);
    }
  }

  async function handleDeleteGoLoginProfile() {
    const confirmed = await showConfirm(
      "Delete GoLogin Profile",
      `Delete the GoLogin browser profile for ${identity.fullName}? This will also delete it from GoLogin.`,
      { confirmText: "Delete", cancelText: "Cancel" }
    );
    if (!confirmed) {
      return;
    }

    setDeletingGoLogin(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}/gologin`, {
        method: "DELETE",
      });

      if (res.ok) {
        await showSuccess("Deleted", "GoLogin profile deleted successfully");
        onRefresh();
      } else {
        const data = await res.json();
        await showError("Delete Failed", "Failed to delete GoLogin profile: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Delete GoLogin profile error:", error);
      await showError("Network Error", "Network error occurred");
    } finally {
      setDeletingGoLogin(false);
    }
  }

  async function handleSetProxy() {
    if (!identity.gologinProfile?.profileId) {
      await showError("Error", "GoLogin profile must be created first");
      return;
    }

    const confirmed = await showConfirm(
      "Configure Proxy",
      `Set up GoLogin's built-in proxy for ${identity.fullName}?\n\nThis will use a residential proxy matching the identity's geo location (${identity.geo}).`,
      { confirmText: "Enable Proxy", cancelText: "Cancel" }
    );
    if (!confirmed) return;

    setUpdatingProxy(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}/gologin/proxy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "gologin",
          country: identity.geo,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await showSuccess("Proxy Configured", `GoLogin proxy enabled for ${identity.geo.toUpperCase()}`);
        onRefresh();
      } else {
        await showError("Proxy Failed", data.error || "Failed to configure proxy");
      }
    } catch (error) {
      console.error("Proxy error:", error);
      await showError("Network Error", "Failed to connect to server");
    } finally {
      setUpdatingProxy(false);
    }
  }

  async function handleRefreshFingerprint() {
    if (!identity.gologinProfile?.profileId) {
      await showError("Error", "GoLogin profile must be created first");
      return;
    }

    const confirmed = await showConfirm(
      "Refresh Fingerprint",
      "Regenerate the browser fingerprint for this profile?\n\nThis will create new canvas, WebGL, and audio fingerprints while keeping the same profile.",
      { confirmText: "Refresh", cancelText: "Cancel" }
    );
    if (!confirmed) return;

    setRefreshingFingerprint(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}/gologin/fingerprint`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        await showSuccess("Fingerprint Refreshed", "Browser fingerprint has been regenerated");
        onRefresh();
      } else {
        await showError("Refresh Failed", data.error || "Failed to refresh fingerprint");
      }
    } catch (error) {
      console.error("Fingerprint error:", error);
      await showError("Network Error", "Failed to connect to server");
    } finally {
      setRefreshingFingerprint(false);
    }
  }

  async function handleLaunchBrowser() {
    if (!identity.gologinProfile?.profileId) {
      await showError("Error", "GoLogin profile must be created first");
      return;
    }

    setLaunchingBrowser(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}/gologin/launch`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        // Open GoLogin web app in new tab
        window.open(data.webAppUrl, "_blank");
        await showAlert(
          "Browser Launch",
          `Opening GoLogin in a new tab.\n\nProfile ID: ${data.profileId}\n\nYou can also use the cloud browser URL for automation:\n${data.cloudBrowserUrl.substring(0, 60)}...`
        );
      } else {
        await showError("Launch Failed", data.error || "Failed to launch browser");
      }
    } catch (error) {
      console.error("Launch error:", error);
      await showError("Network Error", "Failed to connect to server");
    } finally {
      setLaunchingBrowser(false);
    }
  }

  async function handleUnlinkAdAccount() {
    if (!identity.adAccounts || identity.adAccounts.length === 0) return;

    const confirmed = await showConfirm(
      "Unlink Ad Account",
      `Are you sure you want to unlink the ad account from ${identity.fullName}?\n\nThe ad account will remain in the system but won't be associated with this identity.`,
      { confirmText: "Unlink", cancelText: "Cancel" }
    );
    if (!confirmed) return;

    setUnlinkingAccount(true);
    try {
      // Unlink all ad accounts associated with this identity
      const results = await Promise.all(
        identity.adAccounts.map(async (acc) => {
          const res = await fetch(`/api/accounts/${acc.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identityProfileId: null }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.error(`Failed to unlink account ${acc.id}:`, data);
          }
          return res;
        })
      );

      const allSucceeded = results.every((r) => r.ok);
      if (allSucceeded) {
        await showSuccess("Account Unlinked", "Ad account has been unlinked from this identity");
        onRefresh();
      } else {
        const failedCount = results.filter((r) => !r.ok).length;
        await showError("Unlink Failed", `Failed to unlink ${failedCount} ad account(s). Check console for details.`);
      }
    } catch (error) {
      console.error("Unlink error:", error);
      await showError("Network Error", "Failed to connect to server");
    } finally {
      setUnlinkingAccount(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1">
          Identity detail view. Review KYC information, attached documents, and linked accounts.
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>ID: {identity.id}</span>
            {identity.archived && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                Archived
              </span>
            )}
          </div>
          <div>
            Created: {new Date(identity.createdAt).toLocaleDateString()}
            {identity.updatedAt && ` · Updated: ${new Date(identity.updatedAt).toLocaleDateString()}`}
          </div>
        </div>

        <button
          onClick={onBack}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800 transition"
        >
          ← Back to ID Profiles
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
        {/* Left: core details */}
        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-1">
            Identity Information
          </h2>

          {/* Compact grid layout */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <div className="text-xs text-slate-500">Full Name</div>
              <div className="text-slate-100">{identity.fullName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">DOB</div>
              <div className="text-slate-100">{formatDateForDisplay(new Date(identity.dob))}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500">Address</div>
              <div className="text-slate-100">{identity.address}, {identity.city}, {identity.state} {identity.zipcode}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Country</div>
              <div className="text-slate-100">{identity.geo}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Website</div>
              {identity.website ? (
                <a href={identity.website} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 truncate block">
                  {identity.website}
                </a>
              ) : (
                <div className="text-slate-500">—</div>
              )}
            </div>
          </div>
          {identity.notes && (
            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-500">Notes</div>
              <div className="text-slate-100 whitespace-pre-line text-sm">{identity.notes}</div>
            </div>
          )}

          {/* Ad Account Credentials Section */}
          {(identity.email || identity.emailPassword || identity.phone || identity.backupCodes) && (
            <>
              <div className="border-t border-slate-700 my-4"></div>
              <h2 className="text-sm font-semibold text-slate-100 mb-3">
                Ad Account Credentials
              </h2>
              <div className="space-y-3 text-sm">
                {identity.email && (
                  <div>
                    <div className="text-xs text-slate-400">Ad Account Email</div>
                    <div className="text-slate-100 flex items-center gap-2">
                      <span>{identity.email}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(identity.email || "");
                        }}
                        className="text-xs text-slate-500 hover:text-emerald-400 transition"
                        title="Copy email"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}
                {identity.emailPassword && (
                  <div>
                    <div className="text-xs text-slate-400">Email Password</div>
                    <div className="text-slate-100 flex items-center gap-2">
                      <span className="font-mono">
                        {showPassword ? identity.emailPassword : "••••••••••••"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-200 transition"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "👁️" : "👁️‍🗨️"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(identity.emailPassword || "");
                        }}
                        className="text-xs text-slate-500 hover:text-emerald-400 transition"
                        title="Copy password"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}
                {identity.phone && (
                  <div>
                    <div className="text-xs text-slate-400">Phone Number</div>
                    <div className="text-slate-100 flex items-center gap-2">
                      <span>{identity.phone}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(identity.phone || "");
                        }}
                        className="text-xs text-slate-500 hover:text-emerald-400 transition"
                        title="Copy phone"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Phone Verification Section - Coming Soon */}
          <div className="border-t border-slate-700 my-4"></div>
          <div className="opacity-50 pointer-events-none">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Phone Verification (TextVerified)
              </h2>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded uppercase tracking-wide">
                Coming Soon
              </span>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-3">
                Get a non-VoIP phone number for Google Ads verification. Numbers work for ~15 minutes.
              </p>
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-500 text-sm font-medium cursor-not-allowed"
              >
                Get Verification Number
              </button>
            </div>
          </div>

          {/* Billing Information Section */}
          {(identity.ccNumber || identity.ccName || identity.ccExp) && (
            <>
              <div className="border-t border-slate-700 my-4"></div>
              <h2 className="text-sm font-semibold text-slate-100 mb-3">
                Billing Information
              </h2>
              <div className="space-y-3 text-sm">
                {identity.ccName && (
                  <div>
                    <div className="text-xs text-slate-400">Name on Card</div>
                    <div className="text-slate-100">{identity.ccName}</div>
                  </div>
                )}
                {identity.ccNumber && (
                  <div>
                    <div className="text-xs text-slate-400">Card Number</div>
                    <div className="text-slate-100 flex items-center gap-2">
                      <span className="font-mono">
                        {showPassword ? identity.ccNumber : `•••• •••• •••• ${identity.ccNumber.slice(-4)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(identity.ccNumber || "");
                        }}
                        className="text-xs text-slate-500 hover:text-emerald-400 transition"
                        title="Copy card number"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {identity.ccExp && (
                    <div>
                      <div className="text-xs text-slate-400">Expiration</div>
                      <div className="text-slate-100 font-mono">{identity.ccExp}</div>
                    </div>
                  )}
                  {identity.ccCvv && (
                    <div>
                      <div className="text-xs text-slate-400">CVV</div>
                      <div className="text-slate-100 flex items-center gap-2">
                        <span className="font-mono">
                          {showPassword ? identity.ccCvv : "•••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(identity.ccCvv || "");
                          }}
                          className="text-xs text-slate-500 hover:text-emerald-400 transition"
                          title="Copy CVV"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}
                  {identity.billingZip && (
                    <div>
                      <div className="text-xs text-slate-400">Billing Zip</div>
                      <div className="text-slate-100">{identity.billingZip}</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right: documents */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Attached Documents
            </h2>
          </div>

          {identity.documents.length === 0 ? (
            <p className="text-xs text-slate-400">
              No documents uploaded for this identity yet.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {identity.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <div>
                    <div className="text-slate-100">{doc.filePath.split("/").pop()}</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <a
                    href={doc.filePath}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* GoLogin Profile Status */}
      {identity.gologinProfile && (
        <div className="mt-6 rounded-xl border border-purple-800/50 bg-purple-950/20 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              GoLogin Profile
            </h3>
            <div className="flex items-center gap-2">
              {identity.gologinProfile.status === "ready" && identity.gologinProfile.profileId && (
                <>
                  <button
                    type="button"
                    onClick={handleLaunchBrowser}
                    disabled={launchingBrowser}
                    className="px-2.5 py-1 text-[10px] font-medium rounded bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
                  >
                    {launchingBrowser ? "..." : "Open in GoLogin"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshFingerprint}
                    disabled={refreshingFingerprint}
                    className="px-2.5 py-1 text-[10px] font-medium rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition disabled:opacity-50"
                    title="Refresh fingerprint"
                  >
                    {refreshingFingerprint ? "..." : "Refresh FP"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleDeleteGoLoginProfile}
                disabled={deletingGoLogin}
                className="px-2.5 py-1 text-[10px] font-medium rounded bg-rose-900/50 text-rose-300 hover:bg-rose-800/50 transition disabled:opacity-50"
              >
                {deletingGoLogin ? "..." : "Delete"}
              </button>
            </div>
          </div>

          {/* Profile Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950/40 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Profile ID</div>
              <div className="text-xs font-mono text-purple-300 truncate">{identity.gologinProfile.profileId || 'Pending...'}</div>
            </div>
            <div className="bg-slate-950/40 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Status</div>
              <div className={`text-xs font-medium ${
                identity.gologinProfile.status === "ready" ? "text-emerald-400" :
                identity.gologinProfile.status === "error" ? "text-red-400" :
                "text-amber-400"
              }`}>
                {identity.gologinProfile.status === "ready" ? "✓ Ready" :
                 identity.gologinProfile.status === "error" ? "✗ Error" :
                 "⏳ " + identity.gologinProfile.status}
              </div>
              {identity.gologinProfile.status === "error" && identity.gologinProfile.errorMessage && (
                <div className="text-[10px] text-red-400/70 mt-1 truncate" title={identity.gologinProfile.errorMessage}>
                  {identity.gologinProfile.errorMessage}
                </div>
              )}
            </div>
            <div className="bg-slate-950/40 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Proxy</div>
              <div className="text-xs text-slate-300">
                {identity.gologinProfile.proxyMode === "gologin" ? (
                  <span className="text-purple-300">GoLogin ({identity.gologinProfile.proxyCountry?.toUpperCase() || 'Auto'})</span>
                ) : identity.gologinProfile.proxyMode === "none" ? (
                  <span className="text-slate-500">None</span>
                ) : (
                  <span>{identity.gologinProfile.proxyMode?.toUpperCase()} - {identity.gologinProfile.proxyHost}</span>
                )}
              </div>
            </div>
            <div className="bg-slate-950/40 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Last Used</div>
              <div className="text-xs text-slate-300">
                {identity.gologinProfile.lastUsedAt ? (
                  new Date(identity.gologinProfile.lastUsedAt).toLocaleDateString()
                ) : (
                  <span className="text-slate-500">Never</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccountModal && (
        <AddAccountModal
          preselectedIdentity={identity}
          onClose={() => setShowAddAccountModal(false)}
          onSubmit={() => {
            setShowAddAccountModal(false);
            onRefresh();
          }}
        />
      )}

      {/* Assign Existing Account Modal */}
      {showAssignAccountModal && (
        <AssignExistingAccountModal
          identity={identity}
          onClose={() => setShowAssignAccountModal(false)}
          onAssign={() => {
            setShowAssignAccountModal(false);
            onRefresh();
          }}
        />
      )}

      {/* Action buttons */}
      <div className="mt-8 flex items-center gap-3 flex-wrap">
        {hasExistingAccount ? (
          <>
            {identity.adAccounts?.map((account) => (
              <button
                key={account.id}
                onClick={() => onViewAccount?.(account.id)}
                className="rounded-lg bg-emerald-900/40 border border-emerald-700 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-800/60 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Account #{account.internalId} {account.googleCid && `(${formatCid(account.googleCid)})`}
              </button>
            ))}
            <button
              type="button"
              onClick={handleUnlinkAdAccount}
              disabled={unlinkingAccount}
              className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-2 text-xs font-medium text-amber-300 hover:bg-amber-900/60 transition disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68a4.503 4.503 0 011.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 006.364 6.364l3.536-3.536m-6.364 0L5.636 15.41a2.25 2.25 0 003.182 3.182l1.768-1.768M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {unlinkingAccount ? "Unlinking..." : "Unlink Ad Account"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowAddAccountModal(true)}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
            >
              Create Ad Account
            </button>
            <button
              type="button"
              onClick={() => setShowAssignAccountModal(true)}
              className="rounded-lg border border-blue-600 bg-blue-950/40 px-4 py-2 text-xs font-medium text-blue-300 hover:bg-blue-900/60 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 00-6.364 6.364l4.5 4.5a4.5 4.5 0 007.244 1.242" />
              </svg>
              Assign Existing Account
            </button>
          </>
        )}

        {!identity.gologinProfile && (
          <button
            type="button"
            onClick={handleCreateGoLoginProfile}
            disabled={creatingGoLogin}
            className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            {creatingGoLogin ? "Creating..." : "Create GoLogin Profile"}
          </button>
        )}

        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 transition"
        >
          Edit Identity
        </button>

        <button
          type="button"
          onClick={handleArchive}
          disabled={archiving}
          className={`rounded-lg border px-4 py-2 text-xs font-medium transition disabled:opacity-50 ${
            identity.archived
              ? "border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
              : "border-amber-700 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60"
          }`}
        >
          {archiving
            ? "..."
            : identity.archived
            ? "Unarchive"
            : "Archive"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg border border-rose-700 bg-rose-950/40 px-4 py-2 text-xs font-medium text-rose-300 hover:bg-rose-900/60 transition disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete Identity"}
        </button>
      </div>
    </>
  );
}

// ============================================================================
// PLACEHOLDER VIEW
// ============================================================================

// ============================================================================
// THREAD CONVERSATION MODAL
// ============================================================================

function ThreadConversationModal({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState<AccountThread | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchThread();
  }, [accountId]);

  async function fetchThread() {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/thread`);
      if (res.ok) {
        const data = await res.json();
        setThread(data.thread);
      }
    } catch (error) {
      console.error("Failed to fetch thread:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/thread/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      });

      if (res.ok) {
        setNewMessage("");
        fetchThread(); // Refresh thread
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-500/20 text-purple-300";
      case "ADMIN":
        return "bg-blue-500/20 text-blue-300";
      case "MANAGER":
        return "bg-indigo-500/20 text-indigo-300";
      case "MEDIA_BUYER":
        return "bg-emerald-500/20 text-emerald-300";
      case "ASSISTANT":
        return "bg-amber-500/20 text-amber-300";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-100">
            Account Notes
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center text-slate-400">Loading conversation...</div>
          ) : thread && thread.messages.length > 0 ? (
            thread.messages.map((msg) => (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-300">
                    {msg.authorName}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${getRoleBadgeColor(msg.authorRole)}`}>
                    {msg.authorRole.replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-200">
                  {msg.message}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-400">
              No messages yet. Start the conversation!
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-800">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="px-6 py-2 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 disabled:opacity-50 transition-all"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// TEAM MANAGEMENT VIEW
// ============================================================================

function TeamView() {
  const { showConfirm } = useModal();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch team:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    const confirmed = await showConfirm(
      "Delete User",
      "Are you sure you want to permanently delete this user? This action cannot be undone.",
      { confirmText: "Delete", cancelText: "Cancel" }
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/team/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  }

  async function handleUpdateRole(userId: string, newRole: UserRole) {
    try {
      const res = await fetch(`/api/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  }

  async function handleUpdateStatus(userId: string, newStatus: "ACTIVE" | "INACTIVE") {
    try {
      const res = await fetch(`/api/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "ADMIN":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "MANAGER":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
      case "MEDIA_BUYER":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "ASSISTANT":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <SkeletonTeamTable />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">
          Manage team members and their roles
        </p>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition"
        >
          + Add Team Member
        </button>
      </div>

      {/* Team Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 border-b border-slate-800">
            <tr>
              <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Name</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Email</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Role</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Accounts</th>
              <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Last Login</th>
              <th className="text-right p-4 text-xs font-semibold text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/30">
                <td className="p-4 text-sm text-slate-200">{user.name}</td>
                <td className="p-4 text-sm text-slate-300">{user.email}</td>
                <td className="p-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                    disabled={user.role === "SUPER_ADMIN"}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(
                      user.role
                    )} ${user.role === "SUPER_ADMIN" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="MEDIA_BUYER">Media Buyer</option>
                    <option value="ASSISTANT">Assistant</option>
                    {user.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
                  </select>
                </td>
                <td className="p-4">
                  <button
                    onClick={() =>
                      handleUpdateStatus(
                        user.id,
                        user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                      )
                    }
                    disabled={user.role === "SUPER_ADMIN"}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.status === "ACTIVE"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-500/20 text-slate-400"
                    } ${user.role === "SUPER_ADMIN" ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
                  >
                    {user.status}
                  </button>
                </td>
                <td className="p-4 text-sm text-slate-300">
                  {user.role === "MEDIA_BUYER" ? (
                    <span className="text-blue-400">
                      {user.mediaBuyer?.adAccounts?.length || 0} accounts
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-400">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="p-4 text-right space-x-3">
                  <button
                    onClick={() => setEditingUser(user)}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Edit
                  </button>
                  {user.role !== "SUPER_ADMIN" && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Team Member Modal */}
      {showAddModal && (
        <AddTeamMemberModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchUsers();
          }}
        />
      )}

      {/* Edit Team Member Modal */}
      {editingUser && (
        <EditTeamMemberModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function AddTeamMemberModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "MEDIA_BUYER" as UserRole,
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to create team member");
      }
    } catch (err) {
      setError("Failed to create team member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-50">Add Team Member</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition rounded hover:bg-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="MEDIA_BUYER">Media Buyer</option>
              <option value="ASSISTANT">Assistant</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Temporary Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              User will be prompted to change password on first login
            </p>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTeamMemberModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showSuccess, showError } = useModal();
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
  });
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState("");

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/team/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        showSuccess("Success", "User updated successfully");
        onSuccess();
      } else {
        setError(data.error || "Failed to update user");
      }
    } catch (err) {
      setError("Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setError("");
    setResettingPassword(true);

    try {
      const res = await fetch(`/api/team/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        showSuccess("Success", "Password reset successfully. User will be prompted to change it on next login.");
        setNewPassword("");
      } else {
        showError("Error", data.error || "Failed to reset password");
      }
    } catch (err) {
      showError("Error", "Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-50">Edit Team Member</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition rounded hover:bg-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Info Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={isSuperAdmin}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isSuperAdmin}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
            <div className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              user.role === "SUPER_ADMIN"
                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                : user.role === "ADMIN"
                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                : user.role === "MANAGER"
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                : user.role === "MEDIA_BUYER"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
            }`}>
              {user.role.replace("_", " ")}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Role can be changed from the team list
            </p>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          {!isSuperAdmin && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </form>

        {/* Password Reset Section */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Reset Password</h3>
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={8}
                className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Minimum 8 characters. User will be prompted to change password on next login.
            </p>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={resettingPassword || !newPassword}
              className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {resettingPassword ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </div>

        {/* Close button for super admin */}
        {isSuperAdmin && (
          <div className="mt-6 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SYSTEM VIEW (SUPER ADMIN ONLY)
// ============================================================================

interface SystemData {
  oauthConnections: Array<{
    id: string;
    googleEmail: string;
    status: string;
    linkedAccounts: number;
    lastSyncAt: string | null;
    lastSyncError: string | null;
    createdAt: string;
    tokenExpiresAt: string;
  }>;
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  accounts: {
    total: number;
    totalSpend: number;
    todaySpend: number;
  };
  identities: {
    total: number;
  };
  goLogin: {
    total: number;
    byStatus: Record<string, number>;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    details: string;
    accountName: string;
    createdBy: string;
    createdAt: string;
  }>;
  systemHealth: {
    oauthHealthy: boolean;
    hasExpiredTokens: boolean;
    goLoginConfigured: boolean;
    telegramConfigured: boolean;
  };
  settings: {
    goLoginConfigured: boolean;
    telegramConfigured: boolean;
    googleAdsConfigured: boolean;
  };
}

function SystemView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Collapsible section states
  const [showOAuthSection, setShowOAuthSection] = useState(true);
  const [showActivitySection, setShowActivitySection] = useState(true);
  const [activityLimit, setActivityLimit] = useState(5); // Show 5 initially, can load more
  const [dismissedHealthBanner, setDismissedHealthBanner] = useState(false);

  useEffect(() => {
    fetchSystemData();
  }, []);

  async function fetchSystemData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch system data");
      }
      const result = await res.json();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-800 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 text-rose-400">
          <p className="font-semibold">Error loading system data</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchSystemData}
            className="mt-3 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  const isTokenExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="p-6 space-y-6">
      {/* System Health Banner - Dismissible */}
      {!dismissedHealthBanner && (
        <div className={`rounded-lg p-4 ${
          data.systemHealth.oauthHealthy && !data.systemHealth.hasExpiredTokens
            ? "bg-emerald-500/10 border border-emerald-500/30"
            : "bg-amber-500/10 border border-amber-500/30"
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {data.systemHealth.oauthHealthy && !data.systemHealth.hasExpiredTokens ? "✅" : "⚠️"}
              </span>
              <div>
                <p className={`font-semibold ${
                  data.systemHealth.oauthHealthy && !data.systemHealth.hasExpiredTokens
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}>
                  {data.systemHealth.oauthHealthy && !data.systemHealth.hasExpiredTokens
                    ? "All Systems Operational"
                    : "Attention Required"}
                </p>
                <p className="text-sm text-slate-400">
                  {data.systemHealth.hasExpiredTokens && "Some OAuth tokens have expired. "}
                  {!data.systemHealth.goLoginConfigured && "GoLogin not configured. "}
                  {!data.systemHealth.telegramConfigured && "Telegram bot not configured. "}
                  {data.systemHealth.oauthHealthy && !data.systemHealth.hasExpiredTokens &&
                    data.systemHealth.goLoginConfigured && data.systemHealth.telegramConfigured &&
                    "All integrations connected and healthy."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissedHealthBanner(true)}
              className={`p-1 rounded hover:bg-slate-800/50 transition ${
                data.systemHealth.oauthHealthy && !data.systemHealth.hasExpiredTokens
                  ? "text-emerald-400/60 hover:text-emerald-400"
                  : "text-amber-400/60 hover:text-amber-400"
              }`}
              title="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">OAuth Connections</p>
          <p className="text-2xl font-bold text-white">{data.oauthConnections.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            {data.oauthConnections.filter(c => c.status === "active").length} active
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total Users</p>
          <p className="text-2xl font-bold text-white">{data.users.total}</p>
          <p className="text-xs text-slate-500 mt-1">
            {data.users.byRole.SUPER_ADMIN || 0} admin, {data.users.byRole.MEDIA_BUYER || 0} buyers
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Ad Accounts</p>
          <p className="text-2xl font-bold text-white">{data.accounts.total}</p>
          <p className="text-xs text-slate-500 mt-1">
            ${(data.accounts.totalSpend / 100).toFixed(2)} total spend
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">GoLogin Profiles</p>
          <p className="text-2xl font-bold text-white">{data.goLogin.total}</p>
          <p className="text-xs text-slate-500 mt-1">
            {data.goLogin.byStatus.ready || 0} ready, {data.goLogin.byStatus.error || 0} errors
          </p>
        </div>
      </div>

      {/* Integration Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Integration Status</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <span className={`w-3 h-3 rounded-full ${data.settings.googleAdsConfigured ? "bg-emerald-500" : "bg-slate-600"}`}></span>
            <div>
              <p className="text-sm font-medium text-white">Google Ads API</p>
              <p className="text-xs text-slate-400">{data.settings.googleAdsConfigured ? "Configured" : "Not configured"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <span className={`w-3 h-3 rounded-full ${data.settings.goLoginConfigured ? "bg-emerald-500" : "bg-slate-600"}`}></span>
            <div>
              <p className="text-sm font-medium text-white">GoLogin</p>
              <p className="text-xs text-slate-400">{data.settings.goLoginConfigured ? "Configured" : "Not configured"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <span className={`w-3 h-3 rounded-full ${data.settings.telegramConfigured ? "bg-emerald-500" : "bg-slate-600"}`}></span>
            <div>
              <p className="text-sm font-medium text-white">Telegram Bot</p>
              <p className="text-xs text-slate-400">{data.settings.telegramConfigured ? "Configured" : "Not configured"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* OAuth Connections Table - Collapsible */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowOAuthSection(!showOAuthSection)}
          className="w-full p-4 border-b border-slate-800 flex items-center justify-between hover:bg-slate-800/30 transition"
        >
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              OAuth Connections
              <span className="text-sm font-normal text-slate-400">({data.oauthConnections.length})</span>
            </h3>
            <p className="text-sm text-slate-400">Google Ads accounts connected via OAuth</p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-5 h-5 text-slate-400 transition-transform ${showOAuthSection ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {showOAuthSection && (
          <>
            {data.oauthConnections.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p>No OAuth connections yet</p>
                <p className="text-sm mt-1">Connect a Google Ads account from Account Profiles</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">Email</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">Linked Accounts</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">Token Expires</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">Last Sync</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.oauthConnections.map((conn) => (
                      <tr key={conn.id} className="hover:bg-slate-800/30">
                        <td className="p-3">
                          <p className="text-sm text-white">{conn.googleEmail}</p>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                            conn.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : conn.status === "expired"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              conn.status === "active" ? "bg-emerald-400" : conn.status === "expired" ? "bg-amber-400" : "bg-rose-400"
                            }`}></span>
                            {conn.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-white">{conn.linkedAccounts}</span>
                        </td>
                        <td className="p-3">
                          <span className={`text-sm ${isTokenExpired(conn.tokenExpiresAt) ? "text-rose-400" : "text-slate-300"}`}>
                            {formatDate(conn.tokenExpiresAt)}
                            {isTokenExpired(conn.tokenExpiresAt) && " (Expired)"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-slate-300">{formatDate(conn.lastSyncAt)}</span>
                          {conn.lastSyncError && (
                            <p className="text-xs text-rose-400 mt-0.5 truncate max-w-[200px]" title={conn.lastSyncError}>
                              {conn.lastSyncError}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-slate-400">{formatDate(conn.createdAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Users by Role */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Users by Role</h3>
        <div className="grid grid-cols-5 gap-3">
          {["SUPER_ADMIN", "ADMIN", "MANAGER", "MEDIA_BUYER", "ASSISTANT"].map((role) => (
            <div key={role} className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{data.users.byRole[role] || 0}</p>
              <p className="text-xs text-slate-400 mt-1">{role.replace("_", " ")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity - Collapsible with Load More */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowActivitySection(!showActivitySection)}
          className="w-full p-4 border-b border-slate-800 flex items-center justify-between hover:bg-slate-800/30 transition"
        >
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              Recent Activity
              <span className="text-sm font-normal text-slate-400">({data.recentActivity.length} in last 24h)</span>
            </h3>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-5 h-5 text-slate-400 transition-transform ${showActivitySection ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {showActivitySection && (
          <>
            {data.recentActivity.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p>No activity in the last 24 hours</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-800">
                  {data.recentActivity.slice(0, activityLimit).map((activity) => (
                    <div key={activity.id} className="p-3 hover:bg-slate-800/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            activity.action.includes("ERROR") || activity.action.includes("FAILED")
                              ? "bg-rose-500/10 text-rose-400"
                              : activity.action.includes("CREATED") || activity.action.includes("SUCCESS")
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-700 text-slate-300"
                          }`}>
                            {activity.action}
                          </span>
                          <span className="text-sm text-white">{activity.accountName}</span>
                        </div>
                        <span className="text-xs text-slate-500">{formatDate(activity.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1 ml-[52px]">{activity.details}</p>
                      {activity.createdBy && (
                        <p className="text-xs text-slate-500 mt-0.5 ml-[52px]">by {activity.createdBy}</p>
                      )}
                    </div>
                  ))}
                </div>
                {/* Show More / Show Less buttons */}
                {data.recentActivity.length > 5 && (
                  <div className="p-3 border-t border-slate-800 flex justify-center gap-3">
                    {activityLimit < data.recentActivity.length && (
                      <button
                        onClick={() => setActivityLimit(Math.min(activityLimit + 10, data.recentActivity.length))}
                        className="text-sm text-emerald-400 hover:text-emerald-300 transition"
                      >
                        Show more ({data.recentActivity.length - activityLimit} remaining)
                      </button>
                    )}
                    {activityLimit > 5 && (
                      <button
                        onClick={() => setActivityLimit(5)}
                        className="text-sm text-slate-400 hover:text-slate-300 transition"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS VIEW
// ============================================================================

function SettingsView() {
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [gologinApiKey, setGologinApiKey] = useState<string>("");
  const [googleAdsApiKey, setGoogleAdsApiKey] = useState<string>("");
  const [googleApiKey, setGoogleApiKey] = useState<string>("");
  const [textverifiedApiKey, setTextverifiedApiKey] = useState<string>("");
  const [telegramBotToken, setTelegramBotToken] = useState<string>("");
  const [telegramChatId, setTelegramChatId] = useState<string>("");
  // Visibility toggles for API keys
  const [showGologinKey, setShowGologinKey] = useState(false);
  const [showGoogleAdsKey, setShowGoogleAdsKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showTextverifiedKey, setShowTextverifiedKey] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setGologinApiKey(data.gologinApiKey || "");
        setGoogleAdsApiKey(data.googleAdsApiKey || "");
        setGoogleApiKey(data.googleApiKey || "");
        setTextverifiedApiKey(data.textverifiedApiKey || "");
        setTelegramBotToken(data.telegramBotToken || "");
        setTelegramChatId(data.telegramChatId || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gologinApiKey,
          googleAdsApiKey,
          googleApiKey,
          textverifiedApiKey,
          telegramBotToken,
          telegramChatId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        await showSuccess("Settings Saved", "Settings saved successfully!");
      } else {
        const data = await res.json();
        await showError("Save Failed", "Failed to save settings: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Save error:", error);
      await showError("Network Error", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="mb-6">
          <Skeleton className="h-4 w-96" />
        </div>
        <SkeletonSettingsForm />
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Configure application settings. Changes will affect new account creation and warmup behavior.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="max-w-2xl space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-100 mb-4">
            API Keys
          </h2>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                GoLogin API Key
              </label>
              <div className="relative">
                <input
                  type={showGologinKey ? "text" : "password"}
                  value={gologinApiKey}
                  onChange={(e) => setGologinApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter GoLogin API key"
                />
                <button
                  type="button"
                  onClick={() => setShowGologinKey(!showGologinKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showGologinKey ? "Hide" : "Show"}
                >
                  {showGologinKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                API key for GoLogin browser profile management
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Google Ads API Key
              </label>
              <div className="relative">
                <input
                  type={showGoogleAdsKey ? "text" : "password"}
                  value={googleAdsApiKey}
                  onChange={(e) => setGoogleAdsApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter Google Ads API key"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleAdsKey(!showGoogleAdsKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showGoogleAdsKey ? "Hide" : "Show"}
                >
                  {showGoogleAdsKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                API key for Google Ads account management
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Google API Key
              </label>
              <div className="relative">
                <input
                  type={showGoogleKey ? "text" : "password"}
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter Google API key"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showGoogleKey ? "Hide" : "Show"}
                >
                  {showGoogleKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                General Google API key for various Google services
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                TextVerified API Key
              </label>
              <div className="relative">
                <input
                  type={showTextverifiedKey ? "text" : "password"}
                  value={textverifiedApiKey}
                  onChange={(e) => setTextverifiedApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter TextVerified API key"
                />
                <button
                  type="button"
                  onClick={() => setShowTextverifiedKey(!showTextverifiedKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showTextverifiedKey ? "Hide" : "Show"}
                >
                  {showTextverifiedKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                API key for TextVerified phone verification (non-VoIP numbers for Google Ads)
              </p>
            </div>
          </div>
        </div>

        {/* Telegram Bot Settings */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Telegram Notifications
            </h2>
            <div className="group relative">
              <span className="text-slate-400 cursor-help text-sm">ⓘ</span>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-lg text-xs text-slate-300 z-10">
                <p className="font-medium text-slate-100 mb-2">How to create a Telegram Bot:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Telegram and search for <span className="text-emerald-400">@BotFather</span></li>
                  <li>Send <span className="font-mono bg-slate-900 px-1 rounded">/newbot</span> and follow the prompts</li>
                  <li>Copy the bot token provided</li>
                  <li>Add your bot to a group or start a chat with it</li>
                  <li>Get your Chat ID using <span className="text-emerald-400">@userinfobot</span></li>
                </ol>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Telegram Bot Token
              </label>
              <div className="relative">
                <input
                  type={showTelegramToken ? "text" : "password"}
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                />
                <button
                  type="button"
                  onClick={() => setShowTelegramToken(!showTelegramToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showTelegramToken ? "Hide" : "Show"}
                >
                  {showTelegramToken ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bot token from @BotFather (format: 123456789:ABC...)
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="-1001234567890"
              />
              <p className="text-xs text-slate-500 mt-1">
                Chat or group ID where notifications will be sent (use @userinfobot to find it)
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {settings && (
          <p className="text-xs text-slate-500">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}
      </form>

      {/* Integration Tools Section */}
      <div className="mt-8 max-w-2xl rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold text-slate-100 mb-4">
          Integration Tools
        </h2>

        <div className="space-y-4">
          {/* Bookmarklet */}
          <div>
            <h3 className="text-sm font-medium text-slate-200 mb-2">
              Connect to MagiManager Bookmarklet
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Drag this button to your bookmarks bar. When on any Google Ads page, click it to connect that account to MagiManager via OAuth.
            </p>

            <div className="flex items-center gap-4">
              <a
                href="javascript:(function(){var cid=location.href.match(/\/(\d{3}-\d{3}-\d{4})\//)?.[1]||document.querySelector('[data-customer-id]')?.dataset.customerId;if(cid){var w=600,h=700,l=(screen.width-w)/2,t=(screen.height-h)/2;window.open('https://abra.magimanager.com/api/oauth/google-ads/authorize?cid='+cid.replace(/-/g,''),'oauth','width='+w+',height='+h+',left='+l+',top='+t);}else{alert('Could not detect CID. Make sure you are on a Google Ads account page.');}})();"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm cursor-move hover:bg-emerald-400 transition"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Drag this button to your bookmarks bar to install it. Don\'t click it here!');
                }}
                draggable
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                </svg>
                Connect to MagiManager
              </a>

              <span className="text-xs text-slate-500">← Drag to bookmarks bar</span>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-700">
              <p className="text-xs font-medium text-slate-300 mb-2">How to use:</p>
              <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                <li>Drag the green button above to your bookmarks bar</li>
                <li>Open a Google Ads account page in any browser</li>
                <li>Click the bookmarklet in your bookmarks bar</li>
                <li>Approve OAuth access in the popup</li>
                <li>Account is now connected and syncing!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// MEDIA BUYER VIEWS
// ============================================================================

// My Accounts View - Shows accounts assigned to the logged-in media buyer
function MyAccountsView() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAccounts();
  }, []);

  async function fetchMyAccounts() {
    setLoading(true);
    try {
      // Use dedicated my-accounts endpoint with server-side role-based filtering
      const res = await fetch("/api/accounts/my-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch my accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  function openThreadModal(account: AdAccount) {
    setEditingNotes(account.id);
  }

  if (loading) {
    return <SkeletonAccountsTable />;
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">You don't have any accounts assigned yet.</p>
        <p className="text-sm text-slate-500">Request an account from the Requests page.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-800">
            <tr className="text-left text-xs text-slate-400">
              <th className="pb-3 font-semibold">Identity</th>
              <th className="pb-3 font-semibold">Google CID</th>
              <th className="pb-3 font-semibold">Status</th>
              <th className="pb-3 font-semibold">Spend</th>
              <th className="pb-3 font-semibold">Ads</th>
              <th className="pb-3 font-semibold">Handoff Date</th>
              <th className="pb-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-slate-800/50">
                <td className="py-4 text-slate-200">{account.identityProfile?.fullName || "Unassigned"}</td>
                <td className="py-4 text-slate-300">{formatCid(account.googleCid) || "—"}</td>
                <td className="py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    account.status === "active" ? "bg-emerald-500/20 text-emerald-300" :
                    account.status === "warming" ? "bg-amber-500/20 text-amber-300" :
                    account.status === "provisioned" ? "bg-blue-500/20 text-blue-300" :
                    "bg-slate-500/20 text-slate-300"
                  }`}>
                    {account.status}
                  </span>
                </td>
                <td className="py-4 text-slate-300">${account.currentSpendTotal}</td>
                <td className="py-4 text-slate-300">{account.adsCount}</td>
                <td className="py-4 text-slate-400 text-xs">
                  {account.handoffDate ? formatDateForDisplay(account.handoffDate) : "—"}
                </td>
                <td className="py-4">
                  <button
                    onClick={() => openThreadModal(account)}
                    className="text-xs text-slate-400 hover:text-slate-300"
                    title="View conversation thread"
                  >
                    💬 Thread
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingNotes && (
        <ThreadConversationModal
          accountId={editingNotes}
          onClose={() => setEditingNotes(null)}
        />
      )}
    </>
  );
}

// My Requests View - Shows requests created by the logged-in media buyer
function MyRequestsView() {
  const { showConfirm, showError } = useModal();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  async function fetchMyRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Failed to fetch my requests:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelRequest(requestId: string) {
    const confirmed = await showConfirm(
      "Cancel Request",
      "Are you sure you want to cancel this request?",
      { confirmText: "Cancel Request", cancelText: "Keep Request" }
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchMyRequests();
      } else {
        await showError("Failed", "Failed to cancel request");
      }
    } catch (error) {
      console.error("Failed to cancel request:", error);
      await showError("Error", "Failed to cancel request");
    }
  }

  async function handleArchiveRequest(requestId: string) {
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
      });
      if (res.ok) {
        fetchMyRequests();
      } else {
        await showError("Failed", "Failed to archive request");
      }
    } catch (error) {
      console.error("Failed to archive request:", error);
      await showError("Error", "Failed to archive request");
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading your requests...</div>;
  }

  return (
    <>
      <div className="mb-6">
        <button
          onClick={() => setShowNewRequestModal(true)}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          + New Request
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">You haven't submitted any requests yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400">
                <th className="pb-3 font-semibold">Type</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Justification</th>
                <th className="pb-3 font-semibold">Rejection Reason</th>
                <th className="pb-3 font-semibold">Submitted</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-slate-800/50">
                  <td className="py-4 text-slate-200">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      req.type === "CLAIM_EXISTING" ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                    }`}>
                      {req.type === "CLAIM_EXISTING" ? "Claim Existing" : "Request New"}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      req.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" :
                      req.status === "REJECTED" ? "bg-red-500/20 text-red-300" :
                      req.status === "ARCHIVED" ? "bg-slate-500/20 text-slate-400" :
                      "bg-amber-500/20 text-amber-300"
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-4 text-slate-400 text-xs max-w-xs truncate">
                    {req.justification || "—"}
                  </td>
                  <td className="py-4 text-slate-400 text-xs max-w-xs truncate">
                    {req.rejectionReason || "—"}
                  </td>
                  <td className="py-4 text-slate-400 text-xs">
                    <div>{formatDateForDisplay(req.createdAt)}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(req.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex gap-3">
                      {req.status === "PENDING" && (
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Cancel
                        </button>
                      )}
                      {req.status !== "ARCHIVED" && (
                        <button
                          onClick={() => handleArchiveRequest(req.id)}
                          className="text-slate-400 hover:text-slate-300 text-xs"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewRequestModal && (
        <NewAccountRequestModal
          onClose={() => setShowNewRequestModal(false)}
          onSuccess={() => {
            setShowNewRequestModal(false);
            fetchMyRequests();
          }}
        />
      )}
    </>
  );
}

// Admin Requests View - Shows all requests for admin review
function AdminRequestsView({ onApprove }: { onApprove: (requestId: string) => void }) {
  const { showError, showPrompt } = useModal();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AccountRequest[]>([]);

  useEffect(() => {
    fetchAllRequests();
  }, []);

  async function fetchAllRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleArchiveRequest(requestId: string) {
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
      });
      if (res.ok) {
        fetchAllRequests();
      } else {
        await showError("Failed", "Failed to archive request");
      }
    } catch (error) {
      console.error("Failed to archive request:", error);
      await showError("Error", "Failed to archive request");
    }
  }

  async function handleReview(requestId: string, status: "APPROVED" | "REJECTED", adminNotes?: string) {
    try {
      const endpoint = status === "APPROVED"
        ? `/api/requests/${requestId}/approve`
        : `/api/requests/${requestId}/reject`;

      const body = status === "REJECTED"
        ? { rejectionReason: adminNotes || "No reason provided" }
        : {};

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (status === "APPROVED") {
          // Redirect to Identity Profile creation form
          onApprove(requestId);
        } else {
          // Just refresh the list for rejections
          fetchAllRequests();
        }
      }
    } catch (error) {
      console.error("Failed to review request:", error);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No account requests yet.</p>
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const reviewedRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-8">
      {pendingRequests.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-100 mb-4">Pending Requests</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800">
                <tr className="text-left text-xs text-slate-400">
                  <th className="pb-3 font-semibold">Requester</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Justification</th>
                  <th className="pb-3 font-semibold">Submitted</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {pendingRequests.map((req) => (
                  <tr key={req.id} className="border-b border-slate-800/50">
                    <td className="py-4 text-slate-200">
                      <div>{req.requester?.name || "—"}</div>
                      <div className="text-xs text-slate-500">{req.requester?.email || ""}</div>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        req.type === "CLAIM_EXISTING" ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                      }`}>
                        {req.type === "CLAIM_EXISTING" ? "Claim Existing" : "Request New"}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 text-xs max-w-xs truncate">
                      {req.justification || "—"}
                    </td>
                    <td className="py-4 text-slate-400 text-xs">
                      <div>{formatDateForDisplay(req.createdAt)}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(req.createdAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="py-4 space-x-2">
                      <button
                        onClick={() => {
                          handleReview(req.id, "APPROVED");
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={async () => {
                          const reason = await showPrompt(
                            "Reject Request",
                            "Please provide a reason for rejecting this request:",
                            { placeholder: "Enter rejection reason...", confirmText: "Reject", cancelText: "Cancel" }
                          );
                          if (reason) handleReview(req.id, "REJECTED", reason);
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        ✕ Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reviewedRequests.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-100 mb-4">Reviewed Requests</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800">
                <tr className="text-left text-xs text-slate-400">
                  <th className="pb-3 font-semibold">Requester</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Justification</th>
                  <th className="pb-3 font-semibold">Rejection Reason</th>
                  <th className="pb-3 font-semibold">Reviewed</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {reviewedRequests.map((req) => (
                  <tr key={req.id} className="border-b border-slate-800/50">
                    <td className="py-4 text-slate-200">
                      <div>{req.requester?.name || "—"}</div>
                      <div className="text-xs text-slate-500">{req.requester?.email || ""}</div>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        req.type === "CLAIM_EXISTING" ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
                      }`}>
                        {req.type === "CLAIM_EXISTING" ? "Claim Existing" : "Request New"}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        req.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" :
                        req.status === "REJECTED" ? "bg-red-500/20 text-red-300" :
                        req.status === "ARCHIVED" ? "bg-slate-500/20 text-slate-400" :
                        "bg-amber-500/20 text-amber-300"
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 text-xs max-w-xs truncate">
                      {req.justification || "—"}
                    </td>
                    <td className="py-4 text-slate-400 text-xs max-w-xs truncate">
                      {req.rejectionReason || "—"}
                    </td>
                    <td className="py-4 text-slate-400 text-xs">
                      {req.reviewedAt ? (
                        <>
                          <div>{formatDateForDisplay(req.reviewedAt)}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(req.reviewedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </>
                      ) : "—"}
                    </td>
                    <td className="py-4">
                      {req.status !== "ARCHIVED" && (
                        <button
                          onClick={() => handleArchiveRequest(req.id)}
                          className="text-slate-400 hover:text-slate-300 text-xs"
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// New Account Request Modal
function NewAccountRequestModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showError } = useModal();
  const [requestType, setRequestType] = useState<"CLAIM" | "NEW">("CLAIM");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (requestType === "CLAIM") {
      fetchAvailableAccounts();
    }
  }, [requestType]);

  async function fetchAvailableAccounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts?handoffStatus=available");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        type: requestType === "CLAIM" ? "CLAIM_EXISTING" : "CREATE_NEW",
        justification: notes,
      };

      if (requestType === "CLAIM") {
        payload.existingAccountId = selectedAccountId;
      }

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        await showError("Request Failed", data.error || "Failed to create request");
      }
    } catch (error) {
      console.error("Failed to create request:", error);
      await showError("Error", "Failed to create request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-100">New Account Request</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Request Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="CLAIM"
                  checked={requestType === "CLAIM"}
                  onChange={(e) => setRequestType(e.target.value as "CLAIM")}
                  className="text-indigo-500"
                />
                <span className="text-sm text-slate-300">Claim Existing Account</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="NEW"
                  checked={requestType === "NEW"}
                  onChange={(e) => setRequestType(e.target.value as "NEW")}
                  className="text-indigo-500"
                />
                <span className="text-sm text-slate-300">Request New Account</span>
              </label>
            </div>
          </div>

          {requestType === "CLAIM" && (
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Select Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Choose an account...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {formatCid(acc.googleCid)} - {acc.identityProfile?.fullName || "Unassigned"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Justification {requestType === "CLAIM" ? "(optional)" : "(required)"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required={requestType === "NEW"}
              rows={3}
              placeholder={requestType === "CLAIM" ? "Any additional information..." : "Please explain why you need a new account..."}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 disabled:opacity-50 transition-all"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// FIRST LOGIN PASSWORD CHANGE MODAL
// ============================================================================

function FirstLoginPasswordChangeModal({ onSuccess }: { onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Validate passwords
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to change password");
      }
    } catch (error) {
      console.error("Failed to change password:", error);
      setError("Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md">
        <div className="p-6 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-slate-100">Change Your Password</h3>
          <p className="text-sm text-slate-400 mt-1">
            For security reasons, you must change your password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 8 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 disabled:opacity-50 transition-all font-medium"
            >
              {submitting ? "Changing Password..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// PLACEHOLDER VIEW
// ============================================================================

function PlaceholderView({ title }: { title: string}) {
  return (
    <div className="text-center py-12">
      <p className="text-slate-400">
        {title} view coming soon...
      </p>
    </div>
  );
}
