// ============================================================================
// ACCOUNTS API - Client-side API calls for Account operations
// ============================================================================

import { api } from "./client";
import type {
  AdAccount,
  AdAccountCreateInput,
  AdAccountUpdateInput,
  CheckIn,
  AccountActivity,
  NeedsAttentionAccount,
  AlertsSummary,
  AlertType,
} from "../types";

interface AccountsResponse {
  accounts?: AdAccount[];
}

interface NeedsAttentionResponse {
  accounts: NeedsAttentionAccount[];
  summary: AlertsSummary;
}

interface ThreadResponse {
  id: string;
  messages: Array<{
    id: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  }>;
}

export const accountsApi = {
  // Get all accounts
  getAll: (options?: { unassigned?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.unassigned) params.set("unassigned", "true");
    const query = params.toString();
    return api.get<AdAccount[] | AccountsResponse>(
      `/api/accounts${query ? `?${query}` : ""}`
    );
  },

  // Get single account
  getById: (id: string) => api.get<AdAccount>(`/api/accounts/${id}`),

  // Create account
  create: (data: AdAccountCreateInput) =>
    api.post<AdAccount>("/api/accounts", data),

  // Update account
  update: (id: string, data: AdAccountUpdateInput) =>
    api.patch<AdAccount>(`/api/accounts/${id}`, data),

  // Delete account
  delete: (id: string) => api.delete<void>(`/api/accounts/${id}`),

  // Update notes
  updateNotes: (id: string, notes: string) =>
    api.patch<void>(`/api/accounts/${id}/notes`, { notes }),

  // Assign to media buyer
  assign: (id: string, mediaBuyerId: string, notes?: string) =>
    api.post<AdAccount>(`/api/accounts/${id}/assign`, { mediaBuyerId, notes }),

  // Check-in
  checkIn: (id: string, data: {
    dailySpend: number;
    totalSpend: number;
    adsCount: number;
    campaignsCount?: number;
    accountHealth: string;
    billingStatus: string;
    certStatus?: string | null;
    issues?: string | null;
    notes?: string | null;
  }) => api.post<CheckIn>(`/api/accounts/${id}/check-in`, data),

  // Bulk check-in
  bulkCheckIn: (accounts: Array<{
    id: string;
    dailySpend: number;
    totalSpend: number;
    adsCount: number;
    accountHealth: string;
    billingStatus: string;
  }>) => api.post<{ success: number; failed: number }>("/api/accounts/bulk-check-in", { accounts }),

  // Activity log
  getActivity: (id: string) =>
    api.get<{ activities: AccountActivity[] }>(`/api/accounts/${id}/activity`),

  logActivity: (id: string, action: string, details?: string) =>
    api.post<AccountActivity>(`/api/accounts/${id}/activity`, { action, details }),

  // Simulate warmup
  simulateWarmup: (id: string, amount: number) =>
    api.post<AdAccount>(`/api/accounts/${id}/simulate-warmup`, { amount }),

  // Needs attention / alerts
  getNeedsAttention: () =>
    api.get<NeedsAttentionResponse>("/api/accounts/needs-attention"),

  dismissAlert: (accountId: string, alertType: AlertType) =>
    api.post<void>("/api/accounts/alerts/dismiss", { accountId, alertType }),

  // Thread / messages
  getThread: (id: string) =>
    api.get<ThreadResponse>(`/api/accounts/${id}/thread`),

  createMessage: (id: string, message: string) =>
    api.post<{ id: string }>(`/api/accounts/${id}/thread/messages`, { message }),

  updateMessage: (accountId: string, messageId: string, message: string) =>
    api.patch<void>(`/api/accounts/${accountId}/thread/messages/${messageId}`, { message }),

  deleteMessage: (accountId: string, messageId: string) =>
    api.delete<void>(`/api/accounts/${accountId}/thread/messages/${messageId}`),

  // OAuth / Sync
  launchOAuth: (id: string) =>
    api.post<{ authUrl: string }>(`/api/accounts/${id}/launch-oauth`),

  sync: (id: string) =>
    api.post<AdAccount>(`/api/accounts/${id}/sync`),
};
