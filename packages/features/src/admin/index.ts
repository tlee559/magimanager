// Admin feature module exports
export { AdminApp } from "./admin-ui";
export { useModal, ModalProvider } from "./modal-context";
export { AdAccountsView } from "./ad-accounts-view";
export { AddAccountModal } from "./add-account-modal";
export { ProfileModal } from "./profile-modal";
export {
  Skeleton,
  SkeletonStatCards,
  SkeletonIdentitiesTable,
  SkeletonAccountsTable,
  SkeletonTeamTable,
  SkeletonRecentIdentities,
  SkeletonSettingsForm,
  SkeletonIdentityDetail,
  SkeletonNotifications,
  SkeletonTableRows,
  SkeletonOperationsTable,
  SkeletonAlertCards,
  SkeletonTimeline,
  SkeletonCheckInHistory,
  LoadingSpinner,
} from "./skeleton-loaders";

// Individual view exports for URL-based routing
export {
  TeamView,
  SystemView,
  SettingsView,
  MyAccountsView,
  MyRequestsView,
  AdminRequestsView,
  IdentitiesListView,
  CreateIdentityView,
  IdentityDetailView,
  EditIdentityView,
} from "./admin-ui";
