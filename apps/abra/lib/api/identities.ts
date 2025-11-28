// ============================================================================
// IDENTITIES API - Client-side API calls for Identity operations
// ============================================================================

import { api, uploadFormData } from "./client";
import type { Identity, IdentityCreateInput, IdentityUpdateInput, IdentityDocument } from "@magimanager/shared";

interface IdentitiesResponse {
  identities: Identity[];
}

export const identitiesApi = {
  // Get all identities
  getAll: () => api.get<IdentitiesResponse>("/api/identities"),

  // Get single identity
  getById: (id: string) => api.get<Identity>(`/api/identities/${id}`),

  // Create identity with optional documents
  create: async (data: IdentityCreateInput, documents?: File[]) => {
    const formData = new FormData();

    // Add form fields
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    // Add documents if provided
    if (documents && documents.length > 0) {
      documents.forEach((doc) => {
        formData.append("documents", doc);
      });
    }

    return uploadFormData<Identity>("/api/identities", formData);
  },

  // Update identity
  update: async (id: string, data: IdentityUpdateInput) => {
    return api.put<Identity>(`/api/identities/${id}`, data);
  },

  // Delete identity
  delete: (id: string) => api.delete<void>(`/api/identities/${id}`),

  // Archive identity
  archive: (id: string) =>
    api.patch<Identity>(`/api/identities/${id}`, { archived: true }),

  // Unarchive identity
  unarchive: (id: string) =>
    api.patch<Identity>(`/api/identities/${id}`, { archived: false }),

  // Upload document
  uploadDocument: async (identityId: string, file: File) => {
    const formData = new FormData();
    formData.append("document", file);
    return uploadFormData<IdentityDocument>(
      `/api/identities/${identityId}/documents`,
      formData
    );
  },

  // Delete document
  deleteDocument: (identityId: string, documentId: string) =>
    api.delete<void>(`/api/identities/${identityId}/documents/${documentId}`),

  // GoLogin operations
  gologin: {
    create: (identityId: string) =>
      api.post<{ profileId: string }>(`/api/identities/${identityId}/gologin`),

    delete: (identityId: string) =>
      api.delete<void>(`/api/identities/${identityId}/gologin`),

    launch: (identityId: string) =>
      api.post<{ wsUrl: string }>(`/api/identities/${identityId}/gologin/launch`),

    updateProxy: (identityId: string, proxy: {
      mode: string;
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      country?: string;
    }) =>
      api.patch<void>(`/api/identities/${identityId}/gologin/proxy`, proxy),

    refreshFingerprint: (identityId: string) =>
      api.post<void>(`/api/identities/${identityId}/gologin/fingerprint`),
  },

  // Phone verification
  phoneVerification: {
    start: (identityId: string, service: string) =>
      api.post<{ phone: string; verificationId: string }>(
        `/api/identities/${identityId}/phone-verification`,
        { service }
      ),

    check: (identityId: string) =>
      api.get<{ status: string; code?: string }>(
        `/api/identities/${identityId}/phone-verification`
      ),

    cancel: (identityId: string) =>
      api.delete<void>(`/api/identities/${identityId}/phone-verification`),
  },
};
