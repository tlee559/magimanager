// ============================================================================
// USE NOTIFICATIONS - React Query hooks for Notification operations
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";

// Query keys
export const notificationKeys = {
  all: ["notifications"] as const,
};

// Get all notifications
export function useNotifications() {
  const { setNotifications, setUnreadCount } = useAppStore();

  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: async () => {
      const response = await notificationsApi.getAll();
      // Update store with fetched data
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
      return response;
    },
    staleTime: 30000,
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

// Mark single notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { markNotificationRead } = useAppStore();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onMutate: (id) => {
      // Optimistic update
      markNotificationRead(id);
    },
    onError: () => {
      // Refetch on error to revert optimistic update
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// Mark all notifications as read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { markAllNotificationsRead } = useAppStore();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onMutate: () => {
      // Optimistic update
      markAllNotificationsRead();
    },
    onError: () => {
      // Refetch on error to revert optimistic update
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// Delete notification
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
