// Production URLs - these are constants since the domains are fixed
// Using env vars with fallbacks for flexibility
export const ABRA_URL = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";
export const KADABRA_URL = process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
export const BUILD_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
