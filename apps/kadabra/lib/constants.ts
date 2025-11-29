// Production URLs - hardcoded since domains are fixed
export const ABRA_URL = "https://abra.magimanager.com";
export const KADABRA_URL = "https://magimanager.com";
export const APP_VERSION = "0.1.0";
export const BUILD_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
