"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChatWindowBar,
  createChatWindow,
  findExistingWindow,
  bringWindowToFront,
} from "../../lib/chat-window-bar";
import type { ChatWindow } from "../../lib/chat-types";
import { ProfileModal } from "@magimanager/features";
import { formatCid } from "@magimanager/shared";
import { RequestModal } from "../../lib/kadabra-ui";
import type { AdAccount, Notification, AccountRequest } from "../../lib/kadabra-ui";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";

// ============================================================================
// CONTEXT TYPE
// ============================================================================

type KadabraLayoutContextType = {
  // Data
  accounts: AdAccount[];
  requests: AccountRequest[];
  notifications: Notification[];
  loading: boolean;
  unreadCount: number;

  // Selected account (for detail view)
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;

  // Modal controls
  showRequestModal: boolean;
  setShowRequestModal: (show: boolean) => void;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;

  // Actions
  fetchData: () => Promise<void>;
  handleCreateRequest: (justification: string) => Promise<void>;
  handleMarkNotificationRead: (id: string) => Promise<void>;

  // Chat
  openChatForAccount: (account: AdAccount) => void;
  openGeneralChat: () => void;
  openChatWithContext: (entityId: string | null, title: string, context: string) => void;

  // Session
  user: { name?: string; email?: string; role?: string } | undefined;
  updateSession: () => void;
};

const KadabraLayoutContext = createContext<KadabraLayoutContextType | null>(null);

export function useKadabraLayout() {
  const context = useContext(KadabraLayoutContext);
  if (!context) {
    throw new Error("useKadabraLayout must be used within KadabraLayoutProvider");
  }
  return context;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function KadabraLayoutProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Data state
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Chat windows
  const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);

  // Helper to format currency
  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  // Fetch data
  const fetchData = useCallback(async () => {
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
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, fetchData]);

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
              router.push("/admin/tools/video-clipper");
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
  }, [router]);

  // Mark all notifications as read when on notifications page
  useEffect(() => {
    if (pathname === "/admin/notifications" && notifications.some((n) => !n.isRead)) {
      handleMarkAllNotificationsRead();
    }
  }, [pathname, notifications]);

  // Request handlers
  const handleCreateRequest = useCallback(async (justification: string) => {
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
  }, [fetchData]);

  const handleMarkNotificationRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark notification read:", error);
    }
  }, []);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
    } catch (error) {
      console.error("Failed to mark all notifications read:", error);
    }
  }, []);

  // Chat window management
  const openChatForAccount = useCallback((account: AdAccount) => {
    const accountName = `MM${String(account.internalId).padStart(3, "0")}`;
    const existing = findExistingWindow(chatWindows, account.id);

    if (existing) {
      setChatWindows(bringWindowToFront(chatWindows, existing.id));
    } else {
      const context = `Tell me about account ${accountName} (CID: ${formatCid(account.googleCid)}). It has ${account.campaignsCount} campaigns and ${account.adsCount} ads, with total spend of ${formatCurrency(account.currentSpendTotal)}.`;
      const newWindow = createChatWindow(account.id, accountName, context);
      setChatWindows([...chatWindows, newWindow]);
    }
  }, [chatWindows]);

  const openGeneralChat = useCallback(() => {
    const existing = findExistingWindow(chatWindows, null);

    if (existing) {
      setChatWindows(bringWindowToFront(chatWindows, existing.id));
    } else {
      const newWindow = createChatWindow(null, "Magimanager AI");
      setChatWindows([...chatWindows, newWindow]);
    }
  }, [chatWindows]);

  const openChatWithContext = useCallback((entityId: string | null, title: string, context: string) => {
    const newWindow = createChatWindow(entityId, title, context);
    setChatWindows([...chatWindows, newWindow]);
  }, [chatWindows]);

  const closeChatWindow = useCallback((windowId: string) => {
    setChatWindows(chatWindows.filter((w) => w.id !== windowId));
  }, [chatWindows]);

  const toggleMinimize = useCallback((windowId: string) => {
    setChatWindows(
      chatWindows.map((w) =>
        w.id === windowId ? { ...w, isMinimized: !w.isMinimized } : w
      )
    );
  }, [chatWindows]);

  const updateChatWindow = useCallback((windowId: string, updates: Partial<ChatWindow>) => {
    setChatWindows(
      chatWindows.map((w) =>
        w.id === windowId ? { ...w, ...updates } : w
      )
    );
  }, [chatWindows]);

  const handleSendChatMessage = useCallback(async (windowId: string, messageText: string) => {
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
  }, []);

  // Computed values
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Auth loading state
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

  const contextValue: KadabraLayoutContextType = {
    accounts,
    requests,
    notifications,
    loading,
    unreadCount,
    selectedAccountId,
    setSelectedAccountId,
    showRequestModal,
    setShowRequestModal,
    showProfileModal,
    setShowProfileModal,
    fetchData,
    handleCreateRequest,
    handleMarkNotificationRead,
    openChatForAccount,
    openGeneralChat,
    openChatWithContext,
    user,
    updateSession,
  };

  return (
    <KadabraLayoutContext.Provider value={contextValue}>
      {children}

      {/* Chat Window Bar (global, always rendered) */}
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
            updateSession();
          }}
        />
      )}
    </KadabraLayoutContext.Provider>
  );
}
