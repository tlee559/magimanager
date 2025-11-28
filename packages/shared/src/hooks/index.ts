// ============================================================================
// HOOKS INDEX - Export all React Query hooks
// ============================================================================

// Identity hooks
export {
  identityKeys,
  useIdentities,
  useIdentity,
  useCreateIdentity,
  useUpdateIdentity,
  useDeleteIdentity,
  useArchiveIdentity,
  useUnarchiveIdentity,
  useUploadDocument,
  useDeleteDocument,
  useCreateGoLoginProfile,
  useDeleteGoLoginProfile,
  useLaunchGoLoginProfile,
} from "./use-identities";

// Account hooks
export {
  accountKeys,
  useAccounts,
  useAccount,
  useNeedsAttention,
  useAccountThread,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useAssignAccount,
  useCheckIn,
  useBulkCheckIn,
  useLogActivity,
  useSimulateWarmup,
  useDismissAlert,
  useCreateMessage,
  useUpdateMessage,
  useDeleteMessage,
  useLaunchOAuth,
  useSyncAccount,
} from "./use-accounts";

// Notification hooks
export {
  notificationKeys,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from "./use-notifications";
