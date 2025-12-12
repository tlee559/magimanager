"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent, useMemo } from "react";
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
  websiteNotes: string | null;
  websiteCompleted: boolean;
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
  // Status
  inactive: boolean;
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

export type View = "dashboard" | "identities" | "create-identity" | "identity-detail" | "edit-identity" | "import-identities" | "ad-accounts" | "team" | "settings" | "my-accounts" | "requests" | "admin-requests" | "system" | "sms-dashboard" | "authenticator" | "tutorial" | "faq" | "websites";

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
// URL ROUTING HELPERS
// ============================================================================

const VIEW_TO_PATH: Record<View, string> = {
  "dashboard": "/admin",
  "identities": "/admin/identities",
  "create-identity": "/admin/identities/new",
  "identity-detail": "/admin/identities/detail",
  "edit-identity": "/admin/identities/edit",
  "import-identities": "/admin/identities/import",
  "ad-accounts": "/admin/accounts",
  "team": "/admin/team",
  "settings": "/admin/settings",
  "my-accounts": "/admin/my-accounts",
  "requests": "/admin/my-requests",
  "admin-requests": "/admin/requests",
  "system": "/admin/system",
  "sms-dashboard": "/admin/sms",
  "authenticator": "/admin/authenticator",
  "tutorial": "/admin/tutorial",
  "faq": "/admin/faq",
  "websites": "/admin/websites",
};

const PATH_TO_VIEW: Record<string, View> = {
  "/admin": "dashboard",
  "/admin/": "dashboard",
  "/admin/identities": "identities",
  "/admin/identities/new": "create-identity",
  "/admin/identities/detail": "identity-detail",
  "/admin/identities/edit": "edit-identity",
  "/admin/identities/import": "import-identities",
  "/admin/accounts": "ad-accounts",
  "/admin/team": "team",
  "/admin/settings": "settings",
  "/admin/my-accounts": "my-accounts",
  "/admin/my-requests": "requests",
  "/admin/requests": "admin-requests",
  "/admin/system": "system",
  "/admin/sms": "sms-dashboard",
  "/admin/authenticator": "authenticator",
  "/admin/tutorial": "tutorial",
  "/admin/faq": "faq",
  "/admin/websites": "websites",
};

function getViewFromPath(pathname: string): View {
  // Exact match first
  if (PATH_TO_VIEW[pathname]) return PATH_TO_VIEW[pathname];
  // Check for prefix matches (e.g., /admin/identities/123 -> identities)
  if (pathname.startsWith("/admin/identities/")) return "identities";
  if (pathname.startsWith("/admin/accounts/")) return "ad-accounts";
  return "dashboard";
}

// ============================================================================
// MAIN ADMIN COMPONENT
// ============================================================================
//
// IMPORTANT: This is the CANONICAL AdminApp component for ABRA.
// DO NOT create a separate layout.tsx or page routes that bypass this component.
// URL routing is handled internally via VIEW_TO_PATH/PATH_TO_VIEW mappings.
// If you need to add a new view, add it to the View type and the mappings above.
//
// ============================================================================

interface AdminAppProps {
  appVersion?: string;
  buildSha?: string;
  kadabraUrl?: string;
  /** Initial view from URL - parsed by the page component */
  initialView?: View;
}

export function AdminApp({
  appVersion = "0.1.0",
  buildSha = "local",
  kadabraUrl = "https://magimanager.com",
  initialView,
}: AdminAppProps) {
  const { data: session } = useSession();

  // Initialize view from URL or prop
  const [view, setViewState] = useState<View>(() => {
    if (initialView) return initialView;
    if (typeof window !== "undefined") {
      return getViewFromPath(window.location.pathname);
    }
    return "dashboard";
  });

  // Sync URL when view changes
  const setView = (newView: View) => {
    setViewState(newView);
    const newPath = VIEW_TO_PATH[newView] || "/admin";
    if (typeof window !== "undefined" && window.location.pathname !== newPath) {
      window.history.pushState({ view: newView }, "", newPath);
    }
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.view) {
        setViewState(event.state.view);
      } else if (typeof window !== "undefined") {
        setViewState(getViewFromPath(window.location.pathname));
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);
  const [criticalAlertsCount, setCriticalAlertsCount] = useState(0);
  // Get user role from session (type-safe via @magimanager/auth declarations)
  const userRole = (session?.user?.role as UserRole) || "SUPER_ADMIN";
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
  const userId = session?.user?.id || null;
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
        { id: "identities" as View, label: "ID Profiles", icon: "👥" }
      );
    }

    // SMS Dashboard - Super Admin and Admin only (Coming Soon teaser)
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") {
      items.push(
        { id: "sms-dashboard" as View, label: "SMS", icon: "📱", comingSoon: true }
      );
    }

    // 1-Click Websites - Admin only
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") {
      items.push(
        { id: "websites" as View, label: "1-Click Websites", icon: "🌐" }
      );
    }

    // Authenticator - for admins and managers
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
      items.push(
        { id: "authenticator" as View, label: "Authenticator", icon: "🔐" },
        { id: "team" as View, label: "Team", icon: "👨‍👩‍👧‍👦" }
      );
    }

    // Account Requests - for admins and managers
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER") {
      items.push(
        { id: "admin-requests" as View, label: "Account Requests", icon: "📥" }
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
              Account Management Console
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

        {/* Kadabra Ad Manager Button */}
        <div className="flex-shrink-0 px-3 py-3 border-t border-slate-800">
          <a
            href={`${kadabraUrl}/admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-[1.02]"
          >
            <span className="text-base">🚀</span>
            <span>KADABRA Ad Manager</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 opacity-70">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>

        {/* Version Info - Minimal footer */}
        <div className="flex-shrink-0 w-full px-4 py-2 border-t border-slate-800">
          <div className="text-[10px] text-center text-slate-500">
            ABRA v{appVersion} · {buildSha?.slice(0, 7) || "local"}
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
            {view === "import-identities" && <h1 className="text-lg font-semibold text-slate-50">Import Identity Profiles</h1>}
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
            {view === "authenticator" && <h1 className="text-lg font-semibold text-slate-50">2FA Authenticator</h1>}
            {view === "websites" && <h1 className="text-lg font-semibold text-slate-50">1-Click Websites</h1>}
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
              href={`${kadabraUrl}/admin`}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg transition flex flex-col items-center"
            >
              <span className="text-xs font-semibold">Kadabra</span>
              <span className="text-[9px] opacity-80">Ad Manager</span>
            </a>

            {/* User Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                  {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-slate-100">{session?.user?.name || "User"}</div>
                  <div className="text-xs text-slate-400">{userRole.replace("_", " ")}</div>
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-slate-800">
                      <div className="text-sm font-medium text-slate-100">{session?.user?.name || "User"}</div>
                      <div className="text-xs text-slate-400">{session?.user?.email || "No email"}</div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowProfileModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 transition flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setView("settings");
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 transition flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setView("tutorial");
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 transition flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Tutorial &amp; Guides
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setView("faq");
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 transition flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        FAQ
                      </button>
                    </div>
                    <div className="border-t border-slate-800 py-1">
                      <button
                        onClick={() => {
                          window.location.href = "/logout";
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-slate-800 transition flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
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
                onImportCSV={() => setView("import-identities")}
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
            {view === "import-identities" && (
              <ImportIdentitiesView
                onSuccess={() => {
                  fetchIdentities();
                  setView("identities");
                }}
                onCancel={() => setView("identities")}
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
            {view === "authenticator" && (
              <AuthenticatorStandaloneView onNavigateToIdentity={(id) => {
                setSelectedIdentity(identities.find(i => i.id === id) || null);
                setView("identity-detail");
              }} />
            )}
            {view === "tutorial" && <TutorialView />}
            {view === "faq" && <FAQView />}
            {view === "websites" && <WebsitesView />}
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
  // Filter out archived and inactive items for dashboard stats
  const activeIdentities = identities.filter(i => !i.archived && !i.inactive);
  const inactiveIdentities = identities.filter(i => !i.archived && i.inactive);
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
            {inactiveIdentities.length > 0 && (
              <span className="text-red-400"> ({inactiveIdentities.length} inactive)</span>
            )}
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
  onImportCSV,
  onSelectIdentity,
}: {
  identities: Identity[];
  loading: boolean;
  onCreateNew: () => void;
  onImportCSV: () => void;
  onSelectIdentity: (id: string) => void;
}) {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [geoFilter, setGeoFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [hideInactive, setHideInactive] = useState(false);
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

      // Inactive filter (hide inactive when toggle is on)
      if (hideInactive && identity.inactive) return false;

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
  }, [identities, searchQuery, geoFilter, showArchived, hideInactive]);

  // Pagination
  const totalPages = Math.ceil(filteredIdentities.length / ITEMS_PER_PAGE);
  const paginatedIdentities = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredIdentities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredIdentities, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, geoFilter, showArchived, hideInactive]);

  const hasIdentities = filteredIdentities.length > 0;
  const totalCount = identities.filter(i => showArchived ? i.archived : !i.archived).length;
  const archivedCount = identities.filter(i => i.archived).length;
  const inactiveCount = identities.filter(i => !i.archived && i.inactive).length;

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

        <div className="flex items-center gap-2">
          <button
            onClick={onImportCSV}
            className="inline-flex items-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600 transition"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition"
          >
            + New Identity Profile
          </button>
        </div>
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

        {/* Hide Inactive Toggle */}
        {inactiveCount > 0 && !showArchived && (
          <button
            onClick={() => setHideInactive(!hideInactive)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              hideInactive
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
            }`}
          >
            {hideInactive ? "Inactive Hidden" : "Hide Inactive"}
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-slate-700 rounded">
              {inactiveCount}
            </span>
          </button>
        )}

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
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                Website
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400" title="Ad Account linked">
                Ad Account
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400" title="Documents uploaded">
                Docs
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400" title="GoLogin profile created">
                GoLogin
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                Status
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
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-4 rounded-full mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-4 rounded-full mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-4 rounded-full mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
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
                      identity.inactive ? "!bg-red-950/50 border-l-4 border-l-red-500" : ""
                    } ${identity.archived ? "opacity-60" : ""}`}
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
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[150px]">
                      {identity.website ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              identity.websiteCompleted ? "bg-emerald-500" : "bg-red-500"
                            }`}
                            title={identity.websiteCompleted ? "Website completed" : "Website in progress"}
                          />
                          <span className="text-emerald-400 truncate" title={identity.website}>
                            {identity.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
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
                    {/* Status Toggle */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 text-xs rounded font-medium ${
                          identity.inactive
                            ? "bg-red-500/20 text-red-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {identity.inactive ? "Inactive" : "Active"}
                      </span>
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
                  colSpan={9}
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
            type="text"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="example.com"
          />
          <p className="text-xs text-slate-500 mt-1">https:// will be added automatically</p>
          {errors.website && <p className="text-xs text-rose-400 mt-1">{errors.website}</p>}
        </div>

        {/* Website Notes */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Website Notes (optional)
          </label>
          <textarea
            name="websiteNotes"
            rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            placeholder="FTP credentials, hosting info, etc."
          />
          <p className="text-xs text-slate-500 mt-1">Store FTP credentials, hosting info, or other website-related notes</p>
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

// ============================================================================
// IMPORT IDENTITIES VIEW
// ============================================================================

interface CSVIdentityRow {
  fullName: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  geo: string;
  website?: string;
  documentUrl?: string;
}

interface ParsedCSVResult {
  rows: CSVIdentityRow[];
  errors: { row: number; message: string }[];
}

interface ImportResultData {
  success: boolean;
  created: number;
  failed: number;
  documentWarnings: string[];
  errors: { row: number; message: string }[];
}

function parseCSVContent(csvContent: string): ParsedCSVResult {
  const lines = csvContent.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 0, message: 'CSV must have a header row and at least one data row' }] };
  }

  // Parse header row
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[_\s-]/g, ''));

  // Map headers to column indices
  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    if (header === 'fullname' || header === 'name') columnMap.fullName = index;
    else if (header === 'dob' || header === 'dateofbirth' || header === 'birthdate') columnMap.dob = index;
    else if (header === 'address' || header === 'streetaddress' || header === 'street') columnMap.address = index;
    else if (header === 'city') columnMap.city = index;
    else if (header === 'state') columnMap.state = index;
    else if (header === 'zipcode' || header === 'zip' || header === 'postalcode') columnMap.zipcode = index;
    else if (header === 'geo' || header === 'country' || header === 'region') columnMap.geo = index;
    else if (header === 'website' || header === 'url' || header === 'site') columnMap.website = index;
    else if (header === 'documenturl' || header === 'docurl' || header === 'document' || header === 'drivelink') columnMap.documentUrl = index;
  });

  // Check for missing required columns
  const requiredColumns = ['fullName', 'dob', 'address', 'city', 'state', 'zipcode', 'geo'];
  const missingColumns = requiredColumns.filter(col => columnMap[col] === undefined);
  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [{ row: 0, message: `Missing required columns: ${missingColumns.join(', ')}` }]
    };
  }

  const rows: CSVIdentityRow[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    const row: CSVIdentityRow = {
      fullName: values[columnMap.fullName]?.trim() || '',
      dob: values[columnMap.dob]?.trim() || '',
      address: values[columnMap.address]?.trim() || '',
      city: values[columnMap.city]?.trim() || '',
      state: values[columnMap.state]?.trim() || '',
      zipcode: values[columnMap.zipcode]?.trim() || '',
      geo: values[columnMap.geo]?.trim() || '',
      website: columnMap.website !== undefined ? values[columnMap.website]?.trim() || undefined : undefined,
      documentUrl: columnMap.documentUrl !== undefined ? values[columnMap.documentUrl]?.trim() || undefined : undefined,
    };

    // Validate row
    const missingFields: string[] = [];
    if (!row.fullName) missingFields.push('fullName');
    if (!row.dob) missingFields.push('dob');
    if (!row.address) missingFields.push('address');
    if (!row.city) missingFields.push('city');
    if (!row.state) missingFields.push('state');
    if (!row.zipcode) missingFields.push('zipcode');
    if (!row.geo) missingFields.push('geo');

    if (missingFields.length > 0) {
      errors.push({ row: i + 1, message: `Missing: ${missingFields.join(', ')}` });
    } else {
      rows.push(row);
    }
  }

  return { rows, errors };
}

function ImportIdentitiesView({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [csvContent, setCSVContent] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedCSVResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCSVContent(content);
      setParsedData(parseCSVContent(content));
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileSelect(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.rows.length === 0) return;

    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch('/api/identities/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedData.rows }),
      });

      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false,
          created: 0,
          failed: parsedData.rows.length,
          documentWarnings: [],
          errors: [{ row: 0, message: result.error || 'Import failed' }],
        });
      } else {
        setImportResult(result);
        if (result.created > 0 && result.failed === 0) {
          // All succeeded - could auto-navigate
        }
      }
    } catch (error) {
      setImportResult({
        success: false,
        created: 0,
        failed: parsedData.rows.length,
        documentWarnings: [],
        errors: [{ row: 0, message: 'Network error during import' }],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setCSVContent('');
    setParsedData(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-100 mb-2">CSV Format</h3>
        <p className="text-xs text-slate-400 mb-2">
          Upload a CSV file with the following columns:
        </p>
        <div className="bg-slate-900 rounded p-2 font-mono text-xs text-slate-300 overflow-x-auto">
          fullName, dob, address, city, state, zipcode, geo, website (optional), documentUrl (optional)
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Date format: YYYY-MM-DD or MM/DD/YYYY. website and documentUrl are optional - leave blank to skip. documentUrl should be a Google Drive share link (file must be publicly shared).
        </p>
      </div>

      {/* File Upload Area */}
      {!parsedData && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
            dragActive
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-slate-600 hover:border-slate-500'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <svg className="w-12 h-12 mx-auto text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-slate-300 mb-2">Drag and drop your CSV file here</p>
          <p className="text-slate-500 text-sm mb-4">or</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 bg-slate-700 text-slate-100 rounded-lg hover:bg-slate-600 transition text-sm font-medium"
          >
            Browse Files
          </button>
        </div>
      )}

      {/* Preview Table */}
      {parsedData && !importResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-100">
                Preview ({parsedData.rows.length} valid rows)
              </h3>
              {parsedData.errors.length > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  {parsedData.errors.length} row(s) have errors and will be skipped
                </p>
              )}
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-slate-400 hover:text-slate-300"
            >
              Choose different file
            </button>
          </div>

          {/* Errors */}
          {parsedData.errors.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-400 mb-2">Parse Errors:</p>
              <ul className="text-xs text-amber-300 space-y-1">
                {parsedData.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>Row {err.row}: {err.message}</li>
                ))}
                {parsedData.errors.length > 5 && (
                  <li>... and {parsedData.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}

          {/* Data Preview Table */}
          {parsedData.rows.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">DOB</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">City, State</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Geo</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Website</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Doc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {parsedData.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-700/50">
                        <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-100">{row.fullName}</td>
                        <td className="px-3 py-2 text-slate-300">{row.dob}</td>
                        <td className="px-3 py-2 text-slate-300">{row.city}, {row.state}</td>
                        <td className="px-3 py-2 text-slate-300">{row.geo}</td>
                        <td className="px-3 py-2">
                          {row.website ? (
                            <span className="text-blue-400 truncate max-w-[120px] block" title={row.website}>{row.website}</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.documentUrl ? (
                            <span className="text-emerald-400" title={row.documentUrl}>Yes</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.rows.length > 20 && (
                  <div className="px-3 py-2 text-xs text-slate-500 bg-slate-900">
                    Showing first 20 of {parsedData.rows.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || parsedData.rows.length === 0}
              className="inline-flex items-center px-6 py-2 bg-emerald-500 text-slate-950 rounded-lg font-medium hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Importing...</span>
                </>
              ) : (
                `Import ${parsedData.rows.length} Profile${parsedData.rows.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import Results */}
      {importResult && (
        <div className="space-y-4">
          <div className={`rounded-lg p-4 border ${
            importResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : importResult.created > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-red-500/10 border-red-500/30'
          }`}>
            <h3 className={`text-sm font-medium mb-2 ${
              importResult.success ? 'text-emerald-400' : importResult.created > 0 ? 'text-amber-400' : 'text-red-400'
            }`}>
              Import {importResult.success ? 'Complete' : 'Finished with Issues'}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Created:</span>
                <span className="ml-2 text-emerald-400 font-medium">{importResult.created}</span>
              </div>
              <div>
                <span className="text-slate-400">Failed:</span>
                <span className="ml-2 text-red-400 font-medium">{importResult.failed}</span>
              </div>
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs font-medium text-red-400 mb-1">Errors:</p>
                <ul className="text-xs text-red-300 space-y-1">
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>Row {err.row}: {err.message}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li>... and {importResult.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Document Warnings */}
            {importResult.documentWarnings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs font-medium text-amber-400 mb-1">Document Warnings:</p>
                <ul className="text-xs text-amber-300 space-y-1">
                  {importResult.documentWarnings.slice(0, 5).map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                  {importResult.documentWarnings.length > 5 && (
                    <li>... and {importResult.documentWarnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 transition"
            >
              Import More
            </button>
            <button
              onClick={onSuccess}
              className="px-6 py-2 bg-emerald-500 text-slate-950 rounded-lg font-medium hover:bg-emerald-400 transition"
            >
              View Identities
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
            type="text"
            defaultValue={identity.website || ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="example.com"
          />
          <p className="text-xs text-slate-500 mt-1">https:// will be added automatically</p>
          {errors.website && <p className="text-xs text-rose-400 mt-1">{errors.website}</p>}
        </div>

        {/* Website Notes */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-200">
            Website Notes (optional)
          </label>
          <textarea
            name="websiteNotes"
            rows={3}
            defaultValue={identity.websiteNotes || ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            placeholder="FTP credentials, hosting info, etc."
          />
          <p className="text-xs text-slate-500 mt-1">Store FTP credentials, hosting info, or other website-related notes</p>
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
  const [togglingInactive, setTogglingInactive] = useState(false);
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

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optimistic state for website completed checkbox
  const [optimisticWebsiteCompleted, setOptimisticWebsiteCompleted] = useState<boolean | null>(null);
  const websiteCompleted = optimisticWebsiteCompleted ?? identity.websiteCompleted;

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

  // Document upload handler (supports multiple files)
  async function handleDocumentUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingDoc(true);
    const fileArray = Array.from(files);
    let successCount = 0;
    let failedCount = 0;
    const failedNames: string[] = [];

    try {
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "DOCUMENT");

        try {
          const res = await fetch(`/api/identities/${identity.id}/documents`, {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            successCount++;
          } else {
            failedCount++;
            failedNames.push(file.name);
          }
        } catch {
          failedCount++;
          failedNames.push(file.name);
        }
      }

      if (successCount > 0 && failedCount === 0) {
        await showSuccess(
          "Documents Uploaded",
          successCount === 1
            ? `${fileArray[0].name} has been uploaded successfully.`
            : `${successCount} documents have been uploaded successfully.`
        );
      } else if (successCount > 0 && failedCount > 0) {
        await showAlert(
          "Partial Upload",
          `${successCount} uploaded successfully, ${failedCount} failed: ${failedNames.join(", ")}`
        );
      } else {
        await showError("Upload Failed", "Failed to upload documents");
      }

      if (successCount > 0) {
        onRefresh();
      }
    } catch (error) {
      console.error("Upload error:", error);
      await showError("Upload Error", "Failed to upload documents");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // Document delete handler
  async function handleDocumentDelete(docId: string, docType: string) {
    const confirmed = await showConfirm(
      "Delete Document",
      `Are you sure you want to delete this ${docType.replace(/_/g, " ").toLowerCase()}?`,
      { confirmText: "Delete", cancelText: "Cancel" }
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/identities/${identity.id}/documents?documentId=${docId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await showSuccess("Document Deleted", "Document has been deleted.");
        onRefresh();
      } else {
        const data = await res.json();
        await showError("Delete Failed", data.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Delete error:", error);
      await showError("Delete Error", "Failed to delete document");
    }
  }

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

  async function handleToggleInactive() {
    const action = identity.inactive ? "activate" : "mark inactive";
    const confirmed = await showConfirm(
      identity.inactive ? "Mark as Active" : "Mark as Inactive",
      identity.inactive
        ? `Mark ${identity.fullName} as active again?`
        : `Mark ${identity.fullName} as inactive? Inactive identities will be highlighted in red in the list.`,
      { confirmText: identity.inactive ? "Activate" : "Mark Inactive", cancelText: "Cancel" }
    );
    if (!confirmed) return;

    setTogglingInactive(true);
    try {
      const res = await fetch(`/api/identities/${identity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inactive: !identity.inactive }),
      });

      if (res.ok) {
        await showSuccess(
          identity.inactive ? "Identity Activated" : "Identity Marked Inactive",
          identity.inactive
            ? `${identity.fullName} has been marked as active.`
            : `${identity.fullName} has been marked as inactive.`
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
      setTogglingInactive(false);
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
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <a href={identity.website} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 truncate">
                      {identity.website}
                    </a>
                    {identity.websiteNotes && (
                      <div className="relative group">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-blue-400 transition"
                          title="View website notes"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl">
                          <div className="text-xs font-medium text-slate-300 mb-1">Website Notes</div>
                          <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">{identity.websiteNotes}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={websiteCompleted}
                      onChange={async (e) => {
                        const newValue = e.target.checked;
                        // Optimistic update - instant UI feedback
                        setOptimisticWebsiteCompleted(newValue);
                        try {
                          const res = await fetch(`/api/identities/${identity.id}/website-status`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ websiteCompleted: newValue }),
                          });
                          if (!res.ok) {
                            // Revert on error
                            setOptimisticWebsiteCompleted(null);
                          }
                        } catch (error) {
                          console.error("Failed to update website status:", error);
                          // Revert on error
                          setOptimisticWebsiteCompleted(null);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                    />
                    <span className={`text-xs ${websiteCompleted ? "text-emerald-400" : "text-slate-400"}`}>
                      {websiteCompleted ? "Website completed" : "Mark as completed"}
                    </span>
                  </label>
                </div>
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

          {/* Upload Button */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingDoc}
              className="w-full p-3 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 hover:border-emerald-500/50 hover:bg-slate-900/60 transition flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-emerald-400"
            >
              {uploadingDoc ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Documents
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-500 mt-1 text-center">
              JPEG, PNG, WebP, PDF (max 10MB each) - Select multiple files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleDocumentUpload}
              multiple
              className="hidden"
            />
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
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-100 truncate">{doc.filePath.split("/").pop()}</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <a
                      href={doc.filePath}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDocumentDelete(doc.id, doc.type || "document")}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
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

      {/* TOTP Authenticator Section */}
      <AuthenticatorSection identityId={identity.id} />

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
          onClick={handleToggleInactive}
          disabled={togglingInactive}
          className={`rounded-lg border px-4 py-2 text-xs font-medium transition disabled:opacity-50 ${
            identity.inactive
              ? "border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
              : "border-red-700 bg-red-950/40 text-red-300 hover:bg-red-900/60"
          }`}
        >
          {togglingInactive
            ? "..."
            : identity.inactive
            ? "Mark Active"
            : "Mark Inactive"}
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
// AUTHENTICATOR TYPES
// ============================================================================

type AuthenticatorPlatform = "google" | "meta" | "tiktok" | "microsoft" | "other";

type AuthenticatorEntry = {
  id: string;
  identityProfileId: string;
  name: string;
  platform: AuthenticatorPlatform | null;
  issuer: string | null;
  accountName: string | null;
  algorithm: string;
  digits: number;
  period: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
};

type AuthenticatorWithCode = AuthenticatorEntry & {
  code: string;
  remainingSeconds: number;
};

// ============================================================================
// AUTHENTICATOR SECTION (for Identity Detail View)
// ============================================================================

function AuthenticatorSection({ identityId }: { identityId: string }) {
  const { showConfirm, showSuccess, showError } = useModal();
  const [authenticators, setAuthenticators] = useState<AuthenticatorWithCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthenticators();
    // Set up auto-refresh for codes
    const interval = setInterval(fetchAuthenticators, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [identityId]);

  async function fetchAuthenticators() {
    try {
      const res = await fetch(`/api/identities/${identityId}/authenticators/with-codes`);
      if (res.ok) {
        const data = await res.json();
        setAuthenticators(data.authenticators || []);
      }
    } catch (error) {
      console.error("Failed to fetch authenticators:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(auth: AuthenticatorEntry) {
    const confirmed = await showConfirm(
      "Delete Authenticator",
      `Are you sure you want to delete "${auth.name}"? This cannot be undone.`,
      { confirmText: "Delete", cancelText: "Cancel" }
    );
    if (!confirmed) return;

    setDeleting(auth.id);
    try {
      const res = await fetch(`/api/identities/${identityId}/authenticators/${auth.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await showSuccess("Deleted", "Authenticator has been removed.");
        fetchAuthenticators();
      } else {
        const data = await res.json();
        await showError("Delete Failed", data.error || "Failed to delete authenticator");
      }
    } catch (error) {
      console.error("Delete error:", error);
      await showError("Network Error", "Failed to connect to server");
    } finally {
      setDeleting(null);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  const platformIcons: Record<string, string> = {
    google: "🔵",
    meta: "🔷",
    tiktok: "🎵",
    microsoft: "🟦",
    other: "🔐",
  };

  if (loading) {
    return (
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-700 rounded"></div>
          <div className="h-4 w-32 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-cyan-800/50 bg-cyan-950/20 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span className="text-lg">🔐</span>
          2FA Authenticator
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-2.5 py-1 text-[10px] font-medium rounded bg-cyan-600 text-white hover:bg-cyan-500 transition"
        >
          + Add
        </button>
      </div>

      {authenticators.length === 0 ? (
        <p className="text-xs text-slate-400">
          No authenticators set up for this identity. Click "Add" to set up 2FA codes.
        </p>
      ) : (
        <div className="space-y-2">
          {authenticators.map((auth) => (
            <div
              key={auth.id}
              className="flex items-center justify-between bg-slate-950/40 rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{platformIcons[auth.platform || "other"]}</span>
                <div>
                  <div className="text-xs font-medium text-slate-100">{auth.name}</div>
                  {auth.issuer && (
                    <div className="text-[10px] text-slate-500">{auth.issuer}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div
                    className="font-mono text-lg font-bold text-cyan-400 cursor-pointer hover:text-cyan-300 transition"
                    onClick={() => copyCode(auth.code)}
                    title="Click to copy"
                  >
                    {auth.code.slice(0, 3)} {auth.code.slice(3)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {auth.remainingSeconds}s remaining
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(auth)}
                  disabled={deleting === auth.id}
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition disabled:opacity-50"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Authenticator Modal */}
      {showAddModal && (
        <AddAuthenticatorModal
          identityId={identityId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchAuthenticators();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// ADD AUTHENTICATOR MODAL
// ============================================================================

function AddAuthenticatorModal({
  identityId,
  onClose,
  onSuccess,
}: {
  identityId?: string | null;  // Optional - for standalone authenticators
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showSuccess, showError } = useModal();
  const [mode, setMode] = useState<"choose" | "manual" | "qr">("choose");
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    secret: "",
    platform: "google" as AuthenticatorPlatform,
    issuer: "",
    accountName: "",
    notes: "",
  });

  // QR image state
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process QR image
  async function processQRImage(dataUrl: string) {
    setProcessing(true);
    try {
      // Load image
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Create canvas and get image data
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Decode QR
      const jsQR = (await import("jsqr")).default;
      const qrCode = jsQR(imageData.data, canvas.width, canvas.height);

      if (!qrCode) {
        await showError("No QR Code Found", "Could not detect a QR code in the image. Make sure the QR code is clearly visible.");
        setQrImage(null);
        return;
      }

      // Parse otpauth:// URI
      const res = await fetch("/api/authenticators/parse-uri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: qrCode.data }),
      });

      if (!res.ok) {
        const data = await res.json();
        await showError("Invalid QR Code", data.error || "The QR code does not contain valid authenticator data.");
        setQrImage(null);
        return;
      }

      const parsed = await res.json();

      // Pre-fill form with parsed data
      setFormData({
        name: parsed.issuer ? `${parsed.issuer} - ${parsed.accountName || ""}`.trim() : parsed.accountName || "Authenticator",
        secret: parsed.secret,
        platform: detectPlatform(parsed.issuer),
        issuer: parsed.issuer || "",
        accountName: parsed.accountName || "",
        notes: "",
      });

      setQrImage(null);
      setMode("manual");
      await showSuccess("QR Code Scanned", "Authenticator details extracted. Review and save.");
    } catch (error) {
      console.error("QR processing error:", error);
      await showError("Processing Error", "Failed to process the QR code image.");
      setQrImage(null);
    } finally {
      setProcessing(false);
    }
  }

  // Handle file selection
  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      showError("Invalid File", "Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setQrImage(dataUrl);
      processQRImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // Handle paste event
  useEffect(() => {
    if (mode !== "qr") return;

    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
            e.preventDefault();
            break;
          }
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [mode]);

  // Handle drag and drop
  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function detectPlatform(issuer: string | null): AuthenticatorPlatform {
    if (!issuer) return "other";
    const lower = issuer.toLowerCase();
    if (lower.includes("google")) return "google";
    if (lower.includes("facebook") || lower.includes("meta") || lower.includes("instagram")) return "meta";
    if (lower.includes("tiktok")) return "tiktok";
    if (lower.includes("microsoft") || lower.includes("outlook") || lower.includes("azure")) return "microsoft";
    return "other";
  }

  async function handleSave() {
    if (!formData.name || !formData.secret) {
      await showError("Missing Fields", "Name and Secret are required.");
      return;
    }

    setSaving(true);
    try {
      // Use identity-specific or standalone API based on whether identityId is provided
      const url = identityId
        ? `/api/identities/${identityId}/authenticators`
        : `/api/authenticators`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          secret: formData.secret.replace(/\s/g, "").toUpperCase(),
          platform: formData.platform,
          issuer: formData.issuer || null,
          accountName: formData.accountName || null,
          notes: formData.notes || null,
          ...(identityId ? {} : { identityProfileId: null }),
        }),
      });

      if (res.ok) {
        const message = identityId
          ? "2FA codes will now be available for this identity."
          : "Standalone authenticator added successfully.";
        await showSuccess("Authenticator Added", message);
        onSuccess();
      } else {
        const data = await res.json();
        await showError("Save Failed", data.error || "Failed to save authenticator");
      }
    } catch (error) {
      console.error("Save error:", error);
      await showError("Network Error", "Failed to connect to server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Add Authenticator</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === "choose" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Choose how to add your authenticator:
              </p>
              <button
                onClick={() => setMode("qr")}
                className="w-full p-4 rounded-lg border border-cyan-700 bg-cyan-950/30 hover:bg-cyan-900/40 transition text-left flex items-center gap-4"
              >
                <span className="text-2xl">📷</span>
                <div>
                  <div className="text-sm font-medium text-slate-100">Scan QR Code</div>
                  <div className="text-xs text-slate-400">
                    Paste or upload a screenshot of the QR code
                  </div>
                </div>
              </button>
              <button
                onClick={() => setMode("manual")}
                className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-700/40 transition text-left flex items-center gap-4"
              >
                <span className="text-2xl">⌨️</span>
                <div>
                  <div className="text-sm font-medium text-slate-100">Enter Manually</div>
                  <div className="text-xs text-slate-400">
                    Type or paste the secret key directly
                  </div>
                </div>
              </button>
            </div>
          )}

          {mode === "qr" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Take a screenshot of the QR code, then paste it here (Cmd/Ctrl+V) or drag & drop:
              </p>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                  dragActive
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />

                {processing ? (
                  <div className="text-slate-400">
                    <div className="text-3xl mb-3 animate-pulse">🔍</div>
                    <div className="text-sm">Processing QR code...</div>
                  </div>
                ) : qrImage ? (
                  <img src={qrImage} alt="QR Code" className="max-h-48 mx-auto rounded" />
                ) : (
                  <div className="text-slate-400">
                    <div className="text-3xl mb-3">📋</div>
                    <div className="text-sm font-medium text-slate-300 mb-1">
                      Paste screenshot or drop image here
                    </div>
                    <div className="text-xs text-slate-500">
                      or click to browse files
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
                <div className="font-medium text-slate-300 mb-1">Quick steps:</div>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Open the 2FA setup page showing the QR code</li>
                  <li>Take a screenshot (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)</li>
                  <li>Come back here and paste (Cmd/Ctrl+V)</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setQrImage(null);
                    setMode("choose");
                  }}
                  className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Google Ads - john@example.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Secret Key *
                </label>
                <input
                  type="text"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="JBSWY3DPEHPK3PXP"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-600"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Base32 secret from your 2FA setup (spaces will be removed)
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Platform
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as AuthenticatorPlatform })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-600"
                >
                  <option value="google">Google (Google Ads, Gmail)</option>
                  <option value="meta">Meta (Facebook, Instagram)</option>
                  <option value="tiktok">TikTok</option>
                  <option value="microsoft">Microsoft (Outlook, Azure)</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-600"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setFormData({ name: "", secret: "", platform: "google", issuer: "", accountName: "", notes: "" });
                    setMode("choose");
                  }}
                  className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.name || !formData.secret}
                  className="flex-1 py-2 rounded-lg bg-cyan-600 text-white text-sm hover:bg-cyan-500 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Authenticator"}
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
// STANDALONE AUTHENTICATOR VIEW
// ============================================================================

type AuthenticatorWithIdentity = AuthenticatorWithCode & {
  identityProfile: {
    id: string;
    fullName: string;
    email: string | null;
  } | null;
};

function AuthenticatorStandaloneView({ onNavigateToIdentity }: { onNavigateToIdentity: (id: string) => void }) {
  const { showSuccess } = useModal();
  const [authenticators, setAuthenticators] = useState<AuthenticatorWithIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchAllAuthenticators();
    // Auto-refresh codes every 10 seconds
    const interval = setInterval(fetchAllAuthenticators, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAllAuthenticators() {
    try {
      // Get all authenticators with identity info
      const res = await fetch("/api/authenticators");
      if (res.ok) {
        const data = await res.json();
        // Now fetch codes for each authenticator
        const withCodes: AuthenticatorWithIdentity[] = [];
        for (const auth of data.authenticators || []) {
          try {
            // Use identity-specific or standalone code endpoint
            const codeUrl = auth.identityProfileId
              ? `/api/identities/${auth.identityProfileId}/authenticators/${auth.id}/code`
              : `/api/authenticators/${auth.id}/code`;
            const codeRes = await fetch(codeUrl);
            if (codeRes.ok) {
              const codeData = await codeRes.json();
              withCodes.push({
                ...auth,
                code: codeData.code,
                remainingSeconds: codeData.remainingSeconds,
              });
            }
          } catch (e) {
            // Skip if code fetch fails
          }
        }
        setAuthenticators(withCodes);
      }
    } catch (error) {
      console.error("Failed to fetch authenticators:", error);
    } finally {
      setLoading(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      await showSuccess("Copied", "Code copied to clipboard");
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  const platformIcons: Record<string, string> = {
    google: "🔵",
    meta: "🔷",
    tiktok: "🎵",
    microsoft: "🟦",
    other: "🔐",
  };

  // Filter authenticators by search
  const filteredAuthenticators = authenticators.filter((auth) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      auth.name.toLowerCase().includes(searchLower) ||
      (auth.identityProfile?.fullName && auth.identityProfile.fullName.toLowerCase().includes(searchLower)) ||
      (auth.identityProfile?.email && auth.identityProfile.email.toLowerCase().includes(searchLower)) ||
      (auth.issuer && auth.issuer.toLowerCase().includes(searchLower))
    );
  });

  // Separate standalone authenticators from identity-linked ones
  const standaloneAuthenticators = filteredAuthenticators.filter((auth) => !auth.identityProfile);
  const linkedAuthenticators = filteredAuthenticators.filter((auth) => auth.identityProfile);

  // Group identity-linked by identity
  const groupedByIdentity = linkedAuthenticators.reduce((acc, auth) => {
    const identityId = auth.identityProfile!.id;
    if (!acc[identityId]) {
      acc[identityId] = {
        identity: auth.identityProfile!,
        authenticators: [],
      };
    }
    acc[identityId].authenticators.push(auth);
    return acc;
  }, {} as Record<string, { identity: { id: string; fullName: string; email: string | null }; authenticators: AuthenticatorWithIdentity[] }>);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-64 bg-slate-800 rounded-lg"></div>
          <div className="h-32 bg-slate-800 rounded-xl"></div>
          <div className="h-32 bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header with Search and Add Button */}
      <div className="mb-6 flex items-center gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, identity, or email..."
          className="flex-1 max-w-md px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-600"
        />
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
      </div>

      {authenticators.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4 opacity-50">🔐</div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">No Authenticators Yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Add your first authenticator using the button above, or add one through an Identity Profile.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition"
          >
            Add Authenticator
          </button>
        </div>
      ) : filteredAuthenticators.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4 opacity-50">🔍</div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">No Results</h3>
          <p className="text-sm text-slate-500">No authenticators match your search.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Standalone Authenticators Section */}
          {standaloneAuthenticators.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              {/* Standalone Header */}
              <div className="px-5 py-3 bg-slate-800/50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-100">Standalone Authenticators</div>
                  <div className="text-xs text-slate-500">Not linked to any identity</div>
                </div>
                <div className="text-xs text-slate-500">
                  {standaloneAuthenticators.length} code{standaloneAuthenticators.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Standalone Authenticators */}
              <div className="divide-y divide-slate-800">
                {standaloneAuthenticators.map((auth) => (
                  <div
                    key={auth.id}
                    className="px-5 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{platformIcons[auth.platform || "other"]}</span>
                      <div>
                        <div className="text-sm font-medium text-slate-200">{auth.name}</div>
                        {auth.issuer && (
                          <div className="text-[10px] text-slate-500">{auth.issuer}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <button
                          onClick={() => copyCode(auth.code)}
                          className="font-mono text-xl font-bold text-cyan-400 hover:text-cyan-300 transition tracking-wider"
                          title="Click to copy"
                        >
                          {auth.code.slice(0, 3)} {auth.code.slice(3)}
                        </button>
                        <div className="text-[10px] text-slate-500">
                          {auth.remainingSeconds}s
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Identity-Linked Authenticators */}
          {Object.values(groupedByIdentity).map(({ identity, authenticators: auths }) => (
            <div
              key={identity.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden"
            >
              {/* Identity Header */}
              <button
                onClick={() => onNavigateToIdentity(identity.id)}
                className="w-full px-5 py-3 flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 transition text-left"
              >
                <div>
                  <div className="text-sm font-medium text-slate-100">{identity.fullName}</div>
                  {identity.email && (
                    <div className="text-xs text-slate-500">{identity.email}</div>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {auths.length} code{auths.length !== 1 ? "s" : ""}
                </div>
              </button>

              {/* Authenticators */}
              <div className="divide-y divide-slate-800">
                {auths.map((auth) => (
                  <div
                    key={auth.id}
                    className="px-5 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{platformIcons[auth.platform || "other"]}</span>
                      <div>
                        <div className="text-sm font-medium text-slate-200">{auth.name}</div>
                        {auth.issuer && (
                          <div className="text-[10px] text-slate-500">{auth.issuer}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <button
                          onClick={() => copyCode(auth.code)}
                          className="font-mono text-xl font-bold text-cyan-400 hover:text-cyan-300 transition tracking-wider"
                          title="Click to copy"
                        >
                          {auth.code.slice(0, 3)} {auth.code.slice(3)}
                        </button>
                        <div className="text-[10px] text-slate-500">
                          {auth.remainingSeconds}s
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Authenticator Modal */}
      {showAddModal && (
        <AddAuthenticatorModal
          identityId={null}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchAllAuthenticators();
          }}
        />
      )}
    </div>
  );
}

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

type SettingsTab = "general" | "google-ads" | "notifications" | "integrations" | "system";

function SettingsView() {
  const { showSuccess, showError } = useModal();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [gologinApiKey, setGologinApiKey] = useState<string>("");
  const [googleAdsApiKey, setGoogleAdsApiKey] = useState<string>("");
  const [googleApiKey, setGoogleApiKey] = useState<string>("");
  const [textverifiedApiKey, setTextverifiedApiKey] = useState<string>("");
  const [telegramBotToken, setTelegramBotToken] = useState<string>("");
  const [telegramChatId, setTelegramChatId] = useState<string>("");
  // Decommission alert settings
  const [decommissionAlertOnAccountDeath, setDecommissionAlertOnAccountDeath] = useState(true);
  const [decommissionAlertOnIdentityArchive, setDecommissionAlertOnIdentityArchive] = useState(true);
  const [decommissionAlertViaApp, setDecommissionAlertViaApp] = useState(true);
  const [decommissionAlertViaTelegram, setDecommissionAlertViaTelegram] = useState(true);
  const [decommissionAlertCustomMessage, setDecommissionAlertCustomMessage] = useState<string>("");
  // Incomplete identity alert settings
  const [incompleteIdentityAlertEnabled, setIncompleteIdentityAlertEnabled] = useState(true);
  const [incompleteIdentityAlertViaApp, setIncompleteIdentityAlertViaApp] = useState(true);
  const [incompleteIdentityAlertViaTelegram, setIncompleteIdentityAlertViaTelegram] = useState(true);
  const [incompleteIdentityAlertOnCreate, setIncompleteIdentityAlertOnCreate] = useState(true);
  const [incompleteIdentityAlertDaily, setIncompleteIdentityAlertDaily] = useState(true);
  // Identity progress alert settings
  const [identityProgressAlertEnabled, setIdentityProgressAlertEnabled] = useState(true);
  const [identityProgressAlertViaApp, setIdentityProgressAlertViaApp] = useState(true);
  const [identityProgressAlertViaTelegram, setIdentityProgressAlertViaTelegram] = useState(true);
  const [identityProgressAlertOnDocAdded, setIdentityProgressAlertOnDocAdded] = useState(true);
  const [identityProgressAlertOnWebsiteAdded, setIdentityProgressAlertOnWebsiteAdded] = useState(true);
  const [identityProgressAlertOnWebsiteCompleted, setIdentityProgressAlertOnWebsiteCompleted] = useState(true);
  const [identityProgressAlertOnGologinCreated, setIdentityProgressAlertOnGologinCreated] = useState(true);
  const [identityProgressAlertOnAccountLinked, setIdentityProgressAlertOnAccountLinked] = useState(true);
  // Identity archived alert settings
  const [identityArchivedAlertEnabled, setIdentityArchivedAlertEnabled] = useState(true);
  const [identityArchivedAlertViaApp, setIdentityArchivedAlertViaApp] = useState(true);
  const [identityArchivedAlertViaTelegram, setIdentityArchivedAlertViaTelegram] = useState(true);
  // Visibility toggles for API keys
  const [showGologinKey, setShowGologinKey] = useState(false);
  const [showGoogleAdsKey, setShowGoogleAdsKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showTextverifiedKey, setShowTextverifiedKey] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  // 1-Click Websites API keys
  const [namecheapApiKey, setNamecheapApiKey] = useState<string>("");
  const [namecheapUsername, setNamecheapUsername] = useState<string>("");
  const [namecheapWhitelistIp, setNamecheapWhitelistIp] = useState<string>("");
  const [namecheapProxyUrl, setNamecheapProxyUrl] = useState<string>("");
  const [digitaloceanApiKey, setDigitaloceanApiKey] = useState<string>("");
  const [showNamecheapKey, setShowNamecheapKey] = useState(false);
  const [showDigitaloceanKey, setShowDigitaloceanKey] = useState(false);
  // MCC Connection state
  const [mccStatus, setMccStatus] = useState<{
    connected: boolean;
    mccCustomerId: string | null;
    connectedEmail: string | null;
    connectedAt: string | null;
    connectedBy: { name: string; email: string } | null;
  } | null>(null);
  const [mccId, setMccId] = useState<string>("");
  const [connectingMcc, setConnectingMcc] = useState(false);
  const [disconnectingMcc, setDisconnectingMcc] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchMccStatus();

    // Listen for MCC connection result from OAuth popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'mcc-connection-result') {
        if (event.data.success) {
          fetchMccStatus();
          showSuccess("MCC Connected", `Successfully connected to MCC ${event.data.mccId}`);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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
        // Decommission alert settings
        setDecommissionAlertOnAccountDeath(data.decommissionAlertOnAccountDeath ?? true);
        setDecommissionAlertOnIdentityArchive(data.decommissionAlertOnIdentityArchive ?? true);
        setDecommissionAlertViaApp(data.decommissionAlertViaApp ?? true);
        setDecommissionAlertViaTelegram(data.decommissionAlertViaTelegram ?? true);
        setDecommissionAlertCustomMessage(data.decommissionAlertCustomMessage || "");
        // Incomplete identity alert settings
        setIncompleteIdentityAlertEnabled(data.incompleteIdentityAlertEnabled ?? true);
        setIncompleteIdentityAlertViaApp(data.incompleteIdentityAlertViaApp ?? true);
        setIncompleteIdentityAlertViaTelegram(data.incompleteIdentityAlertViaTelegram ?? true);
        setIncompleteIdentityAlertOnCreate(data.incompleteIdentityAlertOnCreate ?? true);
        setIncompleteIdentityAlertDaily(data.incompleteIdentityAlertDaily ?? true);
        // Identity progress alert settings
        setIdentityProgressAlertEnabled(data.identityProgressAlertEnabled ?? true);
        setIdentityProgressAlertViaApp(data.identityProgressAlertViaApp ?? true);
        setIdentityProgressAlertViaTelegram(data.identityProgressAlertViaTelegram ?? true);
        setIdentityProgressAlertOnDocAdded(data.identityProgressAlertOnDocAdded ?? true);
        setIdentityProgressAlertOnWebsiteAdded(data.identityProgressAlertOnWebsiteAdded ?? true);
        setIdentityProgressAlertOnWebsiteCompleted(data.identityProgressAlertOnWebsiteCompleted ?? true);
        setIdentityProgressAlertOnGologinCreated(data.identityProgressAlertOnGologinCreated ?? true);
        setIdentityProgressAlertOnAccountLinked(data.identityProgressAlertOnAccountLinked ?? true);
        // Identity archived alert settings
        setIdentityArchivedAlertEnabled(data.identityArchivedAlertEnabled ?? true);
        setIdentityArchivedAlertViaApp(data.identityArchivedAlertViaApp ?? true);
        setIdentityArchivedAlertViaTelegram(data.identityArchivedAlertViaTelegram ?? true);
        // 1-Click Websites API keys
        setNamecheapApiKey(data.namecheapApiKey || "");
        setNamecheapUsername(data.namecheapUsername || "");
        setNamecheapWhitelistIp(data.namecheapWhitelistIp || "");
        setNamecheapProxyUrl(data.namecheapProxyUrl || "");
        setDigitaloceanApiKey(data.digitaloceanApiKey || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMccStatus() {
    try {
      const res = await fetch("/api/settings/mcc");
      if (res.ok) {
        const data = await res.json();
        setMccStatus(data);
        if (data.mccCustomerId) {
          setMccId(formatMccId(data.mccCustomerId));
        }
      }
    } catch (error) {
      console.error("Failed to fetch MCC status:", error);
    }
  }

  function formatMccId(cid: string): string {
    // Format as XXX-XXX-XXXX
    const normalized = cid.replace(/-/g, "");
    if (normalized.length === 10) {
      return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    }
    return cid;
  }

  function handleConnectMcc() {
    if (!mccId.trim()) {
      showError("MCC ID Required", "Please enter your MCC (Manager Account) ID");
      return;
    }

    // Normalize and validate
    const normalized = mccId.replace(/-/g, "");
    if (!/^\d{10}$/.test(normalized)) {
      showError("Invalid MCC ID", "MCC ID should be 10 digits (e.g., 732-568-8009)");
      return;
    }

    setConnectingMcc(true);

    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    window.open(
      `/api/settings/mcc/authorize?mccId=${normalized}`,
      "mcc-oauth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Reset state after a delay (popup will send message on completion)
    setTimeout(() => setConnectingMcc(false), 2000);
  }

  async function handleDisconnectMcc() {
    if (!confirm("Are you sure you want to disconnect the MCC? You won't be able to create new accounts via API until you reconnect.")) {
      return;
    }

    setDisconnectingMcc(true);
    try {
      const res = await fetch("/api/settings/mcc", { method: "DELETE" });
      if (res.ok) {
        setMccStatus({ connected: false, mccCustomerId: null, connectedEmail: null, connectedAt: null, connectedBy: null });
        setMccId("");
        await showSuccess("MCC Disconnected", "MCC has been disconnected.");
      } else {
        const data = await res.json();
        await showError("Disconnect Failed", data.error || "Failed to disconnect MCC");
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      await showError("Network Error", "Network error. Please try again.");
    } finally {
      setDisconnectingMcc(false);
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
          // Decommission alert settings
          decommissionAlertOnAccountDeath,
          decommissionAlertOnIdentityArchive,
          decommissionAlertViaApp,
          decommissionAlertViaTelegram,
          decommissionAlertCustomMessage,
          // Incomplete identity alert settings
          incompleteIdentityAlertEnabled,
          incompleteIdentityAlertViaApp,
          incompleteIdentityAlertViaTelegram,
          incompleteIdentityAlertOnCreate,
          incompleteIdentityAlertDaily,
          // Identity progress alert settings
          identityProgressAlertEnabled,
          identityProgressAlertViaApp,
          identityProgressAlertViaTelegram,
          identityProgressAlertOnDocAdded,
          identityProgressAlertOnWebsiteAdded,
          identityProgressAlertOnWebsiteCompleted,
          identityProgressAlertOnGologinCreated,
          identityProgressAlertOnAccountLinked,
          // Identity archived alert settings
          identityArchivedAlertEnabled,
          identityArchivedAlertViaApp,
          identityArchivedAlertViaTelegram,
          // 1-Click Websites API keys
          namecheapApiKey,
          namecheapUsername,
          namecheapWhitelistIp,
          namecheapProxyUrl,
          digitaloceanApiKey,
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

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "google-ads", label: "Google Ads" },
    { id: "notifications", label: "Notifications" },
    { id: "integrations", label: "Integrations" },
    { id: "system", label: "System" },
  ];

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Configure application settings. Changes will affect new account creation and warmup behavior.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-emerald-400 border-emerald-400"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Google Ads Tab */}
      {activeTab === "google-ads" && (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-sm font-semibold text-slate-100 mb-4">
              Manager Account (MCC) Connection
            </h2>

            {mccStatus?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-sm font-medium">Connected</span>
                </div>

                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">MCC ID:</span>
                    <span className="text-slate-100 font-mono">{formatMccId(mccStatus.mccCustomerId || "")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Connected as:</span>
                    <span className="text-slate-100">{mccStatus.connectedEmail}</span>
                  </div>
                  {mccStatus.connectedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Connected on:</span>
                      <span className="text-slate-100">{new Date(mccStatus.connectedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {mccStatus.connectedBy && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Connected by:</span>
                      <span className="text-slate-100">{mccStatus.connectedBy.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleConnectMcc}
                    disabled={connectingMcc}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    {connectingMcc ? "Connecting..." : "Reconnect"}
                  </button>
                  <button
                    onClick={handleDisconnectMcc}
                    disabled={disconnectingMcc}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                  >
                    {disconnectingMcc ? "Disconnecting..." : "Disconnect"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-sm font-medium">Not Connected</span>
                </div>

                <p className="text-sm text-slate-400">
                  Connect your Google Ads Manager Account (MCC) to enable account creation and full API access.
                </p>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    MCC Customer ID
                  </label>
                  <input
                    type="text"
                    value={mccId}
                    onChange={(e) => setMccId(e.target.value)}
                    placeholder="732-568-8009"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-slate-500">
                    Find this in your Google Ads Manager Account header (format: XXX-XXX-XXXX)
                  </p>
                </div>

                <button
                  onClick={handleConnectMcc}
                  disabled={connectingMcc || !mccId.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                  </svg>
                  {connectingMcc ? "Connecting..." : "Connect MCC"}
                </button>
              </div>
            )}
          </div>

          {/* MCC Benefits Info */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              What MCC Connection Enables
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>Create new ad accounts under your MCC via API</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>Pause/enable campaigns, ads, and keywords</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>Apply Google Ads recommendations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>Full campaign management via API</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* General Tab */}
      {activeTab === "general" && (
      <div className="max-w-2xl space-y-6">
        {/* Bookmarklet */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">
            Connect to MagiManager Bookmarklet
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Drag this button to your bookmarks bar. When on any Google Ads page, click it to connect that account to MagiManager via OAuth.
          </p>

          <div className="flex items-center gap-4">
            <a
              href={"javascript:(function(){var cid=location.href.match(/\\/(\\d{3}-\\d{3}-\\d{4})\\//)?.[1]||document.querySelector('[data-customer-id]')?.dataset.customerId;if(cid){var w=600,h=700,l=(screen.width-w)/2,t=(screen.height-h)/2;window.open('https://abra.magimanager.com/api/oauth/google-ads/authorize?cid='+cid.replace(/-/g,''),'oauth','width='+w+',height='+h+',left='+l+',top='+t);}else{alert('Could not detect CID. Make sure you are on a Google Ads account page.');}})();"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm cursor-move hover:bg-emerald-400 transition"
              onClick={(e) => {
                e.preventDefault();
                alert("Drag this button to your bookmarks bar to install it. Don't click it here!");
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

        {settings && (
          <p className="text-xs text-slate-500">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
      <form
        onSubmit={handleSave}
        className="max-w-2xl space-y-6"
      >
        {/* Telegram Bot Settings */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Telegram Bot Configuration
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

        {/* Decommission Alerts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Decommission Alerts
            </h2>
            <div className="group relative">
              <span className="text-slate-400 cursor-help text-sm">ⓘ</span>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-lg text-xs text-slate-300 z-10">
                <p className="font-medium text-slate-100 mb-2">When are alerts sent?</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>When an identity&apos;s last active account is archived, deleted, or banned</li>
                  <li>When an identity is archived directly</li>
                </ul>
                <p className="mt-2 text-slate-400">
                  Alerts include the identity name and website (if available) so you can decommission external servers/websites.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Triggers
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={decommissionAlertOnAccountDeath}
                    onChange={(e) => setDecommissionAlertOnAccountDeath(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Account archived/deleted/banned</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={decommissionAlertOnIdentityArchive}
                    onChange={(e) => setDecommissionAlertOnIdentityArchive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Identity archived</span>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Alert fires when identity has no remaining active accounts
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Notify via
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={decommissionAlertViaApp}
                    onChange={(e) => setDecommissionAlertViaApp(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">In-app notification</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={decommissionAlertViaTelegram}
                    onChange={(e) => setDecommissionAlertViaTelegram(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Telegram bot</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Custom Message (Optional)
              </label>
              <textarea
                value={decommissionAlertCustomMessage}
                onChange={(e) => setDecommissionAlertCustomMessage(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                placeholder="e.g., Remember to cancel the hosting subscription!"
              />
              <p className="text-xs text-slate-500">
                This message will be appended to all decommission alerts
              </p>
            </div>
          </div>
        </div>

        {/* Incomplete Identity Alerts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Incomplete Identity Alerts
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Get notified when identity profiles are missing documents, website, or GoLogin profile
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-400">Enabled</span>
              <input
                type="checkbox"
                checked={incompleteIdentityAlertEnabled}
                onChange={(e) => setIncompleteIdentityAlertEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
            </label>
          </div>

          <div className={`space-y-4 ${!incompleteIdentityAlertEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Triggers
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incompleteIdentityAlertOnCreate}
                    onChange={(e) => setIncompleteIdentityAlertOnCreate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">When identity is first created</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incompleteIdentityAlertDaily}
                    onChange={(e) => setIncompleteIdentityAlertDaily(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Daily reminder until complete</span>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Missing items: Documents, Website, GoLogin Profile
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Notify via
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incompleteIdentityAlertViaApp}
                    onChange={(e) => setIncompleteIdentityAlertViaApp(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">In-app notification</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incompleteIdentityAlertViaTelegram}
                    onChange={(e) => setIncompleteIdentityAlertViaTelegram(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Telegram bot</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Identity Progress Alerts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Identity Progress Alerts
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Get notified when items are added to identity profiles
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-400">Enabled</span>
              <input
                type="checkbox"
                checked={identityProgressAlertEnabled}
                onChange={(e) => setIdentityProgressAlertEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
            </label>
          </div>

          <div className={`space-y-4 ${!identityProgressAlertEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Triggers
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={identityProgressAlertOnDocAdded}
                    onChange={(e) => setIdentityProgressAlertOnDocAdded(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Document uploaded</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={identityProgressAlertOnWebsiteAdded}
                    onChange={(e) => setIdentityProgressAlertOnWebsiteAdded(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Website added</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={identityProgressAlertOnWebsiteCompleted}
                    onChange={(e) => setIdentityProgressAlertOnWebsiteCompleted(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Website marked completed</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={identityProgressAlertOnGologinCreated}
                    onChange={(e) => setIdentityProgressAlertOnGologinCreated(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">GoLogin profile created</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={identityProgressAlertOnAccountLinked}
                    onChange={(e) => setIdentityProgressAlertOnAccountLinked(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Ad account linked</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                Notify via
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={identityProgressAlertViaApp}
                    onChange={(e) => setIdentityProgressAlertViaApp(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">In-app notification</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={identityProgressAlertViaTelegram}
                    onChange={(e) => setIdentityProgressAlertViaTelegram(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Telegram bot</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Identity Archived Alerts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Identity Archived Alerts</h3>
              <p className="text-xs text-slate-400 mt-0.5">Get notified when identity profiles are archived</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={identityArchivedAlertEnabled}
                onChange={(e) => setIdentityArchivedAlertEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-300">Enabled</span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
              Notify via
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={identityArchivedAlertViaApp}
                  onChange={(e) => setIdentityArchivedAlertViaApp(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-200">In-app notification</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={identityArchivedAlertViaTelegram}
                  onChange={(e) => setIdentityArchivedAlertViaTelegram(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-200">Telegram bot</span>
              </label>
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
      )}

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
      <div className="max-w-2xl rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold text-slate-100 mb-4">
          API Keys
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Configure API keys for third-party integrations.
        </p>

        <form onSubmit={handleSave} className="space-y-8">
            {/* GoLogin Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-200">GoLogin</h3>
              <p className="text-xs text-slate-500">
                API key for browser profile management. Get your key from{" "}
                <a href="https://app.gologin.com/personalArea/TokenApi" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                  GoLogin API Settings
                </a>
              </p>
              <div className="relative">
                <input
                  type={showGologinKey ? "text" : "password"}
                  value={gologinApiKey}
                  onChange={(e) => setGologinApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-16 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Enter GoLogin API key"
                />
                <button
                  type="button"
                  onClick={() => setShowGologinKey(!showGologinKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                >
                  {showGologinKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* TextVerified Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-200">TextVerified</h3>
              <p className="text-xs text-slate-500">
                API key for phone verification (non-VoIP numbers for Google Ads). Get your key from{" "}
                <a href="https://www.textverified.com/account/api" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                  TextVerified API Settings
                </a>
              </p>
              <div className="relative">
                <input
                  type={showTextverifiedKey ? "text" : "password"}
                  value={textverifiedApiKey}
                  onChange={(e) => setTextverifiedApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-16 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Enter TextVerified API key"
                />
                <button
                  type="button"
                  onClick={() => setShowTextverifiedKey(!showTextverifiedKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                >
                  {showTextverifiedKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Namecheap Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-200">Namecheap</h3>
              <p className="text-xs text-slate-500">
                API credentials for domain search and purchase (1-Click Websites). Get your API key from{" "}
                <a href="https://ap.www.namecheap.com/settings/tools/apiaccess" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                  Namecheap API Access
                </a>
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={namecheapUsername}
                  onChange={(e) => setNamecheapUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Your Namecheap username"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showNamecheapKey ? "text" : "password"}
                    value={namecheapApiKey}
                    onChange={(e) => setNamecheapApiKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-16 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Enter Namecheap API key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNamecheapKey(!showNamecheapKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    {showNamecheapKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Whitelisted IP Address
                </label>
                <input
                  type="text"
                  value={namecheapWhitelistIp}
                  onChange={(e) => setNamecheapWhitelistIp(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="e.g., 143.198.160.212"
                />
                <p className="text-xs text-slate-500 mt-1">
                  The IP address whitelisted in your Namecheap API settings. Use the proxy server IP for reliable access.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Proxy Server URL (Optional)
                </label>
                <input
                  type="text"
                  value={namecheapProxyUrl}
                  onChange={(e) => setNamecheapProxyUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="e.g., http://143.198.160.212:3000/proxy"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Proxy server with static IP to route Namecheap API requests. Required because Vercel uses dynamic IPs.
                </p>
                <div className="mt-2 p-2 rounded bg-slate-950 border border-slate-700">
                  <p className="text-xs text-emerald-400">
                    Proxy Server: <span className="font-mono">http://147.182.219.69:3000</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Whitelist IP <span className="font-mono text-slate-400">147.182.219.69</span> in Namecheap, then enter <span className="font-mono text-slate-400">http://147.182.219.69:3000</span> above.
                  </p>
                </div>
              </div>
            </div>

            {/* DigitalOcean Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-200">DigitalOcean</h3>
              <p className="text-xs text-slate-500">
                API token for creating and managing droplets (1-Click Websites). Get your token from{" "}
                <a href="https://cloud.digitalocean.com/account/api/tokens" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                  DigitalOcean API Tokens
                </a>
              </p>
              <div className="relative">
                <input
                  type={showDigitaloceanKey ? "text" : "password"}
                  value={digitaloceanApiKey}
                  onChange={(e) => setDigitaloceanApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-16 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Enter DigitalOcean API token"
                />
                <button
                  type="button"
                  onClick={() => setShowDigitaloceanKey(!showDigitaloceanKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                >
                  {showDigitaloceanKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? "Saving..." : "Save API Keys"}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* System Tab - Renders the existing SystemView component */}
      {activeTab === "system" && (
        <SystemView />
      )}
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
  const [showArchived, setShowArchived] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAccounts();
  }, [showArchived]);

  async function fetchMyAccounts() {
    setLoading(true);
    try {
      // Use dedicated my-accounts endpoint with server-side role-based filtering
      const url = showArchived
        ? "/api/accounts/my-accounts?includeArchived=true"
        : "/api/accounts/my-accounts";
      const res = await fetch(url);
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

  // Get selected account for detail modal
  const selectedAccount = selectedAccountId ? accounts.find(a => a.id === selectedAccountId) : null;

  if (loading) {
    return <SkeletonAccountsTable />;
  }

  if (accounts.length === 0 && !showArchived) {
    return (
      <div className="space-y-4">
        {/* Show Archived Toggle */}
        <div className="flex justify-end">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/20"
            />
            Show Archived
          </label>
        </div>
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">You don't have any accounts assigned yet.</p>
          <p className="text-sm text-slate-500">Request an account from the Requests page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Show Archived Toggle */}
      <div className="flex justify-end mb-4">
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/20"
          />
          Show Archived
        </label>
      </div>

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
              <tr
                key={account.id}
                className={`border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition ${
                  account.handoffStatus === "archived" ? "opacity-50" : ""
                }`}
                onClick={() => setSelectedAccountId(account.id)}
              >
                <td className="py-4 text-slate-200">{account.identityProfile?.fullName || "Unassigned"}</td>
                <td className="py-4 text-slate-300">{formatCid(account.googleCid) || "—"}</td>
                <td className="py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    account.handoffStatus === "archived" ? "bg-slate-600/20 text-slate-400" :
                    account.status === "active" ? "bg-emerald-500/20 text-emerald-300" :
                    account.status === "warming" ? "bg-amber-500/20 text-amber-300" :
                    account.status === "provisioned" ? "bg-blue-500/20 text-blue-300" :
                    "bg-slate-500/20 text-slate-300"
                  }`}>
                    {account.handoffStatus === "archived" ? "archived" : account.status}
                  </span>
                </td>
                <td className="py-4 text-slate-300">${(account.currentSpendTotal / 100).toFixed(2)}</td>
                <td className="py-4 text-slate-300">{account.adsCount}</td>
                <td className="py-4 text-slate-400 text-xs">
                  {account.handoffDate ? formatDateForDisplay(account.handoffDate) : "—"}
                </td>
                <td className="py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openThreadModal(account);
                    }}
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

      {/* Account Detail Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  selectedAccount.accountHealth === "active" ? "bg-emerald-400" :
                  selectedAccount.accountHealth === "suspended" ? "bg-red-400" :
                  "bg-slate-400"
                }`} />
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    MM{String(selectedAccount.internalId).padStart(3, "0")}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {selectedAccount.identityProfile?.fullName || "No Identity"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccountId(null)}
                className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Spend</p>
                  <p className="text-xl font-semibold text-slate-100">
                    ${(selectedAccount.currentSpendTotal / 100).toFixed(2)}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ads</p>
                  <p className="text-xl font-semibold text-slate-100">{selectedAccount.adsCount}</p>
                </div>
              </div>

              {/* Account Details */}
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-sm text-slate-400">Google CID</span>
                  <span className="text-sm text-slate-200 font-mono">{formatCid(selectedAccount.googleCid) || "—"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-sm text-slate-400">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    selectedAccount.status === "ready" ? "bg-emerald-500/20 text-emerald-300" :
                    selectedAccount.status === "warming-up" ? "bg-amber-500/20 text-amber-300" :
                    selectedAccount.status === "provisioned" ? "bg-blue-500/20 text-blue-300" :
                    selectedAccount.status === "handed-off" ? "bg-violet-500/20 text-violet-300" :
                    "bg-slate-500/20 text-slate-300"
                  }`}>
                    {selectedAccount.status}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-sm text-slate-400">Health</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    selectedAccount.accountHealth === "active" ? "bg-emerald-500/20 text-emerald-300" :
                    selectedAccount.accountHealth === "suspended" ? "bg-red-500/20 text-red-300" :
                    selectedAccount.accountHealth === "limited" ? "bg-amber-500/20 text-amber-300" :
                    "bg-slate-500/20 text-slate-300"
                  }`}>
                    {selectedAccount.accountHealth}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-sm text-slate-400">Handoff Status</span>
                  <span className="text-sm text-slate-200">{selectedAccount.handoffStatus}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-sm text-slate-400">Handoff Date</span>
                  <span className="text-sm text-slate-200">
                    {selectedAccount.handoffDate ? formatDateForDisplay(selectedAccount.handoffDate) : "—"}
                  </span>
                </div>
                {selectedAccount.identityProfile && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-800">
                    <span className="text-sm text-slate-400">Identity Geo</span>
                    <span className="text-sm text-slate-200">{selectedAccount.identityProfile.geo}</span>
                  </div>
                )}
                {selectedAccount.handoffNotes && (
                  <div className="py-2">
                    <span className="text-sm text-slate-400 block mb-2">Handoff Notes</span>
                    <p className="text-sm text-slate-200 bg-slate-800/50 rounded-lg p-3">
                      {selectedAccount.handoffNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setSelectedAccountId(null);
                  openThreadModal(selectedAccount);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition"
              >
                💬 Thread
              </button>
              <button
                onClick={() => setSelectedAccountId(null)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
// TUTORIAL VIEW
// ============================================================================

type TutorialSection =
  | "overview"
  | "gologin-setup"
  | "id-profiles-intro"
  | "create-id-profile"
  | "upload-docs"
  | "add-website"
  | "create-gologin-profile"
  | "ad-accounts-intro"
  | "create-ad-account"
  | "link-id-to-account"
  | "oauth-connection";

// Screenshot component - displays actual images from /tutorial folder
function ScreenshotPlaceholder({ name, description }: { name: string; description: string }) {
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-700">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/tutorial/${name}`}
        alt={description}
        className="w-full h-auto"
        loading="lazy"
      />
    </div>
  );
}

function TutorialView() {
  const [activeSection, setActiveSection] = useState<TutorialSection>("overview");

  const sections: { id: TutorialSection; title: string; icon: string; step?: number }[] = [
    { id: "overview", title: "Getting Started", icon: "🚀" },
    { id: "gologin-setup", title: "Set Up GoLogin", icon: "💻", step: 1 },
    { id: "id-profiles-intro", title: "What are ID Profiles?", icon: "👤", step: 2 },
    { id: "create-id-profile", title: "Create an ID Profile", icon: "➕", step: 3 },
    { id: "upload-docs", title: "Upload Documents", icon: "📄", step: 4 },
    { id: "add-website", title: "Add a Website", icon: "🌍", step: 5 },
    { id: "create-gologin-profile", title: "Create GoLogin Profile", icon: "🌐", step: 6 },
    { id: "ad-accounts-intro", title: "What are Ad Accounts?", icon: "💳", step: 7 },
    { id: "create-ad-account", title: "Create Ad Account Profile", icon: "➕", step: 8 },
    { id: "oauth-connection", title: "Connect via OAuth", icon: "🔐", step: 9 },
  ];

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar Navigation */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Pipeline Steps
          </h3>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition ${
                  activeSection === section.id
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {section.step ? (
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    activeSection === section.id
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-700 text-slate-300"
                  }`}>
                    {section.step}
                  </span>
                ) : (
                  <span className="text-base">{section.icon}</span>
                )}
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8">
          {activeSection === "overview" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">🚀</span>
                Getting Started with MagiManager
              </h2>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Welcome to <span className="text-emerald-400 font-semibold">MagiManager - Account Management Console</span>!
                This tutorial will guide you through setting up and managing your Google Ads accounts with unique identities.
                Follow these steps in order to properly configure everything.
              </p>

              <ScreenshotPlaceholder
                name="screenshot-overview-dashboard.png"
                description="Magimanager Dashboard Overview"
              />

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Before You Begin</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <p className="text-slate-300">You&apos;ll need a <span className="text-emerald-400 font-semibold">GoLogin account</span> with an active subscription</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <p className="text-slate-300">Download and install the <span className="text-emerald-400 font-semibold">GoLogin Desktop</span> application</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <p className="text-slate-300">Have your ID profile documents ready (driver&apos;s license, SSN card, etc.)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <p className="text-slate-300">Access to <span className="text-emerald-400 font-semibold">Google Ads accounts</span> you want to manage</p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-slate-200 mb-3">Magimanager Workflow</h3>
              <p className="text-slate-400 text-sm mb-4">
                Magimanager helps you organize and manage multiple Google Ads accounts with unique identities.
                Here&apos;s the typical workflow:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                  <div className="text-2xl mb-2">1️⃣</div>
                  <h4 className="font-semibold text-slate-200 mb-1">Set Up GoLogin</h4>
                  <p className="text-sm text-slate-400">Install GoLogin and log in to your account</p>
                </div>
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                  <div className="text-2xl mb-2">2️⃣</div>
                  <h4 className="font-semibold text-slate-200 mb-1">Create ID Profiles</h4>
                  <p className="text-sm text-slate-400">Set up identity profiles with credentials and documents</p>
                </div>
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                  <div className="text-2xl mb-2">3️⃣</div>
                  <h4 className="font-semibold text-slate-200 mb-1">Connect Everything</h4>
                  <p className="text-sm text-slate-400">Link profiles to Ad Accounts via OAuth</p>
                </div>
              </div>

              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
                <h4 className="text-indigo-300 font-semibold mb-2">Why Use This System?</h4>
                <ul className="text-indigo-200/80 text-sm space-y-1">
                  <li>• Centralize management of multiple ad accounts and identities</li>
                  <li>• Track account status, spend, and health in one place</li>
                  <li>• Maintain browser fingerprint separation with GoLogin integration</li>
                  <li>• Store and organize identity documents securely</li>
                  <li>• Coordinate team access and account assignments</li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === "gologin-setup" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">💻</span>
                Setting Up GoLogin Desktop
              </h2>
              <p className="text-slate-300 mb-6 leading-relaxed">
                GoLogin is essential for maintaining separate browser fingerprints for each identity.
                Before creating profiles in Magimanager, you need to set up the GoLogin desktop application.
              </p>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
                <p className="text-amber-300 flex items-start gap-2">
                  <span className="text-xl">💡</span>
                  <span>You&apos;ll need an active GoLogin subscription to use all features. Visit <span className="font-mono">gologin.com</span> to sign up if you haven&apos;t already.</span>
                </p>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Download GoLogin
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Go to <span className="text-emerald-400 font-mono">gologin.com</span> and download the desktop application for your operating system (Windows or Mac).
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-gologin-download-page.png"
                    description="GoLogin website download page"
                  />
                  <div className="bg-slate-900 rounded-lg p-4 border border-slate-600">
                    <p className="text-sm text-slate-400">
                      <span className="text-amber-400">Note:</span> Make sure to download the official version from gologin.com
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Install the Application
                  </h3>
                  <p className="text-slate-300">
                    Run the installer and follow the on-screen instructions to complete the installation.
                  </p>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Sign In to GoLogin
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Open the GoLogin desktop app and sign in with your GoLogin account.
                    You can use email/password or sign in with Google.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-gologin-signin-button.png"
                    description="GoLogin app sign in screen"
                  />
                  <div className="bg-slate-900 rounded-lg p-4 border border-slate-600 mt-3">
                    <p className="text-sm text-slate-400">
                      <span className="text-emerald-400">Tip:</span> If your team shares a GoLogin account, make sure you&apos;re signed into the correct account that has access to your organization&apos;s profiles.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    View Your Profiles
                  </h3>
                  <p className="text-slate-300">
                    Once logged in, you&apos;ll see the GoLogin dashboard with all your browser profiles.
                    These profiles maintain separate browser fingerprints and sessions for each identity.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-gologin-profiles-list.png"
                    description="GoLogin main dashboard showing browser profiles"
                  />
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <h4 className="text-emerald-300 font-semibold mb-2">What&apos;s Next?</h4>
                  <p className="text-emerald-200/80 text-sm">
                    With GoLogin set up, you can now create ID Profiles in Magimanager and generate corresponding
                    GoLogin browser profiles for each identity. Continue to the next section to learn about ID Profiles.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "id-profiles-intro" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">👤</span>
                What are ID Profiles?
              </h2>

              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-6 mb-6">
                <p className="text-slate-200 text-lg leading-relaxed">
                  An <span className="text-indigo-400 font-semibold">ID Profile</span> represents a unique identity used to manage Google Ads accounts.
                  Each ID Profile contains personal information, credentials, and documents needed to verify and operate ad accounts.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-slate-200 mb-4">What&apos;s Included in an ID Profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span>📋</span> Personal Information
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Full legal name</li>
                    <li>• Date of birth</li>
                    <li>• Address (street, city, state, zip)</li>
                    <li>• Geographic location (GEO)</li>
                  </ul>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span>🔐</span> Credentials
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Email address</li>
                    <li>• Email password</li>
                    <li>• Phone number</li>
                    <li>• 2FA secret & backup codes</li>
                  </ul>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span>💳</span> Billing Information
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Credit card number</li>
                    <li>• Expiration date</li>
                    <li>• CVV</li>
                    <li>• Billing zip code</li>
                  </ul>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span>📄</span> Documents
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Driver&apos;s license</li>
                    <li>• SSN card</li>
                    <li>• Utility bills</li>
                    <li>• Other verification docs</li>
                  </ul>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <h4 className="text-emerald-300 font-semibold mb-2">What&apos;s Next?</h4>
                <p className="text-emerald-200/80 text-sm">
                  Now that you understand what ID Profiles are, the next step is to create one.
                  Continue to Step 3 to learn how to create your first ID Profile.
                </p>
              </div>
            </div>
          )}

          {activeSection === "create-id-profile" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">➕</span>
                Create an ID Profile
              </h2>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Follow these steps to create a new ID Profile in Magimanager.
              </p>

              <ScreenshotPlaceholder
                name="screenshot-id-profiles-list.png"
                description="ID Profiles list page in Magimanager"
              />

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 my-6">
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                    <div>
                      <p className="text-slate-200">Navigate to <a href="/admin/identities" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-semibold hover:underline">ID Profiles</a> in the sidebar</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                    <div>
                      <p className="text-slate-200">Click the <span className="text-emerald-400 font-semibold">+ New ID Profile</span> button</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                    <div>
                      <p className="text-slate-200">Fill in all required personal information fields</p>
                      <ul className="text-sm text-slate-400 mt-2 space-y-1 ml-4">
                        <li>• Full name</li>
                        <li>• Date of birth</li>
                        <li>• Address (street, city, state, zip)</li>
                        <li>• GEO location</li>
                      </ul>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                    <div>
                      <p className="text-slate-200">Add credentials</p>
                      <ul className="text-sm text-slate-400 mt-2 space-y-1 ml-4">
                        <li>• Email address</li>
                        <li>• Email password</li>
                        <li>• Phone number</li>
                        <li>• 2FA secret (optional)</li>
                      </ul>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                    <div>
                      <p className="text-slate-200">Add billing information (if available)</p>
                      <ul className="text-sm text-slate-400 mt-2 space-y-1 ml-4">
                        <li>• Credit card number</li>
                        <li>• Expiration date</li>
                        <li>• CVV</li>
                      </ul>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">6</span>
                    <div>
                      <p className="text-slate-200">Click <span className="text-emerald-400 font-semibold">Create ID Profile</span> to save</p>
                    </div>
                  </li>
                </ol>
              </div>

              <ScreenshotPlaceholder
                name="screenshot-create-id-profile-form.png"
                description="Create New ID Profile form"
              />

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mt-6">
                <h4 className="text-emerald-300 font-semibold mb-2">What&apos;s Next?</h4>
                <p className="text-emerald-200/80 text-sm">
                  After creating your ID Profile, the next step is to upload verification documents.
                  Continue to Step 4 to learn how to upload documents.
                </p>
              </div>
            </div>
          )}

          {activeSection === "ad-accounts-intro" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">💳</span>
                What are Ad Account Profiles?
              </h2>

              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-6 mb-6">
                <p className="text-slate-200 text-lg leading-relaxed">
                  An <span className="text-emerald-400 font-semibold">Ad Account Profile</span> represents a Google Ads account
                  in the Magimanager system. It tracks the account&apos;s status, spend, health, and connection to an ID Profile.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-slate-200 mb-4">Ad Account Profile Properties</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span>🔢</span> Account Identifiers
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Internal ID (auto-generated)</li>
                    <li>• Google CID (Customer ID)</li>
                    <li>• Origin (where account came from)</li>
                  </ul>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span>📊</span> Status Tracking
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Account status (Active, Suspended, etc.)</li>
                    <li>• Health status</li>
                    <li>• Billing status</li>
                    <li>• Certification status</li>
                  </ul>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span>💰</span> Spend Tracking
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Current total spend</li>
                    <li>• Warmup target spend</li>
                    <li>• Number of active ads</li>
                  </ul>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <span>👥</span> Connections
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Linked ID Profile</li>
                    <li>• Assigned Media Buyer</li>
                    <li>• Handoff status and notes</li>
                  </ul>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <h4 className="text-emerald-300 font-semibold mb-2">What&apos;s Next?</h4>
                <p className="text-emerald-200/80 text-sm">
                  Now that you understand what Ad Account Profiles are, the next step is to create one.
                  Continue to Step 8 to learn how to create an Ad Account Profile.
                </p>
              </div>
            </div>
          )}

          {activeSection === "create-ad-account" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">➕</span>
                Create an Ad Account Profile
              </h2>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Follow these steps to create a new Ad Account Profile in Magimanager.
              </p>

              <ScreenshotPlaceholder
                name="screenshot-account-profiles-list.png"
                description="Account Profiles list page in Magimanager"
              />

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 my-6">
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                    <div>
                      <p className="text-slate-200">Navigate to <a href="/admin/accounts" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-semibold hover:underline">Account Profiles</a> in the sidebar</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                    <div>
                      <p className="text-slate-200">Click the <span className="text-emerald-400 font-semibold">+ New Account</span> button</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                    <div>
                      <p className="text-slate-200">Select the origin (how you obtained the account)</p>
                      <ul className="text-sm text-slate-400 mt-2 space-y-1 ml-4">
                        <li>• <span className="text-white">Created</span> - You created this account fresh</li>
                        <li>• <span className="text-white">Purchased</span> - You bought this account</li>
                        <li>• <span className="text-white">Other</span> - Some other source</li>
                      </ul>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                    <div>
                      <p className="text-slate-200">Link to an ID Profile</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Select the ID Profile that will &quot;own&quot; this ad account. This is recommended for proper account management.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                    <div>
                      <p className="text-slate-200">Add any relevant notes</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Notes help you track important information about the account.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">6</span>
                    <div>
                      <p className="text-slate-200">Click <span className="text-emerald-400 font-semibold">Create</span> to save</p>
                    </div>
                  </li>
                </ol>
              </div>

              <ScreenshotPlaceholder
                name="screenshot-create-ad-account-form.png"
                description="Create New Ad Account form"
              />

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mt-6">
                <h4 className="text-emerald-300 font-semibold mb-2">What&apos;s Next?</h4>
                <p className="text-emerald-200/80 text-sm">
                  After creating your Ad Account Profile, the next step is to connect it via OAuth.
                  Continue to Step 9 to learn how to set up the OAuth connection.
                </p>
              </div>
            </div>
          )}

          {activeSection === "create-gologin-profile" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">🌐</span>
                How to Create GoLogin Profiles for ID Profiles
              </h2>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Each ID Profile needs its own GoLogin browser profile. This creates a unique browser fingerprint
                that maintains session separation between different identities.
              </p>

              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 mb-6">
                <p className="text-indigo-300 flex items-start gap-2">
                  <span className="text-xl">💡</span>
                  <span>GoLogin profiles are created directly from Magimanager using the GoLogin API integration.</span>
                </p>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Navigate to the ID Profile
                  </h3>
                  <p className="text-slate-300">
                    Go to <a href="/admin/identities" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-semibold hover:underline">ID Profiles</a> and click on the profile
                    you want to create a GoLogin profile for.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-id-profile-detail-view.png"
                    description="ID Profile detail view page"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Find the GoLogin Section
                  </h3>
                  <p className="text-slate-300">
                    In the ID Profile detail view, scroll down to find the <span className="text-white font-semibold">&quot;GoLogin Profile&quot;</span> section.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-id-profile-gologin-section.png"
                    description="GoLogin Profile section in ID Profile detail"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Create GoLogin Profile
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Click the <span className="text-emerald-400 font-semibold">Create GoLogin Profile</span> button.
                    The system will:
                  </p>
                  <ul className="text-slate-400 text-sm space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Generate a unique browser fingerprint</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Configure proxy settings based on the ID Profile&apos;s GEO</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Create the profile in your GoLogin account</span>
                    </li>
                  </ul>
                  <ScreenshotPlaceholder
                    name="screenshot-create-gologin-button.png"
                    description="Create GoLogin Profile button"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    Verify in GoLogin Desktop
                  </h3>
                  <p className="text-slate-300">
                    Open your GoLogin desktop app. You should see the new profile appear in your profile list.
                    The profile name will match the ID Profile name from Magimanager.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-gologin-new-profile-created.png"
                    description="GoLogin desktop showing newly created profile"
                  />
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <p className="text-emerald-300 flex items-start gap-2">
                    <span className="text-xl">✅</span>
                    <span>Once created, you can launch this browser profile from GoLogin to perform actions as that identity.</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "oauth-connection" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">🔐</span>
                How to Connect Ad Profiles to Google Ads via OAuth
              </h2>

              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <p className="text-red-300 flex items-start gap-2">
                  <span className="text-xl">🚨</span>
                  <span className="font-semibold">IMPORTANT: You must be inside the GoLogin profile you created for this Ad Profile before connecting via OAuth!</span>
                </p>
              </div>

              <p className="text-slate-300 mb-6 leading-relaxed">
                Connecting via OAuth allows Magimanager to access and manage the Google Ads account on your behalf.
                This is done from within the GoLogin browser profile to maintain session consistency.
              </p>

              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-6 mb-6">
                <h4 className="text-indigo-300 font-semibold mb-3 flex items-center gap-2">
                  <span>✨</span> Why OAuth Connection Matters
                </h4>
                <p className="text-slate-300 mb-3">
                  Once connected via OAuth, Magimanager can pull <span className="text-white font-semibold">real-time data</span> directly from your live Google Ads accounts:
                </p>
                <ul className="text-indigo-200/80 text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span><span className="text-white font-medium">Live spend reports</span> - Track actual ad spend across all connected accounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span><span className="text-white font-medium">Performance metrics</span> - Impressions, clicks, conversions, and more</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span><span className="text-white font-medium">Account health status</span> - Policy violations, suspensions, and billing issues</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span><span className="text-white font-medium">Campaign management</span> - Create, edit, and monitor campaigns from one dashboard</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Open GoLogin Desktop
                  </h3>
                  <p className="text-slate-300">
                    Launch the GoLogin desktop application and find the profile associated with
                    the Ad Account you want to connect.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-oauth-gologin-find-profile.png"
                    description="GoLogin desktop - find the profile for this account"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Run the Browser Profile
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Click <span className="text-white font-semibold">&quot;Run&quot;</span> to launch the browser with the identity&apos;s unique fingerprint.
                    Wait for the browser to fully open.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-oauth-gologin-start-button.png"
                    description="GoLogin Start button for profile"
                  />
                  <div className="bg-slate-900 rounded-lg p-4 border border-amber-500/30">
                    <p className="text-sm text-amber-300">
                      <span className="font-semibold">Note:</span> Make sure the proxy is connected and working before proceeding.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Navigate to Magimanager
                  </h3>
                  <p className="text-slate-300">
                    Inside the GoLogin browser, go to <span className="text-emerald-400 font-mono">magimanager.com</span> and log in to your account.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-oauth-magimanager-login-gologin.png"
                    description="Magimanager login page inside GoLogin browser"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    Find the Ad Account
                  </h3>
                  <p className="text-slate-300">
                    Go to <a href="/admin/accounts" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-semibold hover:underline">Account Profiles</a> and locate the
                    Ad Account you want to connect. Click on it to open the details.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-oauth-select-ad-account.png"
                    description="Account Profiles page - select the account to connect"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                    Initiate OAuth Connection
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Click the <span className="text-emerald-400 font-semibold">Connect Google Ads</span> button.
                    This will redirect you to Google&apos;s OAuth authorization page.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-oauth-connect-button.png"
                    description="Connect Google Ads button in account details"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">6</span>
                    Authorize Access
                  </h3>
                  <p className="text-slate-300 mb-3">
                    On Google&apos;s page:
                  </p>
                  <ul className="text-slate-400 text-sm space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Select the Google account that owns the Ads account</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Review the permissions requested</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Click <span className="text-white font-semibold">&quot;Allow&quot;</span> to grant access</span>
                    </li>
                  </ul>
                  <ScreenshotPlaceholder
                    name="screenshot-oauth-google-permission-page.png"
                    description="Google OAuth permission request page"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">7</span>
                    Verify Connection
                  </h3>
                  <p className="text-slate-300">
                    After authorization, you&apos;ll be redirected back to Magimanager.
                    The Ad Account should now show as <span className="text-emerald-400 font-semibold">Connected</span>{" "}
                    with the Google CID displayed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "upload-docs" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">📄</span>
                How to Upload ID Profile Documents
              </h2>
              <p className="text-slate-300 mb-6 leading-relaxed">
                ID Profile documents are used for account verification with Google. Upload clear, legible copies
                of identification documents for each identity directly from the ID Profile detail view.
              </p>

              <h3 className="text-lg font-semibold text-slate-200 mb-4">Accepted Document Types</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
                  <span className="text-2xl mb-1 block">🪪</span>
                  <span className="text-sm text-slate-300">Driver&apos;s License</span>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
                  <span className="text-2xl mb-1 block">💳</span>
                  <span className="text-sm text-slate-300">SSN Card</span>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
                  <span className="text-2xl mb-1 block">📑</span>
                  <span className="text-sm text-slate-300">Utility Bill</span>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
                  <span className="text-2xl mb-1 block">🏦</span>
                  <span className="text-sm text-slate-300">Bank Statement</span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Open ID Profile Details
                  </h3>
                  <p className="text-slate-300">
                    Navigate to <a href="/admin/identities" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-semibold hover:underline">ID Profiles</a> in the sidebar and click on
                    the profile you want to add documents to.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-docs-id-profile-select.png"
                    description="ID Profiles list - select profile for documents"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Find the Attached Documents Section
                  </h3>
                  <p className="text-slate-300">
                    On the right side of the profile detail view, you&apos;ll see the <span className="text-white font-semibold">&quot;Attached Documents&quot;</span> section.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-docs-section-location.png"
                    description="Attached Documents section in ID Profile detail view"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Upload a Document
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Click the <span className="text-emerald-400 font-semibold">Upload Document</span> button to select a file from your computer.
                  </p>
                  <ul className="text-slate-400 text-sm space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Click the upload button</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Select your document file (JPEG, PNG, WebP, or PDF)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span>Wait for the upload to complete</span>
                    </li>
                  </ul>
                  <ScreenshotPlaceholder
                    name="screenshot-docs-upload-button.png"
                    description="Upload Document button in Attached Documents section"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    Manage Your Documents
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Once uploaded, documents appear in the list with their filename and upload date. You can:
                  </p>
                  <ul className="text-slate-400 text-sm space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span><span className="text-emerald-400">View</span> - Click to open and preview the document</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      <span><span className="text-red-400">Delete</span> - Remove a document if needed</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <h4 className="text-amber-300 font-semibold mb-2 flex items-center gap-2">
                    <span>💡</span> Tips for Document Uploads
                  </h4>
                  <ul className="text-amber-200/80 text-sm space-y-1">
                    <li>• Ensure documents are clear and all text is readable</li>
                    <li>• Use high resolution images or scans</li>
                    <li>• Make sure the full document is visible in the image</li>
                    <li>• Accepted formats: JPEG, PNG, WebP, PDF (max 10MB)</li>
                    <li>• Name your files descriptively (e.g., &quot;john-doe-drivers-license.jpg&quot;)</li>
                  </ul>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <h4 className="text-emerald-300 font-semibold mb-2">What&apos;s Next?</h4>
                  <p className="text-emerald-200/80 text-sm">
                    After uploading your documents, the next step is to add a website to the ID Profile.
                    Continue to Step 5 to learn how to add a website.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "add-website" && (
            <div>
              <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-3">
                <span className="text-3xl">🌍</span>
                How to Add a Website
              </h2>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Each ID Profile can have an associated website. This is typically the business website
                that will be used for advertising campaigns associated with this identity.
              </p>

              <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Open ID Profile for Editing
                  </h3>
                  <p className="text-slate-300">
                    Navigate to <a href="/admin/identities" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-semibold hover:underline">ID Profiles</a>, click on
                    the profile, and then click the <span className="text-white font-semibold">&quot;Edit&quot;</span> button.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-website-edit-button.png"
                    description="ID Profile detail with Edit button highlighted"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Find the Website Field
                  </h3>
                  <p className="text-slate-300">
                    In the edit form, locate the <span className="text-white font-semibold">&quot;Website&quot;</span> field.
                  </p>
                  <ScreenshotPlaceholder
                    name="screenshot-website-field-location.png"
                    description="Edit form showing Website field"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Enter the Website URL
                  </h3>
                  <p className="text-slate-300 mb-3">
                    Enter the full website URL including the protocol:
                  </p>
                  <div className="bg-slate-900 rounded-lg p-4 border border-slate-600">
                    <code className="text-emerald-400">https://example.com</code>
                  </div>
                  <ScreenshotPlaceholder
                    name="screenshot-website-url-entered.png"
                    description="Website field with URL entered"
                  />
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-500 text-slate-950 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    Save Changes
                  </h3>
                  <p className="text-slate-300">
                    Click <span className="text-emerald-400 font-semibold">Save Changes</span> to update the ID Profile
                    with the website information.
                  </p>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
                  <h4 className="text-indigo-300 font-semibold mb-2 flex items-center gap-2">
                    <span>💡</span> Why Add a Website?
                  </h4>
                  <ul className="text-indigo-200/80 text-sm space-y-1">
                    <li>• Used as the landing page for ad campaigns</li>
                    <li>• Required for Google Ads verification in some cases</li>
                    <li>• Helps organize which website belongs to which identity</li>
                    <li>• Can be quickly referenced when setting up campaigns</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
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

// ============================================================================
// FAQ VIEW
// ============================================================================

type FAQSection = "overview" | "workflow" | "identities" | "accounts" | "team" | "integrations" | "dashboard" | "1click";

type FAQItem = {
  question: string;
  answer: string;
};

function FAQView() {
  const [activeSection, setActiveSection] = useState<FAQSection>("overview");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (id: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const sections: { id: FAQSection; title: string; icon: string }[] = [
    { id: "overview", title: "What is ABRA?", icon: "?" },
    { id: "workflow", title: "The Workflow", icon: "1" },
    { id: "identities", title: "ID Profiles", icon: "2" },
    { id: "accounts", title: "Ad Accounts", icon: "3" },
    { id: "team", title: "Team Management", icon: "4" },
    { id: "integrations", title: "Integrations", icon: "5" },
    { id: "dashboard", title: "Dashboard", icon: "6" },
    { id: "1click", title: "1-Click Websites", icon: "7" },
  ];

  const faqContent: Record<FAQSection, FAQItem[]> = {
    overview: [
      {
        question: "What is ABRA?",
        answer: "ABRA is like a filing cabinet for all your Google Ads accounts. Instead of using messy spreadsheets, you keep everything organized in one place - who owns each account, what documents they have, and whether the account is ready to use."
      },
      {
        question: "Why should I use ABRA?",
        answer: "Think of ABRA as your control center. It helps you: (1) Keep all your identity info in one place instead of scattered files, (2) See which accounts are new, warming up, or ready to go, (3) Control who on your team can see what, (4) Store important documents safely."
      },
      {
        question: "What is KADABRA?",
        answer: "KADABRA is the other half of the system. While ABRA is where you SET UP accounts, KADABRA is where you USE them. After you hand off an account in ABRA, the media buyer goes to KADABRA to run ads, check how they're doing, and use AI tools to help."
      }
    ],
    workflow: [
      {
        question: "What is the account factory workflow?",
        answer: "Think of it like building a house: (1) First, you create the 'person' who will own the account (ID Profile), (2) Then you set up their special browser (GoLogin), (3) Next, you create a record for their ad account (Ad Account Profile), (4) You let the account 'warm up' so Google trusts it, (5) Finally, you hand it off to someone who will run ads on it."
      },
      {
        question: "Why do we follow this order?",
        answer: "Each step depends on the one before it. You need a person (identity) before you can create an account for them. You need a special browser so accounts don't get linked together. And you need the account to warm up before running real ads, or Google might flag it."
      }
    ],
    identities: [
      {
        question: "What is an ID Profile?",
        answer: "An ID Profile is like a complete folder about one person. It has their name, birthday, address, email, phone number, credit card for billing, and copies of their ID documents. This is the 'person' who will own a Google Ads account."
      },
      {
        question: "Why do we need ID Profiles?",
        answer: "Google Ads accounts need to belong to a real person with real information. The ID Profile stores all that info in one place so you don't have to hunt through emails or files when you need it."
      },
      {
        question: "How do I create an ID Profile?",
        answer: "Click 'ID Profiles' in the sidebar, then click 'New Identity'. Fill in the person's info - their name, birthday, address, email, phone, and credit card. Click save. After that, you can add their ID documents and website."
      },
      {
        question: "What documents should I upload?",
        answer: "Upload any ID that proves who the person is - usually a driver's license or passport. Some setups also need an SSN card. These get stored safely and attached to the profile."
      },
      {
        question: "What does Archive do?",
        answer: "Archive is like putting a folder in storage. The identity disappears from your main list, but all the info is still saved. Use this when you're done with an identity but might need the records later."
      }
    ],
    accounts: [
      {
        question: "What is an Ad Account Profile?",
        answer: "An Ad Account Profile is a RECORD in ABRA that tracks information about a Google Ads account. Think of it like an index card that says 'this account exists, it belongs to this person, and here's its status.' It's NOT the actual Google Ads account - it's our way of keeping track of it."
      },
      {
        question: "What is a Live Ad Account?",
        answer: "A Live Ad Account is the REAL Google Ads account that exists on Google's website. This is where ads actually run and money gets spent. It's the actual thing, not just a record of it."
      },
      {
        question: "What's the difference between them?",
        answer: "Think of it like a car title vs. a car. The Ad Account Profile (title) is paperwork that says you own something and tracks its info. The Live Ad Account (car) is the real thing that actually does the work. ABRA manages the paperwork. Google Ads is where the real account lives."
      },
      {
        question: "How do I connect a Live Ad Account to an Ad Account Profile?",
        answer: "First, create an Ad Account Profile in ABRA and link it to an ID Profile. Then use OAuth (a secure login) to connect to the real Google Ads account. This links the paperwork (profile) to the real thing (live account) so ABRA can track what's happening."
      },
      {
        question: "Why do we do it this way?",
        answer: "We keep records in ABRA because: (1) You can see all your accounts in one dashboard, (2) You can track status without logging into Google, (3) You know which person owns which account, (4) You can hand off accounts to team members easily."
      },
      {
        question: "What are the account statuses?",
        answer: "Accounts go through 4 stages: (1) Provisioned = just created, brand new, (2) Warming Up = letting Google learn to trust it, (3) Ready = warmed up and ready to use, (4) Handed Off = given to a media buyer to run ads."
      },
      {
        question: "What is warmup?",
        answer: "Warmup is like breaking in new shoes. A brand new Google Ads account needs time to build trust with Google. During warmup, you spend small amounts slowly. This shows Google the account is real and legit. If you skip warmup and spend too fast, Google might flag the account."
      },
      {
        question: "How do I hand off an account?",
        answer: "Go to Account Profiles, find the account that says 'Ready', click the Assign button, pick the team member from the list, and confirm. They'll get a notification and can start using the account in KADABRA."
      }
    ],
    team: [
      {
        question: "What are the different roles?",
        answer: "Think of roles like keys that unlock different doors: SUPER_ADMIN = master key, can do everything. ADMIN = can manage team and accounts. MANAGER = same as Admin. MEDIA_BUYER = can only see accounts given to them. ASSISTANT = can only look, can't change anything."
      },
      {
        question: "How do I add someone to the team?",
        answer: "Click 'Team' in the sidebar, then 'Add Member'. Type their email, pick their role, and click submit. They'll get an email to set up their password."
      },
      {
        question: "How do I change someone's role?",
        answer: "Go to Team, find the person, click on their current role, and pick a new one from the list. The change happens right away."
      }
    ],
    integrations: [
      {
        question: "What is GoLogin?",
        answer: "GoLogin is special browser software. Each identity gets their own browser that looks completely different from the others. This is important because if you log into multiple Google accounts from the same browser, Google might think they're connected and flag them."
      },
      {
        question: "Why do we need GoLogin?",
        answer: "Every browser has a 'fingerprint' - little details that make it unique. If you use the same browser for multiple accounts, Google can tell they're related. GoLogin gives each identity their own fingerprint, so accounts stay separate."
      },
      {
        question: "How do I set up Telegram alerts?",
        answer: "Go to Settings, find the Telegram section, and paste in your Bot Token and Chat ID. Then pick which alerts you want - like when an identity is created or an account status changes. You'll get messages on Telegram when those things happen."
      }
    ],
    dashboard: [
      {
        question: "What do the numbers on the dashboard mean?",
        answer: "The dashboard shows 4 big numbers: (1) ID Profiles = how many identities you have total, (2) In Warmup = how many accounts are currently warming up, (3) Ready to Deploy = accounts that finished warmup and are ready to use, (4) Handed Off = accounts that have been given to media buyers."
      },
      {
        question: "What is the pipeline diagram?",
        answer: "The pipeline is a picture showing how accounts flow through the system - from creating an identity, to setting up GoLogin, to creating the account, to warmup, to handoff. It helps you see where everything is at a glance."
      }
    ],
    "1click": [
      {
        question: "What is 1-Click Websites?",
        answer: "1-Click Websites lets you quickly deploy simple landing pages for your ad accounts. It handles everything automatically: uploading your website files, buying a domain through Namecheap, creating a server on DigitalOcean, and setting up SSL. Each identity can have their own website for their campaigns."
      },
      {
        question: "What do I need to set up 1-Click Websites?",
        answer: "You need three things configured in Settings > Integrations: (1) Namecheap API credentials (for buying domains), (2) DigitalOcean API key (for creating servers), and (3) A proxy server with a static IP (because Namecheap requires IP whitelisting). The proxy server is the tricky part - see below for setup instructions."
      },
      {
        question: "Why do I need a proxy server?",
        answer: "Namecheap's API requires you to whitelist specific IP addresses that can make API calls. The problem is that ABRA runs on Vercel, which uses dynamic IPs that change constantly. So we need a small server with a static IP to act as a middleman - ABRA sends requests to the proxy, and the proxy forwards them to Namecheap using its whitelisted IP."
      },
      {
        question: "How do I set up the proxy server on DigitalOcean?",
        answer: "1. Log into DigitalOcean and create a new Droplet. 2. Choose the cheapest option ($4-6/mo): Ubuntu 22.04, Basic plan, Regular CPU, smallest size. 3. Pick any region (NYC is fine). 4. Add your SSH key so you can log in. 5. Create the droplet and note its IP address. 6. SSH into the server and follow the proxy setup steps below."
      },
      {
        question: "What commands do I run to set up the proxy?",
        answer: "SSH into your droplet, then run these commands:\\n\\n1. Update the system:\\n   sudo apt update && sudo apt upgrade -y\\n\\n2. Install Node.js:\\n   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\\n   sudo apt install -y nodejs\\n\\n3. Create the proxy script:\\n   sudo mkdir -p /opt/proxy\\n   sudo nano /opt/proxy/server.js\\n\\nPaste the proxy code (see next question), save with Ctrl+X, Y, Enter.\\n\\n4. Install PM2 and start:\\n   sudo npm install -g pm2\\n   cd /opt/proxy && pm2 start server.js --name proxy\\n   pm2 startup && pm2 save"
      },
      {
        question: "What is the proxy server code?",
        answer: "Create /opt/proxy/server.js with this code:\\n\\nconst http = require('http');\\nconst https = require('https');\\nconst { URL } = require('url');\\n\\nconst server = http.createServer(async (req, res) => {\\n  res.setHeader('Access-Control-Allow-Origin', '*');\\n  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');\\n  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');\\n\\n  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }\\n  if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }\\n\\n  let body = '';\\n  req.on('data', chunk => body += chunk);\\n  req.on('end', async () => {\\n    try {\\n      const { url } = JSON.parse(body);\\n      const parsed = new URL(url);\\n      const client = parsed.protocol === 'https:' ? https : http;\\n      const proxyReq = client.request(url, { method: 'GET' }, proxyRes => {\\n        let data = '';\\n        proxyRes.on('data', chunk => data += chunk);\\n        proxyRes.on('end', () => { res.writeHead(200); res.end(data); });\\n      });\\n      proxyReq.on('error', e => { res.writeHead(500); res.end(e.message); });\\n      proxyReq.end();\\n    } catch (e) { res.writeHead(400); res.end('Invalid request'); }\\n  });\\n});\\n\\nserver.listen(3000, () => console.log('Proxy running on port 3000'));"
      },
      {
        question: "How do I configure ABRA to use the proxy?",
        answer: "1. Go to Settings > Integrations in ABRA. 2. In the Namecheap section, enter your Namecheap username and API key. 3. For 'Whitelist IP', enter your proxy server's IP address (the droplet's IP). 4. For 'Proxy URL', enter: http://YOUR_DROPLET_IP:3000 (replace with actual IP). 5. Save settings. 6. Finally, log into Namecheap and whitelist your proxy server's IP in their API settings."
      },
      {
        question: "How do I test if the proxy is working?",
        answer: "From your terminal, run: curl -X POST http://YOUR_DROPLET_IP:3000 -H 'Content-Type: application/json' -d '{\"url\": \"https://httpbin.org/ip\"}'\\n\\nIf working, you'll see a response showing your droplet's IP address. If you see your droplet's IP in the response, the proxy is working correctly."
      },
      {
        question: "What if domain search shows '.com.com' errors?",
        answer: "This happens if you type a full domain like 'example.com' in the search. The search is designed for keywords (like 'example') and adds TLDs automatically. You can enter either: (1) Just the keyword: 'mysite' - will search mysite.com, mysite.net, etc., or (2) A full domain: 'mysite.com' - will check that exact domain plus show other TLD options."
      },
      {
        question: "How much does a proxy server cost?",
        answer: "The smallest DigitalOcean droplet costs about $4-6/month. It's just forwarding small API requests, so you don't need anything powerful. One proxy server can handle all your Namecheap API calls."
      },
      {
        question: "Can I use the same proxy for other things?",
        answer: "Yes! Any API that requires IP whitelisting can use this same proxy server. Just send a POST request with the target URL in the body. The proxy doesn't care what API you're calling - it just forwards requests."
      }
    ]
  };

  // Workflow diagram component
  const WorkflowDiagram = () => (
    <div className="my-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">How Accounts Get Made (Step by Step)</h4>
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
        {[
          { label: "1. ID Profile", sub: "Create the person", color: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" },
          { label: "2. GoLogin", sub: "Set up their browser", color: "bg-purple-500/20 border-purple-500/40 text-purple-300" },
          { label: "3. Account Profile", sub: "Create the record", color: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
          { label: "4. Warmup", sub: "Build trust with Google", color: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
          { label: "5. Handoff", sub: "Give to media buyer", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
        ].map((step, i, arr) => (
          <div key={step.label} className="flex items-center gap-2 md:gap-4">
            <div className={`px-4 py-3 rounded-lg border ${step.color} text-center min-w-[120px]`}>
              <div className="font-semibold text-sm">{step.label}</div>
              <div className="text-xs opacity-70 mt-1">{step.sub}</div>
            </div>
            {i < arr.length - 1 && (
              <svg className="w-6 h-6 text-slate-600 flex-shrink-0 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Account status flow diagram
  const StatusFlowDiagram = () => (
    <div className="my-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Account Stages (From New to Ready)</h4>
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
        {[
          { label: "Provisioned", sub: "Just created", color: "bg-slate-500/20 border-slate-500/40 text-slate-300" },
          { label: "Warming Up", sub: "Building trust", color: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
          { label: "Ready", sub: "Good to go!", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
          { label: "Handed Off", sub: "Given to buyer", color: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
        ].map((step, i, arr) => (
          <div key={step.label} className="flex items-center gap-2 md:gap-4">
            <div className={`px-4 py-3 rounded-lg border ${step.color} text-center min-w-[110px]`}>
              <div className="font-semibold text-sm">{step.label}</div>
              <div className="text-xs opacity-70 mt-1">{step.sub}</div>
            </div>
            {i < arr.length - 1 && (
              <svg className="w-6 h-6 text-slate-600 flex-shrink-0 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Profile vs Live Account diagram
  const ProfileVsLiveDiagram = () => (
    <div className="my-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Ad Account Profile vs Live Ad Account</h4>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h5 className="font-semibold text-blue-300">Ad Account Profile</h5>
              <p className="text-xs text-blue-300/70">The paperwork (in ABRA)</p>
            </div>
          </div>
          <ul className="text-sm text-blue-200/80 space-y-2">
            <li>• A record that tracks info about an account</li>
            <li>• Like an index card or a car title</li>
            <li>• Lives here in ABRA</li>
            <li>• Shows status, owner, notes</li>
          </ul>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h5 className="font-semibold text-emerald-300">Live Ad Account</h5>
              <p className="text-xs text-emerald-300/70">The real thing (on Google)</p>
            </div>
          </div>
          <ul className="text-sm text-emerald-200/80 space-y-2">
            <li>• The actual Google Ads account</li>
            <li>• Like the actual car you drive</li>
            <li>• Lives on Google's website</li>
            <li>• Where ads run and money gets spent</li>
          </ul>
        </div>
      </div>
      <div className="mt-4 p-4 bg-slate-700/30 rounded-lg">
        <p className="text-sm text-slate-300 text-center">
          <span className="text-blue-300 font-semibold">Profile</span> + <span className="text-emerald-300 font-semibold">OAuth Connection</span> = <span className="text-amber-300 font-semibold">Linked!</span>
          <br />
          <span className="text-xs text-slate-400 mt-1 block">OAuth connects the paperwork to the real account so ABRA can track it</span>
        </p>
      </div>
    </div>
  );

  // User roles hierarchy diagram
  const RolesDiagram = () => (
    <div className="my-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Team Roles (Who Can Do What)</h4>
      <div className="space-y-3 max-w-lg mx-auto">
        {[
          { role: "SUPER_ADMIN", desc: "Can do everything", color: "bg-rose-500/20 border-rose-500/40 text-rose-300" },
          { role: "ADMIN", desc: "Manage team and accounts", color: "bg-orange-500/20 border-orange-500/40 text-orange-300" },
          { role: "MANAGER", desc: "Same as Admin", color: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
          { role: "MEDIA_BUYER", desc: "Only sees their assigned accounts", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
          { role: "ASSISTANT", desc: "Can look but can't change anything", color: "bg-slate-500/20 border-slate-500/40 text-slate-300" },
        ].map((item) => (
          <div key={item.role} className="flex items-center gap-3">
            <div className={`flex-1 px-4 py-3 rounded-lg border ${item.color} flex justify-between items-center`}>
              <span className="font-semibold text-sm">{item.role}</span>
              <span className="text-xs opacity-80">{item.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Proxy architecture diagram for 1-Click Websites
  const ProxyDiagram = () => (
    <div className="my-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Why We Need a Proxy Server</h4>
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6">
        {/* ABRA on Vercel */}
        <div className="px-4 py-3 rounded-lg border bg-blue-500/20 border-blue-500/40 text-center min-w-[120px]">
          <div className="font-semibold text-sm text-blue-300">ABRA</div>
          <div className="text-xs text-blue-300/70 mt-1">on Vercel</div>
          <div className="text-xs text-red-400 mt-2">Dynamic IPs</div>
        </div>

        <svg className="w-6 h-6 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Proxy Server */}
        <div className="px-4 py-3 rounded-lg border bg-emerald-500/20 border-emerald-500/40 text-center min-w-[140px]">
          <div className="font-semibold text-sm text-emerald-300">Proxy Droplet</div>
          <div className="text-xs text-emerald-300/70 mt-1">DigitalOcean</div>
          <div className="text-xs text-emerald-400 mt-2">Static IP ✓</div>
        </div>

        <svg className="w-6 h-6 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Namecheap */}
        <div className="px-4 py-3 rounded-lg border bg-amber-500/20 border-amber-500/40 text-center min-w-[120px]">
          <div className="font-semibold text-sm text-amber-300">Namecheap</div>
          <div className="text-xs text-amber-300/70 mt-1">API</div>
          <div className="text-xs text-amber-400 mt-2">IP Whitelist</div>
        </div>
      </div>
      <p className="text-center text-xs text-slate-400 mt-4">
        Namecheap requires whitelisted IPs. Vercel&apos;s IPs change, so we route through a proxy with a fixed IP.
      </p>
    </div>
  );

  // 1-Click Website deployment flow diagram
  const OneClickFlowDiagram = () => (
    <div className="my-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">1-Click Website Deployment Flow</h4>
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
        {[
          { label: "1. Upload", sub: "ZIP file (50MB max)", color: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" },
          { label: "2. Domain", sub: "Search & purchase", color: "bg-purple-500/20 border-purple-500/40 text-purple-300" },
          { label: "3. Server", sub: "Create droplet", color: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
          { label: "4. Deploy", sub: "Files + SSL", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
        ].map((step, i, arr) => (
          <div key={step.label} className="flex items-center gap-2 md:gap-4">
            <div className={`px-4 py-3 rounded-lg border ${step.color} text-center min-w-[110px]`}>
              <div className="font-semibold text-sm">{step.label}</div>
              <div className="text-xs opacity-70 mt-1">{step.sub}</div>
            </div>
            {i < arr.length - 1 && (
              <svg className="w-6 h-6 text-slate-600 flex-shrink-0 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar Navigation */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 sticky top-0">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
            FAQ Sections
          </h3>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  activeSection === section.id
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  activeSection === section.id
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-700 text-slate-300"
                }`}>
                  {section.icon}
                </span>
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8">
          <h2 className="text-2xl font-bold text-slate-100 mb-2 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400 mb-6">Quick answers for new admins</p>

          {/* Show workflow diagram on overview and workflow sections */}
          {(activeSection === "overview" || activeSection === "workflow") && <WorkflowDiagram />}

          {/* Show diagrams on accounts section */}
          {activeSection === "accounts" && (
            <>
              <ProfileVsLiveDiagram />
              <StatusFlowDiagram />
            </>
          )}

          {/* Show roles diagram on team section */}
          {activeSection === "team" && <RolesDiagram />}

          {/* Show 1-Click diagrams */}
          {activeSection === "1click" && (
            <>
              <OneClickFlowDiagram />
              <ProxyDiagram />
            </>
          )}

          {/* FAQ Accordion */}
          <div className="space-y-3">
            {faqContent[activeSection].map((item, index) => {
              const questionId = `${activeSection}-${index}`;
              const isExpanded = expandedQuestions.has(questionId);

              return (
                <div
                  key={questionId}
                  className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
                >
                  <button
                    onClick={() => toggleQuestion(questionId)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-slate-800/70 transition"
                  >
                    <span className="font-medium text-slate-200">{item.question}</span>
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 text-slate-300 leading-relaxed border-t border-slate-700 pt-4">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WEBSITES VIEW - 1-CLICK WEBSITES
// ============================================================================

type Website = {
  id: string;
  name: string;
  zipFileUrl: string | null;
  zipFileSize: number | null;
  domain: string | null;
  domainOrderId: string | null;
  domainPurchasePrice: number | null;
  dropletId: string | null;
  dropletIp: string | null;
  dropletRegion: string | null;
  dropletSize: string | null;
  status: string;
  statusMessage: string | null;
  errorMessage: string | null;
  sslEnabled: boolean;
  deployedAt: string | null;
  createdAt: string;
  createdBy: string;
  activities: WebsiteActivity[];
};

type WebsiteActivity = {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
};

type DomainResult = {
  domain: string;
  available: boolean;
  premium: boolean;
  price?: number;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-slate-700", text: "text-slate-300", label: "Pending" },
  UPLOADING: { bg: "bg-blue-900/50", text: "text-blue-400", label: "Uploading" },
  DOMAIN_PENDING: { bg: "bg-yellow-900/50", text: "text-yellow-400", label: "Domain Pending" },
  DOMAIN_PURCHASED: { bg: "bg-emerald-900/50", text: "text-emerald-400", label: "Domain Ready" },
  DROPLET_CREATING: { bg: "bg-blue-900/50", text: "text-blue-400", label: "Creating Server" },
  DROPLET_READY: { bg: "bg-emerald-900/50", text: "text-emerald-400", label: "Server Ready" },
  DEPLOYING: { bg: "bg-blue-900/50", text: "text-blue-400", label: "Deploying" },
  SSL_PENDING: { bg: "bg-yellow-900/50", text: "text-yellow-400", label: "SSL Pending" },
  LIVE: { bg: "bg-emerald-900/50", text: "text-emerald-400", label: "Live" },
  FAILED: { bg: "bg-red-900/50", text: "text-red-400", label: "Failed" },
};

function WebsitesView() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);

  const fetchWebsites = async () => {
    try {
      const res = await fetch("/api/websites");
      const data = await res.json();
      if (data.websites) {
        setWebsites(data.websites);
      }
    } catch (error) {
      console.error("Failed to fetch websites:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this website? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/websites/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchWebsites();
      }
    } catch (error) {
      console.error("Failed to delete website:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-800 rounded w-48"></div>
          <div className="h-64 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">
            Deploy simple websites with automated domain registration and server setup
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <span>+</span>
          New Website
        </button>
      </div>

      {websites.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="text-5xl mb-4">🌐</div>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">No websites yet</h3>
          <p className="text-slate-400 mb-6">Create your first 1-click website to get started</p>
          <button
            onClick={() => setShowWizard(true)}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition"
          >
            Create Website
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {websites.map((site) => {
            const statusConfig = STATUS_COLORS[site.status] || STATUS_COLORS.PENDING;
            return (
              <div
                key={site.id}
                className="bg-slate-800/50 rounded-lg border border-slate-700 p-5 hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-100">{site.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    {site.domain && (
                      <div className="flex items-center gap-2 text-sm text-slate-300 mb-1">
                        <span>🌐</span>
                        {site.status === "LIVE" ? (
                          <a
                            href={`https://${site.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 underline"
                          >
                            {site.domain}
                          </a>
                        ) : (
                          <span>{site.domain}</span>
                        )}
                      </div>
                    )}

                    {site.dropletIp && (
                      <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                        <span>🖥️</span>
                        <span>IP: {site.dropletIp}</span>
                        {site.dropletRegion && <span className="text-slate-500">({site.dropletRegion})</span>}
                      </div>
                    )}

                    {site.statusMessage && (
                      <p className="text-sm text-slate-400 mt-2">{site.statusMessage}</p>
                    )}

                    {site.errorMessage && (
                      <p className="text-sm text-red-400 mt-2">{site.errorMessage}</p>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span>Created {new Date(site.createdAt).toLocaleDateString()}</span>
                      {site.deployedAt && (
                        <span>Deployed {new Date(site.deployedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {site.status !== "LIVE" && site.status !== "FAILED" && (
                      <button
                        onClick={() => {
                          setSelectedWebsite(site);
                          setShowWizard(true);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition"
                      >
                        Continue
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(site.id)}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Wizard Modal */}
      {showWizard && (
        <WebsiteWizard
          website={selectedWebsite}
          onClose={() => {
            setShowWizard(false);
            setSelectedWebsite(null);
            fetchWebsites();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// WEBSITE WIZARD - MULTI-STEP DEPLOYMENT
// ============================================================================

function WebsiteWizard({ website, onClose }: { website: Website | null; onClose: () => void }) {
  // Determine starting step based on website state
  const getInitialStep = (): number => {
    if (!website) return 1;
    if (!website.zipFileUrl) return 1;
    if (!website.domain) return 2;
    if (!website.dropletId) return 3;
    return 4;
  };

  const [step, setStep] = useState(getInitialStep());
  const [currentWebsite, setCurrentWebsite] = useState<Website | null>(website);

  // Step 1: Name & Upload
  const [name, setName] = useState(website?.name || "");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Step 2: Domain
  const [domainMode, setDomainMode] = useState<"search" | "existing">("existing"); // Default to existing
  const [domainKeyword, setDomainKeyword] = useState("");
  const [domainResults, setDomainResults] = useState<DomainResult[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [existingDomain, setExistingDomain] = useState(""); // For "Use Existing Domain"
  const [searchingDomains, setSearchingDomains] = useState(false);
  const [purchasingDomain, setPurchasingDomain] = useState(false);
  const [settingDomain, setSettingDomain] = useState(false);
  const [domainError, setDomainError] = useState("");

  // Step 3: Server
  const [region, setRegion] = useState("nyc1");
  const [creatingDroplet, setCreatingDroplet] = useState(false);
  const [dropletError, setDropletError] = useState("");

  // Step 4: Deploy
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState("");

  const regions = [
    { value: "nyc1", label: "New York 1" },
    { value: "nyc3", label: "New York 3" },
    { value: "sfo3", label: "San Francisco 3" },
    { value: "ams3", label: "Amsterdam 3" },
    { value: "lon1", label: "London 1" },
    { value: "fra1", label: "Frankfurt 1" },
    { value: "sgp1", label: "Singapore 1" },
  ];

  // Step 1: Create website and upload zip
  const handleUpload = async () => {
    if (!name.trim()) {
      setUploadError("Please enter a website name");
      return;
    }
    if (!zipFile && !currentWebsite?.zipFileUrl) {
      setUploadError("Please select a zip file");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      let websiteId = currentWebsite?.id;

      // Create website if new
      if (!websiteId) {
        const createRes = await fetch("/api/websites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || "Failed to create website");
        websiteId = createData.website.id;
        setCurrentWebsite(createData.website);
      }

      // Upload zip if provided
      if (zipFile) {
        const formData = new FormData();
        formData.append("file", zipFile);

        const uploadRes = await fetch(`/api/websites/${websiteId}/upload`, {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Failed to upload file");
        setCurrentWebsite(uploadData.website);
      }

      setStep(2);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Step 2: Search domains
  const handleSearchDomains = async () => {
    if (!domainKeyword.trim()) return;

    setSearchingDomains(true);
    setDomainError("");
    setDomainResults([]);

    try {
      const res = await fetch(`/api/websites/${currentWebsite?.id}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", keyword: domainKeyword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setDomainResults(data.results || []);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : "Search failed");
    } finally {
      setSearchingDomains(false);
    }
  };

  // Step 2: Purchase domain
  const handlePurchaseDomain = async () => {
    if (!selectedDomain) return;

    setPurchasingDomain(true);
    setDomainError("");

    try {
      const res = await fetch(`/api/websites/${currentWebsite?.id}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", domain: selectedDomain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setCurrentWebsite(data.website);
      setStep(3);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : "Purchase failed");
    } finally {
      setPurchasingDomain(false);
    }
  };

  // Step 2: Set existing domain (no purchase)
  const handleSetExistingDomain = async () => {
    const domain = existingDomain.trim().toLowerCase();
    if (!domain) {
      setDomainError("Please enter a domain");
      return;
    }
    // Basic validation
    if (!domain.includes(".") || domain.length < 4) {
      setDomainError("Please enter a valid domain (e.g., example.com)");
      return;
    }

    setSettingDomain(true);
    setDomainError("");

    try {
      const res = await fetch(`/api/websites/${currentWebsite?.id}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set domain");
      setCurrentWebsite(data.website);
      setStep(3);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : "Failed to set domain");
    } finally {
      setSettingDomain(false);
    }
  };

  // Step 3: Create droplet
  const handleCreateDroplet = async () => {
    setCreatingDroplet(true);
    setDropletError("");

    try {
      const res = await fetch(`/api/websites/${currentWebsite?.id}/droplet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create server");
      setCurrentWebsite(data.website);
      setStep(4);
    } catch (error) {
      setDropletError(error instanceof Error ? error.message : "Server creation failed");
    } finally {
      setCreatingDroplet(false);
    }
  };

  // Step 4: Deploy
  const handleDeploy = async () => {
    setDeploying(true);
    setDeployError("");

    try {
      const res = await fetch(`/api/websites/${currentWebsite?.id}/deploy`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deployment failed");
      setCurrentWebsite(data.website);

      // If successful, mark as live
      if (data.success) {
        await fetch(`/api/websites/${currentWebsite?.id}/deploy`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sslEnabled: true }),
        });
      }
    } catch (error) {
      setDeployError(error instanceof Error ? error.message : "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              {currentWebsite ? `Deploy: ${currentWebsite.name}` : "New Website"}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`w-8 h-1 rounded ${s <= step ? "bg-emerald-500" : "bg-slate-700"}`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Name & Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-4">Step 1: Upload Website Files</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Give your website a name and upload a zip file containing your HTML/PHP files.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Website Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Website"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Website Files (ZIP)</label>
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-slate-600 transition">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="zip-upload"
                  />
                  <label htmlFor="zip-upload" className="cursor-pointer">
                    {zipFile ? (
                      <div>
                        <div className="text-4xl mb-2">📦</div>
                        <p className="text-slate-200 font-medium">{zipFile.name}</p>
                        <p className="text-slate-400 text-sm">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : currentWebsite?.zipFileUrl ? (
                      <div>
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-emerald-400 font-medium">File already uploaded</p>
                        <p className="text-slate-400 text-sm">Click to replace</p>
                      </div>
                    ) : (
                      <div>
                        <div className="text-4xl mb-2">📁</div>
                        <p className="text-slate-300">Click to upload or drag and drop</p>
                        <p className="text-slate-500 text-sm mt-1">ZIP files only, max 50MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {uploadError && (
                <p className="text-red-400 text-sm">{uploadError}</p>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || (!name.trim() && !currentWebsite)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition"
              >
                {uploading ? "Uploading..." : "Continue to Domain Selection"}
              </button>
            </div>
          )}

          {/* Step 2: Domain */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-4">Step 2: Choose Domain</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Use a domain you already own, or search and purchase a new one.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
                <button
                  onClick={() => { setDomainMode("existing"); setDomainError(""); }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                    domainMode === "existing"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Use Existing Domain
                </button>
                <button
                  onClick={() => { setDomainMode("search"); setDomainError(""); }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                    domainMode === "search"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Search & Purchase
                </button>
              </div>

              {/* Existing Domain Mode */}
              {domainMode === "existing" && (
                <div className="space-y-4">
                  <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-700/50">
                    <p className="text-emerald-300 text-sm">
                      Enter a domain you've already purchased on Namecheap (or any registrar).
                      After creating the server, you'll get DNS records to configure.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Your Domain</label>
                    <input
                      type="text"
                      value={existingDomain}
                      onChange={(e) => setExistingDomain(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSetExistingDomain()}
                      placeholder="example.com"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Search & Purchase Mode */}
              {domainMode === "search" && (
                <div className="space-y-4">
                  <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/50">
                    <p className="text-amber-300 text-sm">
                      Note: Namecheap API requires prepaid account balance. Add funds to your
                      Namecheap account before purchasing, or use "Use Existing Domain" and
                      purchase manually on namecheap.com.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={domainKeyword}
                      onChange={(e) => setDomainKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchDomains()}
                      placeholder="Enter keyword (e.g., mywebsite)"
                      className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleSearchDomains}
                      disabled={searchingDomains || !domainKeyword.trim()}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg font-medium transition"
                    >
                      {searchingDomains ? "..." : "Search"}
                    </button>
                  </div>

                  {domainResults.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">Available Domains</label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {domainResults.map((result) => (
                          <button
                            key={result.domain}
                            onClick={() => result.available && setSelectedDomain(result.domain)}
                            disabled={!result.available}
                            className={`w-full px-4 py-3 rounded-lg border text-left transition ${
                              selectedDomain === result.domain
                                ? "bg-emerald-900/30 border-emerald-500 text-emerald-400"
                                : result.available
                                ? "bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600"
                                : "bg-slate-800/50 border-slate-700/50 text-slate-500"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{result.domain}</span>
                              {result.available ? (
                                <span className="text-emerald-400 text-sm">Available</span>
                              ) : (
                                <span className="text-slate-500 text-sm">Taken</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {domainError && (
                <p className="text-red-400 text-sm">{domainError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition"
                >
                  Back
                </button>
                {domainMode === "existing" ? (
                  <button
                    onClick={handleSetExistingDomain}
                    disabled={settingDomain || !existingDomain.trim()}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition"
                  >
                    {settingDomain ? "Setting Domain..." : `Use ${existingDomain.trim() || "Domain"}`}
                  </button>
                ) : (
                  <button
                    onClick={handlePurchaseDomain}
                    disabled={purchasingDomain || !selectedDomain}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition"
                  >
                    {purchasingDomain ? "Purchasing..." : `Purchase ${selectedDomain || "Domain"}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Server */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-4">Step 3: Create Server</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Select a server region and create your DigitalOcean droplet.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Server Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {regions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="font-medium text-slate-200 mb-2">Server Specs</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Type:</span>
                    <span className="text-slate-300 ml-2">Basic Droplet</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cost:</span>
                    <span className="text-slate-300 ml-2">~$6/month</span>
                  </div>
                  <div>
                    <span className="text-slate-500">RAM:</span>
                    <span className="text-slate-300 ml-2">1 GB</span>
                  </div>
                  <div>
                    <span className="text-slate-500">CPU:</span>
                    <span className="text-slate-300 ml-2">1 vCPU</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Storage:</span>
                    <span className="text-slate-300 ml-2">25 GB SSD</span>
                  </div>
                  <div>
                    <span className="text-slate-500">OS:</span>
                    <span className="text-slate-300 ml-2">Ubuntu 22.04</span>
                  </div>
                </div>
              </div>

              {dropletError && (
                <p className="text-red-400 text-sm">{dropletError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateDroplet}
                  disabled={creatingDroplet}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition"
                >
                  {creatingDroplet ? "Creating Server..." : "Create Server"}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Deploy */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-4">Step 4: Deploy Website</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Configure DNS and deploy your website with automatic SSL.
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-3">
                <h4 className="font-medium text-slate-200">Deployment Summary</h4>
                <div className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-slate-300">Files uploaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-slate-300">Domain: {currentWebsite?.domain}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-slate-300">Server created in {currentWebsite?.dropletRegion}</span>
                  </div>
                  {currentWebsite?.dropletIp && (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-slate-300">IP: {currentWebsite.dropletIp}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* DNS Configuration Instructions */}
              {currentWebsite?.dropletIp && (
                <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/50">
                  <h4 className="font-medium text-amber-300 mb-3">⚠️ Configure DNS Records</h4>
                  <p className="text-amber-200/80 text-sm mb-3">
                    Go to your domain registrar (Namecheap, etc.) and set these DNS records:
                  </p>
                  <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm space-y-2">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 w-16">Type:</span>
                      <span className="text-amber-300">A Record</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 w-16">Host:</span>
                      <span className="text-emerald-300">@</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 w-16">Value:</span>
                      <span className="text-emerald-300">{currentWebsite.dropletIp}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(currentWebsite.dropletIp!)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="border-t border-slate-700 my-2"></div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 w-16">Type:</span>
                      <span className="text-amber-300">A Record</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 w-16">Host:</span>
                      <span className="text-emerald-300">www</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 w-16">Value:</span>
                      <span className="text-emerald-300">{currentWebsite.dropletIp}</span>
                    </div>
                  </div>
                  <p className="text-amber-200/60 text-xs mt-3">
                    DNS changes can take 5-30 minutes to propagate. You can deploy now and SSL will be set up once DNS is ready.
                  </p>
                </div>
              )}

              <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/50">
                <h4 className="font-medium text-blue-300 mb-2">What happens when you deploy:</h4>
                <ul className="text-sm text-blue-200/80 space-y-1 list-disc list-inside">
                  <li>Wait for server to finish setup</li>
                  <li>Website files will be deployed to server</li>
                  <li>SSL certificate will be obtained (requires DNS to be configured)</li>
                </ul>
              </div>

              {deployError && (
                <p className="text-red-400 text-sm">{deployError}</p>
              )}

              {currentWebsite?.status === "LIVE" ? (
                <div className="text-center py-6">
                  <div className="text-5xl mb-4">🎉</div>
                  <h4 className="text-xl font-semibold text-emerald-400 mb-2">Website is Live!</h4>
                  <a
                    href={`https://${currentWebsite.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline"
                  >
                    Visit https://{currentWebsite.domain}
                  </a>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(3)}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition"
                  >
                    {deploying ? "Deploying..." : "Deploy Website"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
