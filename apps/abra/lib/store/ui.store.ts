// ============================================================================
// UI STORE - UI-specific state (modals, sidebars, filters, etc.)
// ============================================================================

import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ModalType =
  | "add-account"
  | "add-identity"
  | "add-team-member"
  | "edit-account"
  | "edit-identity"
  | "handoff-account"
  | "check-in"
  | "password-change"
  | "confirm-delete"
  | "oauth-connect"
  | null;

export interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;

  // Modals
  activeModal: ModalType;
  modalData: Record<string, unknown>;

  // Notifications panel
  showNotifications: boolean;

  // Filters (persisted per-view)
  identityFilters: {
    search: string;
    geo: string;
    showArchived: boolean;
    page: number;
  };
  accountFilters: {
    search: string;
    status: string;
    health: string;
    handoff: string;
    mediaBuyer: string;
    showArchived: boolean;
    showNeedsAttention: boolean;
    page: number;
  };
  teamFilters: {
    search: string;
    role: string;
    status: string;
    page: number;
  };

  // Loading states
  isLoading: Record<string, boolean>;

  // Toast messages
  toasts: Array<{
    id: string;
    type: "success" | "error" | "info" | "warning";
    message: string;
  }>;
}

export interface UIActions {
  // Sidebar
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Modals
  openModal: (type: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Notifications
  toggleNotifications: () => void;
  setShowNotifications: (show: boolean) => void;

  // Filters
  setIdentityFilters: (filters: Partial<UIState["identityFilters"]>) => void;
  resetIdentityFilters: () => void;
  setAccountFilters: (filters: Partial<UIState["accountFilters"]>) => void;
  resetAccountFilters: () => void;
  setTeamFilters: (filters: Partial<UIState["teamFilters"]>) => void;
  resetTeamFilters: () => void;

  // Loading
  setLoading: (key: string, isLoading: boolean) => void;

  // Toasts
  addToast: (type: UIState["toasts"][0]["type"], message: string) => void;
  removeToast: (id: string) => void;

  // Reset
  reset: () => void;
}

const initialIdentityFilters: UIState["identityFilters"] = {
  search: "",
  geo: "all",
  showArchived: false,
  page: 1,
};

const initialAccountFilters: UIState["accountFilters"] = {
  search: "",
  status: "all",
  health: "all",
  handoff: "all",
  mediaBuyer: "all",
  showArchived: false,
  showNeedsAttention: false,
  page: 1,
};

const initialTeamFilters: UIState["teamFilters"] = {
  search: "",
  role: "all",
  status: "all",
  page: 1,
};

const initialState: UIState = {
  sidebarCollapsed: false,
  activeModal: null,
  modalData: {},
  showNotifications: false,
  identityFilters: initialIdentityFilters,
  accountFilters: initialAccountFilters,
  teamFilters: initialTeamFilters,
  isLoading: {},
  toasts: [],
};

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    (set) => ({
      ...initialState,

      // Sidebar
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      // Modals
      openModal: (activeModal, modalData = {}) => set({ activeModal, modalData }),

      closeModal: () => set({ activeModal: null, modalData: {} }),

      // Notifications
      toggleNotifications: () =>
        set((state) => ({ showNotifications: !state.showNotifications })),

      setShowNotifications: (showNotifications) => set({ showNotifications }),

      // Identity Filters
      setIdentityFilters: (filters) =>
        set((state) => ({
          identityFilters: { ...state.identityFilters, ...filters },
        })),

      resetIdentityFilters: () => set({ identityFilters: initialIdentityFilters }),

      // Account Filters
      setAccountFilters: (filters) =>
        set((state) => ({
          accountFilters: { ...state.accountFilters, ...filters },
        })),

      resetAccountFilters: () => set({ accountFilters: initialAccountFilters }),

      // Team Filters
      setTeamFilters: (filters) =>
        set((state) => ({
          teamFilters: { ...state.teamFilters, ...filters },
        })),

      resetTeamFilters: () => set({ teamFilters: initialTeamFilters }),

      // Loading
      setLoading: (key, isLoading) =>
        set((state) => ({
          isLoading: { ...state.isLoading, [key]: isLoading },
        })),

      // Toasts
      addToast: (type, message) => {
        const id = Math.random().toString(36).slice(2, 9);
        set((state) => ({
          toasts: [...state.toasts, { id, type, message }],
        }));
        // Auto-remove after 5 seconds
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }));
        }, 5000);
      },

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      // Reset
      reset: () => set(initialState),
    }),
    { name: "UIStore" }
  )
);
