"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useRealtimeNotifications } from "@magimanager/realtime";
import { ProfileModal } from "@magimanager/features/admin";
import { formatDateForDisplay } from "@magimanager/shared";
import Link from "next/link";
import { APP_VERSION, BUILD_SHA, KADABRA_URL } from "@/lib/constants";

// ============================================================================
// TYPES
// ============================================================================

type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

type AdminLayoutContextType = {
  userRole: UserRole;
  refreshData: () => void;
};

const AdminLayoutContext = createContext<AdminLayoutContextType | null>(null);

export function useAdminLayout() {
  const ctx = useContext(AdminLayoutContext);
  if (!ctx) throw new Error("useAdminLayout must be used within AdminLayout");
  return ctx;
}

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
// NAVIGATION CONFIG
// ============================================================================

type NavItem = {
  href: string;
  label: string;
  icon: string;
  comingSoon?: boolean;
  roles?: UserRole[];
};

function getNavItems(userRole: UserRole): NavItem[] {
  const items: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
  ];

  // Admin/Manager items
  if (["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(userRole)) {
    items.push(
      { href: "/admin/ad-accounts", label: "Account Profiles", icon: "💳" },
      { href: "/admin/identities", label: "ID Profiles", icon: "👥" },
      { href: "/admin/requests/admin", label: "Account Requests", icon: "📥" },
      { href: "/admin/team", label: "Team", icon: "👨‍👩‍👧‍👦" }
    );
  }

  // SMS Dashboard - Super Admin and Admin only (Coming Soon)
  if (["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
    items.push(
      { href: "/admin/sms", label: "SMS", icon: "📱", comingSoon: true }
    );
  }

  // System - Super Admin only
  if (userRole === "SUPER_ADMIN") {
    items.push(
      { href: "/admin/system", label: "System", icon: "🔧" }
    );
  }

  // My Accounts - Super Admin, Admin, Media Buyer
  if (["SUPER_ADMIN", "ADMIN", "MEDIA_BUYER"].includes(userRole)) {
    items.push(
      { href: "/admin/my-accounts", label: "My Accounts", icon: "💼" }
    );
  }

  // All users get My Requests
  items.push(
    { href: "/admin/requests", label: "My Requests", icon: "📝" }
  );

  // Settings - Admins/Managers
  if (["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(userRole)) {
    items.push(
      { href: "/admin/settings", label: "Settings", icon: "⚙️" }
    );
  }

  return items;
}

// ============================================================================
// PAGE TITLES CONFIG
// ============================================================================

function getPageTitle(pathname: string): string {
  // Handle dynamic routes
  if (pathname.match(/^\/admin\/identities\/[^/]+\/edit$/)) return "Edit Identity";
  if (pathname.match(/^\/admin\/identities\/[^/]+$/)) return "Identity Details";
  if (pathname === "/admin/identities/new") return "New Identity Profile";

  const titles: Record<string, string> = {
    "/admin": "Dashboard",
    "/admin/identities": "Identity Profiles",
    "/admin/ad-accounts": "Account Profiles",
    "/admin/team": "Team Management",
    "/admin/settings": "Settings",
    "/admin/my-accounts": "My Accounts",
    "/admin/requests": "My Requests",
    "/admin/requests/admin": "Account Requests",
    "/admin/system": "System Overview",
    "/admin/sms": "SMS Verifications",
  };

  return titles[pathname] || "Admin";
}

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);
  const [criticalAlertsCount, setCriticalAlertsCount] = useState(0);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

  const userRole = (session?.user?.role as UserRole) || "SUPER_ADMIN";
  const userId = session?.user?.id || null;
  const navItems = getNavItems(userRole);
  const pageTitle = getPageTitle(pathname);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
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
  }, []);

  // Fetch alerts count
  const fetchAlertsCounts = useCallback(async () => {
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
  }, []);

  // Mark notification as read
  async function markAsRead(notificationId: string) {
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, isRead: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${notificationId}`, { method: "PATCH" });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      fetchNotifications();
    }
  }

  // Mark all as read
  async function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      fetchNotifications();
    }
  }

  // Fetch on mount and periodically
  useEffect(() => {
    fetchNotifications();
    fetchAlertsCounts();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchAlertsCounts();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchAlertsCounts]);

  // Real-time notifications
  useRealtimeNotifications(userId, () => {
    fetchNotifications();
  });

  // Refresh function for child routes
  const refreshData = useCallback(() => {
    fetchNotifications();
    fetchAlertsCounts();
  }, [fetchNotifications, fetchAlertsCounts]);

  // Check if current path is active (or a child of the nav item)
  function isActive(href: string): boolean {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  }

  return (
    <AdminLayoutContext.Provider value={{ userRole, refreshData }}>
      <div className="h-screen flex bg-slate-950 text-slate-100 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950/90 flex flex-col overflow-hidden">
          <div className="h-16 flex-shrink-0 px-6 flex items-center gap-3 border-b border-slate-800">
            <SquareMLogoIcon size={40} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-emerald-400">Magimanager</span>
              <span className="text-xs text-slate-400">Account Factory Console</span>
            </div>
          </div>

          <nav className="flex-1 mt-4 space-y-1 px-3 overflow-y-auto">
            {navItems.map((item) => (
              item.comingSoon ? (
                <button
                  key={item.href}
                  disabled
                  className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed opacity-60"
                >
                  <span className="text-base grayscale">{item.icon}</span>
                  <span className="flex items-center gap-2">
                    {item.label}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded uppercase tracking-wide">
                      Soon
                    </span>
                  </span>
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive(item.href)
                      ? "bg-slate-800 text-white"
                      : "text-slate-200 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            ))}
          </nav>

          <div className="flex-shrink-0 w-full px-4 py-3 border-t border-slate-800 space-y-2">
            {/* User Profile Button */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="w-full px-3 py-2 bg-slate-800/80 rounded-lg hover:bg-slate-700 transition text-left"
            >
              <div className="text-sm font-medium text-slate-100">{session?.user?.name || "User"}</div>
              <div className="text-xs text-slate-400">{session?.user?.email || "No email"}</div>
            </button>

            {/* MagiManager Ads Console Button */}
            <a
              href={`${KADABRA_URL}/admin`}
              className="block w-full px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-500 hover:to-teal-500 transition text-sm text-center"
            >
              <span className="font-semibold">MagiManager Ads Console</span>
            </a>

            {/* Logout Button */}
            <button
              onClick={() => {
                window.location.href = "/logout";
              }}
              className="w-full px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm flex items-center justify-center gap-2"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>

            {/* Version Info */}
            <div className="text-[10px] text-center text-slate-500">
              ABRA v{APP_VERSION} · {BUILD_SHA?.slice(0, 7) || "local"}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Top bar */}
          <header className="h-16 flex-shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950">
            <div>
              {pathname === "/admin/sms" ? (
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-slate-400">{pageTitle}</h1>
                  <span className="px-2 py-0.5 text-xs font-bold bg-red-500/20 text-red-400 rounded uppercase">Coming Soon</span>
                </div>
              ) : (
                <h1 className="text-lg font-semibold text-slate-50">{pageTitle}</h1>
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

                    {/* Needs Attention Alerts */}
                    {alertsCount > 0 && (
                      <Link
                        href="/admin/ad-accounts"
                        onClick={() => setShowNotifications(false)}
                        className={`p-3 border-b cursor-pointer hover:bg-slate-800/50 transition ${
                          criticalAlertsCount > 0 ? "bg-rose-500/10 border-rose-500/30" : "bg-amber-500/10 border-amber-500/30"
                        }`}
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
                      </Link>
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
                href={`${KADABRA_URL}/admin`}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg transition flex flex-col items-center"
              >
                <span className="text-xs font-semibold">Kadabra</span>
                <span className="text-[9px] opacity-80">Ad Manager</span>
              </a>
            </div>
          </header>

          {/* Page body */}
          <div className="flex-1 overflow-y-auto px-8 py-8 bg-slate-950">
            {children}
          </div>
        </main>

        {/* Profile Modal */}
        {showProfileModal && session?.user && (
          <ProfileModal
            onClose={() => setShowProfileModal(false)}
            user={{
              name: session.user.name || "",
              email: session.user.email || "",
            }}
            onUpdate={() => {
              window.location.reload();
            }}
          />
        )}
      </div>
    </AdminLayoutContext.Provider>
  );
}
