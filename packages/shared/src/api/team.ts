// ============================================================================
// TEAM API - Client-side API calls for Team/User operations
// ============================================================================

import { api } from "./client";
import type { User, UserCreateInput, UserUpdateInput, UserRole, MediaBuyer } from "../types";

interface TeamResponse {
  users: User[];
}

export const teamApi = {
  // Get all team members
  getAll: () => api.get<TeamResponse>("/api/team"),

  // Get single user
  getById: (id: string) => api.get<User>(`/api/team/${id}`),

  // Create user
  create: (data: UserCreateInput) => api.post<User>("/api/team", data),

  // Update user
  update: (id: string, data: UserUpdateInput) =>
    api.patch<User>(`/api/team/${id}`, data),

  // Delete user
  delete: (id: string) => api.delete<void>(`/api/team/${id}`),

  // Reset password (admin action)
  resetPassword: (id: string) =>
    api.post<{ temporaryPassword: string }>(`/api/team/${id}/reset-password`),

  // Change own password
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>("/api/team/change-password", { currentPassword, newPassword }),

  // Update role
  updateRole: (id: string, role: UserRole) =>
    api.patch<User>(`/api/team/${id}`, { role }),

  // Deactivate user
  deactivate: (id: string) =>
    api.patch<User>(`/api/team/${id}`, { status: "INACTIVE" }),

  // Activate user
  activate: (id: string) =>
    api.patch<User>(`/api/team/${id}`, { status: "ACTIVE" }),
};

export const mediaBuyersApi = {
  // Get all media buyers
  getAll: () => api.get<{ mediaBuyers: MediaBuyer[] }>("/api/media-buyers"),

  // Get single media buyer
  getById: (id: string) => api.get<MediaBuyer>(`/api/media-buyers/${id}`),

  // Create media buyer
  create: (data: { name: string; email: string; phone?: string; notes?: string }) =>
    api.post<MediaBuyer>("/api/media-buyers", data),

  // Update media buyer
  update: (id: string, data: Partial<{ name: string; email: string; phone: string; notes: string; isActive: boolean }>) =>
    api.patch<MediaBuyer>(`/api/media-buyers/${id}`, data),

  // Delete media buyer
  delete: (id: string) => api.delete<void>(`/api/media-buyers/${id}`),
};
