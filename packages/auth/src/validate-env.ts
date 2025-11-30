/**
 * Environment validation for authentication
 *
 * Call this at startup to catch misconfigurations early.
 */

/**
 * CRITICAL: Block localhost in production
 * This function THROWS errors (not just warns) if localhost is detected
 * in any environment variable in production mode.
 *
 * Call this at app startup to prevent localhost leaks from breaking production.
 */
export function blockLocalhostInProduction(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];

  // Check NEXTAUTH_URL
  const nextAuthUrl = process.env.NEXTAUTH_URL || '';
  if (nextAuthUrl.includes('localhost') || nextAuthUrl.includes('127.0.0.1')) {
    errors.push(`NEXTAUTH_URL contains localhost: ${nextAuthUrl}`);
  }

  // Check database URLs
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    errors.push(`DATABASE_URL contains localhost (check Vercel env vars)`);
  }

  // Check public URLs
  const publicUrls = [
    'NEXT_PUBLIC_ABRA_URL',
    'NEXT_PUBLIC_KADABRA_URL',
    'NEXT_PUBLIC_LOGIN_URL',
  ];
  for (const key of publicUrls) {
    const val = process.env[key] || '';
    if (val.includes('localhost') || val.includes('127.0.0.1')) {
      errors.push(`${key} contains localhost: ${val}`);
    }
  }

  if (errors.length > 0) {
    const errorMessage = `
🚨 PRODUCTION LOCALHOST DETECTED - BLOCKING STARTUP 🚨

The following environment variables contain localhost/127.0.0.1:
${errors.map((e) => `  - ${e}`).join('\n')}

This will break production. Fix your Vercel environment variables:
1. Go to Vercel Dashboard > Project Settings > Environment Variables
2. Ensure all URLs point to production domains
3. Redeploy the application

Required production values:
- DATABASE_URL: postgres://...@db.xxx.supabase.co:6543/postgres?pgbouncer=true
- NEXTAUTH_URL: https://<app>.magimanager.com
- NEXT_PUBLIC_*_URL: https://<app>.magimanager.com
`;
    throw new Error(errorMessage);
  }
}

/**
 * Validates required auth environment variables
 * Throws if critical variables are missing
 * Warns if configuration looks suspicious
 */
export function validateAuthEnvironment() {
  // First, block localhost in production (throws if found)
  blockLocalhostInProduction();

  const required = ['NEXTAUTH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required auth environment variables: ${missing.join(', ')}`
    );
  }

  // Additional warnings for suspicious configurations
  if (process.env.NODE_ENV === 'production') {
    const nextAuthUrl = process.env.NEXTAUTH_URL || '';

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
