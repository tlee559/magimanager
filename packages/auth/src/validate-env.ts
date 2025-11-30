/**
 * Environment validation for authentication
 *
 * Call this at startup to catch misconfigurations early.
 */

/**
 * Validates required auth environment variables
 * Throws if critical variables are missing
 * Warns if configuration looks suspicious
 */
export function validateAuthEnvironment() {
  const required = ['NEXTAUTH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required auth environment variables: ${missing.join(', ')}`
    );
  }

  // In production, warn about suspicious configurations
  if (process.env.NODE_ENV === 'production') {
    const nextAuthUrl = process.env.NEXTAUTH_URL || '';

    if (nextAuthUrl.includes('localhost')) {
      console.error(
        '⚠️ AUTH WARNING: NEXTAUTH_URL contains "localhost" in production!'
      );
      console.error('   This will cause SSO to fail.');
      console.error(`   Current value: ${nextAuthUrl}`);
    }

    if (nextAuthUrl && !nextAuthUrl.includes('magimanager.com')) {
      console.error(
        '⚠️ AUTH WARNING: NEXTAUTH_URL does not contain "magimanager.com"'
      );
      console.error('   This may cause cross-domain SSO issues.');
      console.error(`   Current value: ${nextAuthUrl}`);
    }

    if (!nextAuthUrl) {
      console.error('⚠️ AUTH WARNING: NEXTAUTH_URL is not set in production');
      console.error('   NextAuth will auto-detect the URL, which may be incorrect.');
    }
  }
}

/**
 * Get auth debug info (safe to expose - no secrets)
 */
export function getAuthDebugInfo() {
  return {
    nodeEnv: process.env.NODE_ENV,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL || '(not set)',
    vercel: process.env.VERCEL || '(not set)',
    loginUrl: process.env.NEXT_PUBLIC_LOGIN_URL || '(not set)',
    abraUrl: process.env.NEXT_PUBLIC_ABRA_URL || '(not set)',
    kadabraUrl: process.env.NEXT_PUBLIC_KADABRA_URL || '(not set)',
  };
}
