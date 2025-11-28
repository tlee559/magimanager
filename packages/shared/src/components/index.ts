// ============================================================================
// COMPONENTS INDEX - Central export for all shared components
// ============================================================================

// Theme provider and utilities
export {
  ThemeProvider,
  useTheme,
  getPrimaryButtonClasses,
  getFocusRingClasses,
  getAccentBgClasses,
  getAccentTextClasses,
} from "./theme-provider";

// UI components
export {
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  ModalBody,
  ModalFooter,
  ConfirmModal,
  Badge,
  StatusDot,
  LifecycleBadge,
  HealthBadge,
  BillingBadge,
  Pagination,
  SearchInput,
} from "./ui";

// Layout components
export { Sidebar, SquareMLogoIcon, buildNavItems, Header } from "./layout";

// Error boundary and feedback components
export {
  ErrorBoundary,
  ErrorFallback,
  QueryErrorFallback,
  EmptyState,
} from "./error-boundary";
