"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ProfileModal } from "@magimanager/features";
import Link from "next/link";
import {
  LayoutDashboard,
  Briefcase,
  Bell,
  PlusCircle,
  LogOut,
  Zap,
  Sparkles,
  ListChecks,
  Wrench,
} from "lucide-react";
import {
  ChatWindowBar,
  createChatWindow,
  findExistingWindow,
  bringWindowToFront,
} from "@/lib/chat-window-bar";
import type { ChatWindow } from "@/lib/chat-types";
import { ABRA_URL, APP_VERSION, BUILD_SHA } from "@/lib/constants";
import { formatCid } from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

type AdAccount = {
  id: string;
  internalId: number;
  googleCid: string | null;
  campaignsCount: number;
  adsCount: number;
  currentSpendTotal: number;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type KadabraLayoutContextType = {
  chatWindows: ChatWindow[];
  openChatForAccount: (account: AdAccount) => void;
  openGeneralChat: () => void;
  refreshData: () => void;
};

const KadabraLayoutContext = createContext<KadabraLayoutContextType | null>(null);

export function useKadabraLayout() {
  const ctx = useContext(KadabraLayoutContext);
  return ctx;
}

// ============================================================================
// HELPER
// ============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// ============================================================================
// LOGO COMPONENT
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
// NAVIGATION CONFIG
// ============================================================================

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  divider?: boolean;
};

function getNavItems(unreadCount: number, queueCount: number): NavItem[] {
  return [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/accounts", label: "My Accounts", icon: Briefcase, divider: true },
    { href: "/admin/automations", label: "Automations", icon: Zap },
    { href: "/admin/tools", label: "Tools", icon: Wrench },
    { href: "/admin/action-queue", label: "Action Queue", icon: ListChecks, badge: queueCount > 0 ? queueCount : undefined, divider: true },
    { href: "/admin/requests", label: "Requests", icon: PlusCircle },
    { href: "/admin/notifications", label: "Notifications", icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
  ];
}

// ============================================================================
// PAGE TITLES CONFIG
// ============================================================================

function getPageInfo(pathname: string): { title: string; subtitle: string } {
  // Handle dynamic routes
  if (pathname.match(/^\/admin\/accounts\/[^/]+$/)) {
    return { title: "Account Details", subtitle: "View campaigns, ad groups, and ads for this account" };
  }
  if (pathname.match(/^\/admin\/campaigns/)) {
    return { title: "Campaign Manager", subtitle: "Manage your Google Ads campaigns" };
  }

  const pageInfo: Record<string, { title: string; subtitle: string }> = {
    "/admin": { title: "Dashboard", subtitle: "Overview of your accounts and performance" },
    "/admin/accounts": { title: "My Accounts", subtitle: "Manage your assigned Google Ads accounts" },
    "/admin/automations": { title: "Automations", subtitle: "Monitor your campaigns with intelligent rules" },
    "/admin/tools": { title: "Tools", subtitle: "Utilities and integrations for account management" },
    "/admin/tools/campaign-planner": { title: "Campaign Planner AI", subtitle: "Create AI-powered campaign plans with keywords and ad copy" },
    "/admin/tools/video-clipper": { title: "Video Clipper AI", subtitle: "Transform long videos into high-converting vertical clips" },
    "/admin/action-queue": { title: "Action Queue", subtitle: "Copy-paste ready fixes to apply in Google Ads" },
    "/admin/requests": { title: "Account Requests", subtitle: "Request new accounts or claim existing ones" },
    "/admin/notifications": { title: "Notifications", subtitle: "Stay updated with account activities and alerts" },
  };

  return pageInfo[pathname] || { title: "Admin", subtitle: "" };
}

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

export default function KadabraLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status, update: updateSession } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const queueCount = 0; // Mock for now
  const navItems = getNavItems(unreadCount, queueCount);
  const pageInfo = getPageInfo(pathname);

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchNotifications();
    }
  }, [status, fetchNotifications]);

  // Mark all as read when viewing notifications page
  useEffect(() => {
    if (pathname === "/admin/notifications" && notifications.some((n) => !n.isRead)) {
      fetch("/api/notifications/read-all", { method: "PATCH" }).then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      });
    }
  }, [pathname, notifications]);

  // ============================================================================
  // CHAT WINDOW MANAGEMENT
  // ============================================================================

  function openChatForAccount(account: AdAccount) {
    const accountName = `MM${String(account.internalId).padStart(3, "0")}`;
    const existing = findExistingWindow(chatWindows, account.id);

    if (existing) {
      setChatWindows(bringWindowToFront(chatWindows, existing.id));
    } else {
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

  // ============================================================================
  // AUTH CHECKS
  // ============================================================================

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return null;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function isActive(href: string): boolean {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    // Special case for tools submenu
    if (href === "/admin/tools") {
      return pathname === "/admin/tools" || pathname.startsWith("/admin/tools/");
    }
    return pathname.startsWith(href);
  }

  const refreshData = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <KadabraLayoutContext.Provider value={{ chatWindows, openChatForAccount, openGeneralChat, refreshData }}>
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
              <div key={item.href}>
                {item.divider && index > 0 && (
                  <div className="my-2 border-t border-slate-800" />
                )}
                <Link
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                    isActive(item.href)
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
                </Link>
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
              <h1 className="text-2xl font-bold text-slate-100">{pageInfo.title}</h1>
              {pageInfo.subtitle && (
                <p className="text-sm text-slate-500 mt-1">{pageInfo.subtitle}</p>
              )}
            </div>

            {/* Page Content */}
            {children}
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

        {/* Profile Modal */}
        {showProfileModal && user && (
          <ProfileModal
            onClose={() => setShowProfileModal(false)}
            user={{
              name: user.name || "",
              email: user.email || "",
            }}
            onUpdate={() => {
              updateSession();
            }}
          />
        )}
      </div>
    </KadabraLayoutContext.Provider>
  );
}
