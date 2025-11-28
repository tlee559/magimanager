// ============================================================================
// APP STORE - Main application state (user, auth, navigation)
// ============================================================================

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { AdminView, UserRole, Notification } from "@magimanager/shared";

export interface AppState {
  // Navigation
  currentView: AdminView;
  previousView: AdminView | null;

  // User
  userId: string | null;
  userRole: UserRole | null;
  userName: string | null;
  userEmail: string | null;
  firstLogin: boolean;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  alertsCount: number;
  criticalAlertsCount: number;

  // Selected entities (for detail views)
  selectedIdentityId: string | null;
  selectedAccountId: string | null;
  pendingRequestId: string | null;
}

export interface AppActions {
  // Navigation
  setView: (view: AdminView) => void;
  goBack: () => void;

  // User
  setUser: (user: { id: string; role: UserRole; name: string; email: string; firstLogin?: boolean } | null) => void;
  setFirstLogin: (firstLogin: boolean) => void;

  // Notifications
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  setAlertsCount: (total: number, critical: number) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Selections
  setSelectedIdentityId: (id: string | null) => void;
  setSelectedAccountId: (id: string | null) => void;
  setPendingRequestId: (id: string | null) => void;

  // Reset
  reset: () => void;
}

const initialState: AppState = {
  currentView: "dashboard",
  previousView: null,
  userId: null,
  userRole: null,
  userName: null,
  userEmail: null,
  firstLogin: false,
  notifications: [],
  unreadCount: 0,
  alertsCount: 0,
  criticalAlertsCount: 0,
  selectedIdentityId: null,
  selectedAccountId: null,
  pendingRequestId: null,
};

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        // Navigation
        setView: (view) =>
          set((state) => ({
            previousView: state.currentView,
            currentView: view,
            // Clear selections when navigating to list views
            selectedIdentityId: view === "identities" ? null : state.selectedIdentityId,
            selectedAccountId: view === "ad-accounts" ? null : state.selectedAccountId,
          })),

        goBack: () =>
          set((state) => ({
            currentView: state.previousView || "dashboard",
            previousView: null,
          })),

        // User
        setUser: (user) =>
          set({
            userId: user?.id || null,
            userRole: user?.role || null,
            userName: user?.name || null,
            userEmail: user?.email || null,
            firstLogin: user?.firstLogin || false,
          }),

        setFirstLogin: (firstLogin) => set({ firstLogin }),

        // Notifications
        setNotifications: (notifications) => set({ notifications }),

        setUnreadCount: (unreadCount) => set({ unreadCount }),

        setAlertsCount: (alertsCount, criticalAlertsCount) =>
          set({ alertsCount, criticalAlertsCount }),

        markNotificationRead: (id) =>
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          })),

        markAllNotificationsRead: () =>
          set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
          })),

        // Selections
        setSelectedIdentityId: (selectedIdentityId) => set({ selectedIdentityId }),
        setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
        setPendingRequestId: (pendingRequestId) => set({ pendingRequestId }),

        // Reset
        reset: () => set(initialState),
      }),
      {
        name: "magimanager-app-store",
        partialize: (state) => ({
          // Only persist navigation state
          currentView: state.currentView,
        }),
      }
    ),
    { name: "AppStore" }
  )
);
