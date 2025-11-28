// Re-export from shared auth package
export {
  requireAuth,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  requireManager,
  canAccessAccount,
  getAccountFilter,
  type SessionUser,
  type UserRole,
} from '@magimanager/auth';
