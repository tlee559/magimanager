// Client-safe exports (can be imported in "use client" components)
export * from "./types";
export { YouTubeScraperView } from "./youtube-scraper-view";

// Re-export types only (types are safe for client)
export type {
  VideoFormat,
  VideoDetails,
  YouTubeVideoInfo,
} from "./youtube-client";
export type { AuthContext } from "./botguard-auth";

// Note: Server-only functions should be imported directly:
// import { getVideoInfo, downloadVideo } from "@/lib/youtube-scraper/youtube-client";
// import { getAuthContext } from "@/lib/youtube-scraper/botguard-auth";
