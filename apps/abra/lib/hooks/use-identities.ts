// ============================================================================
// USE IDENTITIES - React Query hooks for Identity operations
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { identitiesApi } from "@/lib/api";
import type { Identity, IdentityCreateInput, IdentityUpdateInput } from "@magimanager/shared";

// Query keys
export const identityKeys = {
  all: ["identities"] as const,
  lists: () => [...identityKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) => [...identityKeys.lists(), filters] as const,
  details: () => [...identityKeys.all, "detail"] as const,
  detail: (id: string) => [...identityKeys.details(), id] as const,
};

// Get all identities
export function useIdentities() {
  return useQuery({
    queryKey: identityKeys.lists(),
    queryFn: async () => {
      const response = await identitiesApi.getAll();
      return response.identities;
    },
    staleTime: 30000, // 30 seconds
  });
}

// Get single identity
export function useIdentity(id: string | null) {
  return useQuery({
    queryKey: identityKeys.detail(id || ""),
    queryFn: () => identitiesApi.getById(id!),
    enabled: !!id,
    staleTime: 30000,
  });
}

// Create identity
export function useCreateIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, documents }: { data: IdentityCreateInput; documents?: File[] }) =>
      identitiesApi.create(data, documents),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: identityKeys.lists() });
    },
  });
}

// Update identity
export function useUpdateIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: IdentityUpdateInput }) =>
      identitiesApi.update(id, data),
    onSuccess: (updatedIdentity) => {
      queryClient.invalidateQueries({ queryKey: identityKeys.lists() });
      queryClient.setQueryData(identityKeys.detail(updatedIdentity.id), updatedIdentity);
    },
  });
}

// Delete identity
export function useDeleteIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => identitiesApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: identityKeys.lists() });
      queryClient.removeQueries({ queryKey: identityKeys.detail(id) });
    },
  });
}

// Archive identity
export function useArchiveIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => identitiesApi.archive(id),
    onSuccess: (updatedIdentity) => {
      queryClient.invalidateQueries({ queryKey: identityKeys.lists() });
      queryClient.setQueryData(identityKeys.detail(updatedIdentity.id), updatedIdentity);
    },
  });
}

// Unarchive identity
export function useUnarchiveIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => identitiesApi.unarchive(id),
    onSuccess: (updatedIdentity) => {
      queryClient.invalidateQueries({ queryKey: identityKeys.lists() });
      queryClient.setQueryData(identityKeys.detail(updatedIdentity.id), updatedIdentity);
    },
  });
}

// Upload document
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ identityId, file }: { identityId: string; file: File }) =>
      identitiesApi.uploadDocument(identityId, file),
    onSuccess: (_, { identityId }) => {
      queryClient.invalidateQueries({ queryKey: identityKeys.detail(identityId) });
    },
  });
}

// Delete document
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ identityId, documentId }: { identityId: string; documentId: string }) =>
      identitiesApi.deleteDocument(identityId, documentId),
    onSuccess: (_, { identityId }) => {
      queryClient.invalidateQueries({ queryKey: identityKeys.detail(identityId) });
    },
  });
}

// GoLogin operations
export function useCreateGoLoginProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (identityId: string) => identitiesApi.gologin.create(identityId),
    onSuccess: (_, identityId) => {
      queryClient.invalidateQueries({ queryKey: identityKeys.detail(identityId) });
    },
  });
}

export function useDeleteGoLoginProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (identityId: string) => identitiesApi.gologin.delete(identityId),
    onSuccess: (_, identityId) => {
      queryClient.invalidateQueries({ queryKey: identityKeys.detail(identityId) });
    },
  });
}

export function useLaunchGoLoginProfile() {
  return useMutation({
    mutationFn: (identityId: string) => identitiesApi.gologin.launch(identityId),
  });
}
