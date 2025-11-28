// ============================================================================
// NOTIFICATIONS API - Client-side API calls for Notification operations
// ============================================================================

import { api } from "./client";
import type { Notification } from "@magimanager/shared";

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export const notificationsApi = {
  // Get all notifications for current user
  getAll: () => api.get<NotificationsResponse>("/api/notifications"),

  // Mark single notification as read
  markAsRead: (id: string) => api.patch<void>(`/api/notifications/${id}`),

  // Mark all notifications as read
  markAllAsRead: () => api.patch<void>("/api/notifications/read-all"),

  // Delete notification
  delete: (id: string) => api.delete<void>(`/api/notifications/${id}`),
};
