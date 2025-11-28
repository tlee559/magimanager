// ============================================================================
// HOOKS INDEX - Central export for all custom hooks
// ============================================================================

// Identity hooks
export {
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
  identityKeys,
} from "./use-identities";

// Account hooks
export {
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
  accountKeys,
} from "./use-accounts";

// Notification hooks
export {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  notificationKeys,
} from "./use-notifications";
