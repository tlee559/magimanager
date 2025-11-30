export { authOptions } from './auth-options';

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
} from './api-auth';

export {
  Permissions,
  getAccessibleViews,
  abraPermissions,
  kadabraPermissions,
  canAccessAbra,
  canAccessKadabra,
} from './permissions';

export {
  constantTimeCompare,
  isValidCronRequest,
  isVercelCronRequest,
} from './security';

export {
  AUTH_CONFIG,
  SESSION_COOKIE_NAME,
  getCookieOptions,
  isProduction,
} from './cookie-config';

export {
  validateAuthEnvironment,
  getAuthDebugInfo,
} from './validate-env';
