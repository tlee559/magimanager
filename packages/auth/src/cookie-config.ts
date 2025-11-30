/**
 * Shared cookie configuration for SSO across all MagiManager apps
 *
 * This is the SINGLE SOURCE OF TRUTH for cookie settings.
 * All apps (login, abra, kadabra) must import from here.
 */

// Simple, predictable check - Vercel sets NODE_ENV automatically
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Auth configuration for cookies and URLs
 */
export const AUTH_CONFIG = {
  cookie: {
    name: IS_PRODUCTION
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
    domain: IS_PRODUCTION ? '.magimanager.com' : undefined,
    secure: IS_PRODUCTION,
    sameSite: 'lax' as const,
    path: '/',
    httpOnly: true,
  },
  urls: {
    login: process.env.NEXT_PUBLIC_LOGIN_URL || 'https://login.magimanager.com',
    abra: process.env.NEXT_PUBLIC_ABRA_URL || 'https://abra.magimanager.com',
    kadabra: process.env.NEXT_PUBLIC_KADABRA_URL || 'https://magimanager.com',
  },
} as const;

/**
 * Get the session cookie name - use this in middleware
 */
export const SESSION_COOKIE_NAME = AUTH_CONFIG.cookie.name;

/**
 * Get full cookie options for NextAuth
 */
export function getCookieOptions() {
  return {
    httpOnly: AUTH_CONFIG.cookie.httpOnly,
    sameSite: AUTH_CONFIG.cookie.sameSite,
    path: AUTH_CONFIG.cookie.path,
    secure: AUTH_CONFIG.cookie.secure,
    ...(AUTH_CONFIG.cookie.domain ? { domain: AUTH_CONFIG.cookie.domain } : {}),
  };
}

/**
 * Check if we're in production mode
 */
export function isProduction() {
  return IS_PRODUCTION;
}
