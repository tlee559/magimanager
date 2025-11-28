"use client";

// ============================================================================
// USE ACCOUNTS - React Query hooks for Account operations
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsApi } from "../api";
import type { AdAccountCreateInput, AdAccountUpdateInput, AlertType } from "../types";

// Query keys
export const accountKeys = {
  all: ["accounts"] as const,
  lists: () => [...accountKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) => [...accountKeys.lists(), filters] as const,
  details: () => [...accountKeys.all, "detail"] as const,
  detail: (id: string) => [...accountKeys.details(), id] as const,
  needsAttention: () => [...accountKeys.all, "needs-attention"] as const,
  thread: (id: string) => [...accountKeys.all, "thread", id] as const,
};

// Get all accounts
export function useAccounts(options?: { unassigned?: boolean }) {
  return useQuery({
    queryKey: accountKeys.list(options),
    queryFn: async () => {
      const response = await accountsApi.getAll(options);
      // Handle both response formats
      return Array.isArray(response) ? response : (response.accounts || []);
    },
    staleTime: 30000,
  });
}

// Get single account
export function useAccount(id: string | null) {
  return useQuery({
    queryKey: accountKeys.detail(id || ""),
    queryFn: () => accountsApi.getById(id!),
    enabled: !!id,
    staleTime: 30000,
  });
}

// Get needs attention accounts
export function useNeedsAttention() {
  return useQuery({
    queryKey: accountKeys.needsAttention(),
    queryFn: () => accountsApi.getNeedsAttention(),
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Auto-refetch every minute
  });
}

// Get account thread
export function useAccountThread(id: string | null) {
  return useQuery({
    queryKey: accountKeys.thread(id || ""),
    queryFn: () => accountsApi.getThread(id!),
    enabled: !!id,
    staleTime: 10000,
  });
}

// Create account
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdAccountCreateInput) => accountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}

// Update account
export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdAccountUpdateInput }) =>
      accountsApi.update(id, data),
    onSuccess: (updatedAccount) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.setQueryData(accountKeys.detail(updatedAccount.id), updatedAccount);
    },
  });
}

// Delete account
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => accountsApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.removeQueries({ queryKey: accountKeys.detail(id) });
    },
  });
}

// Assign to media buyer
export function useAssignAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      mediaBuyerId,
      notes,
    }: {
      id: string;
      mediaBuyerId: string;
      notes?: string;
    }) => accountsApi.assign(id, mediaBuyerId, notes),
    onSuccess: (updatedAccount) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.setQueryData(accountKeys.detail(updatedAccount.id), updatedAccount);
      queryClient.invalidateQueries({ queryKey: accountKeys.needsAttention() });
    },
  });
}

// Check-in
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        dailySpend: number;
        totalSpend: number;
        adsCount: number;
        campaignsCount?: number;
        accountHealth: string;
        billingStatus: string;
        certStatus?: string | null;
        issues?: string | null;
        notes?: string | null;
      };
    }) => accountsApi.checkIn(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: accountKeys.needsAttention() });
    },
  });
}

// Bulk check-in
export function useBulkCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      accounts: Array<{
        id: string;
        dailySpend: number;
        totalSpend: number;
        adsCount: number;
        accountHealth: string;
        billingStatus: string;
      }>
    ) => accountsApi.bulkCheckIn(accounts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.needsAttention() });
    },
  });
}

// Log activity
export function useLogActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      action,
      details,
    }: {
      id: string;
      action: string;
      details?: string;
    }) => accountsApi.logActivity(id, action, details),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(id) });
    },
  });
}

// Simulate warmup
export function useSimulateWarmup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      accountsApi.simulateWarmup(id, amount),
    onSuccess: (updatedAccount) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.setQueryData(accountKeys.detail(updatedAccount.id), updatedAccount);
    },
  });
}

// Dismiss alert
export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, alertType }: { accountId: string; alertType: AlertType }) =>
      accountsApi.dismissAlert(accountId, alertType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.needsAttention() });
    },
  });
}

// Thread messages
export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, message }: { accountId: string; message: string }) =>
      accountsApi.createMessage(accountId, message),
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.thread(accountId) });
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      messageId,
      message,
    }: {
      accountId: string;
      messageId: string;
      message: string;
    }) => accountsApi.updateMessage(accountId, messageId, message),
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.thread(accountId) });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, messageId }: { accountId: string; messageId: string }) =>
      accountsApi.deleteMessage(accountId, messageId),
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.thread(accountId) });
    },
  });
}

// OAuth / Sync
export function useLaunchOAuth() {
  return useMutation({
    mutationFn: (id: string) => accountsApi.launchOAuth(id),
  });
}

export function useSyncAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => accountsApi.sync(id),
    onSuccess: (updatedAccount) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.setQueryData(accountKeys.detail(updatedAccount.id), updatedAccount);
    },
  });
}
