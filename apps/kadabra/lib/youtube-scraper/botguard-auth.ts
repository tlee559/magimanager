/**
 * BotGuard Authentication Module
 *
 * This module handles YouTube's Proof of Origin (PO) token generation
 * to authenticate requests like y2mate does.
 *
 * YouTube requires PO tokens for:
 * - Video playback requests
 * - Stream URL access
 * - Bypassing "Sign in" requirements
 *
 * Token Types:
 * 1. Cold Start Token - Simple XOR-encrypted placeholder (works for SPS status 2)
 * 2. Session Bound Token - Full BotGuard-generated token (requires VM)
 * 3. Content Bound Token - Per-video token
 */

import { BG } from "bgutils-js";

// Constants from bgutils-js
const GOOG_API_KEY = "AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw";
const GOOG_BASE_URL = "https://jnn-pa.googleapis.com";
const YT_BASE_URL = "https://www.youtube.com";

// Debug logging
const DEBUG = true;
function debug(category: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[BG:${category}]`, ...args);
  }
}

/**
 * Generate a visitor ID (similar to what YouTube generates)
 * Format: CgtXXXXXXXXXXXX where X is base64 characters
 */
export function generateVisitorId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "Cgt"; // YouTube visitor ID prefix
  for (let i = 0; i < 11; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Add timestamp component
  const timestamp = Math.floor(Date.now() / 1000);
  const timestampBytes = [
    (timestamp >> 24) & 0xff,
    (timestamp >> 16) & 0xff,
    (timestamp >> 8) & 0xff,
    timestamp & 0xff,
  ];
  const timestampB64 = btoa(String.fromCharCode(...timestampBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return result + timestampB64.substring(0, 5);
}

/**
 * Generate a Data Sync ID for logged-in simulation
 */
export function generateDataSyncId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 22; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result + "||";
}

/**
 * Generate a cold start PO token
 * This is a placeholder token that works while StreamProtectionStatus (sps) is 2
 *
 * @param identifier - Visitor ID or Data Sync ID
 * @param clientState - Client state (default 1)
 */
export function generateColdStartToken(identifier: string, clientState: number = 1): string {
  debug("TOKEN", `Generating cold start token for identifier: ${identifier.substring(0, 10)}...`);

  // Use bgutils-js built-in function
  const token = BG.PoToken.generateColdStartToken(identifier, clientState);

  debug("TOKEN", `Generated cold start token: ${token.substring(0, 30)}...`);
  return token;
}

/**
 * Fetch the BotGuard challenge from YouTube/Google API
 */
export async function fetchChallenge(requestKey: string = "O43z0dpjhgX20SCx4KAo"): Promise<{
  program: string;
  globalName: string;
  interpreterHash: string;
  interpreterUrl?: string;
  interpreterScript?: string;
} | null> {
  debug("CHALLENGE", `Fetching challenge with requestKey: ${requestKey}`);

  try {
    const payload = [requestKey];

    const response = await fetch(`${GOOG_BASE_URL}/$rpc/google.internal.waa.v1.Waa/Create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json+protobuf",
        "x-goog-api-key": GOOG_API_KEY,
        "x-user-agent": "grpc-web-javascript/0.1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      debug("CHALLENGE", `Failed to fetch challenge: ${response.status}`);
      return null;
    }

    const rawData = await response.json();
    debug("CHALLENGE", "Raw response:", JSON.stringify(rawData).substring(0, 200));

    // Parse the challenge data
    const parsed = BG.Challenge.parseChallengeData(rawData);

    if (!parsed) {
      debug("CHALLENGE", "Failed to parse challenge data");
      return null;
    }

    debug("CHALLENGE", `Parsed challenge - globalName: ${parsed.globalName}, hash: ${parsed.interpreterHash}`);

    return {
      program: parsed.program,
      globalName: parsed.globalName,
      interpreterHash: parsed.interpreterHash,
      interpreterUrl: parsed.interpreterJavascript.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue || undefined,
      interpreterScript: parsed.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue || undefined,
    };
  } catch (error) {
    debug("CHALLENGE", "Error fetching challenge:", error);
    return null;
  }
}

/**
 * Fetch visitor data from YouTube
 * This extracts the VISITOR_INFO1_LIVE cookie value from YouTube
 */
export async function fetchVisitorData(): Promise<string | null> {
  debug("VISITOR", "Fetching visitor data from YouTube...");

  try {
    // Make a request to YouTube to get visitor data
    const response = await fetch("https://www.youtube.com/embed/dQw4w9WgXcQ", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const html = await response.text();

    // Try to extract visitorData from the page
    const visitorDataMatch = html.match(/"visitorData"\s*:\s*"([^"]+)"/);
    if (visitorDataMatch) {
      debug("VISITOR", `Found visitorData: ${visitorDataMatch[1].substring(0, 20)}...`);
      return visitorDataMatch[1];
    }

    // Try ytcfg format
    const ytcfgMatch = html.match(/ytcfg\.set\s*\(\s*({[^}]+})\s*\)/);
    if (ytcfgMatch) {
      try {
        const ytcfg = JSON.parse(ytcfgMatch[1]);
        if (ytcfg.VISITOR_DATA) {
          debug("VISITOR", `Found VISITOR_DATA: ${ytcfg.VISITOR_DATA.substring(0, 20)}...`);
          return ytcfg.VISITOR_DATA;
        }
      } catch {
        // Ignore parse errors
      }
    }

    debug("VISITOR", "Could not extract visitor data from page");
    return null;
  } catch (error) {
    debug("VISITOR", "Error fetching visitor data:", error);
    return null;
  }
}

/**
 * Get integrity token from Google's WAA API
 */
export async function getIntegrityToken(
  requestKey: string,
  botguardResponse: string
): Promise<{
  integrityToken?: string;
  estimatedTtlSecs?: number;
  mintRefreshThreshold?: number;
  websafeFallbackToken?: string;
} | null> {
  debug("INTEGRITY", "Fetching integrity token...");

  try {
    const payload = [requestKey, botguardResponse];

    const response = await fetch(`${GOOG_BASE_URL}/$rpc/google.internal.waa.v1.Waa/GenerateIT`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json+protobuf",
        "x-goog-api-key": GOOG_API_KEY,
        "x-user-agent": "grpc-web-javascript/0.1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      debug("INTEGRITY", `Failed to fetch integrity token: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] = data;

    debug("INTEGRITY", `Got integrity token, TTL: ${estimatedTtlSecs}s`);

    return {
      integrityToken,
      estimatedTtlSecs,
      mintRefreshThreshold,
      websafeFallbackToken,
    };
  } catch (error) {
    debug("INTEGRITY", "Error fetching integrity token:", error);
    return null;
  }
}

/**
 * Authentication context for YouTube requests
 */
export interface AuthContext {
  visitorData: string;
  poToken: string;
  dataSyncId?: string;
  clientState: number;
  createdAt: number;
  expiresAt: number;
}

// Cache for auth context
let cachedAuthContext: AuthContext | null = null;

/**
 * Get or create authentication context
 * This provides the visitor data and PO token needed for YouTube API requests
 */
export async function getAuthContext(forceRefresh: boolean = false): Promise<AuthContext> {
  // Check if we have a valid cached context
  if (cachedAuthContext && !forceRefresh) {
    const now = Date.now();
    if (now < cachedAuthContext.expiresAt) {
      debug("AUTH", "Using cached auth context");
      return cachedAuthContext;
    }
  }

  debug("AUTH", "Creating new auth context...");

  // Try to fetch visitor data from YouTube
  let visitorData = await fetchVisitorData();

  // Fall back to generated visitor ID if fetch fails
  if (!visitorData) {
    debug("AUTH", "Generating visitor data...");
    visitorData = generateVisitorId();
  }

  // Generate cold start PO token
  const poToken = generateColdStartToken(visitorData, 1);

  // Create auth context
  const now = Date.now();
  cachedAuthContext = {
    visitorData,
    poToken,
    clientState: 1,
    createdAt: now,
    expiresAt: now + (6 * 60 * 60 * 1000), // 6 hours
  };

  debug("AUTH", "Created auth context:", {
    visitorData: visitorData.substring(0, 15) + "...",
    poToken: poToken.substring(0, 30) + "...",
    expiresAt: new Date(cachedAuthContext.expiresAt).toISOString(),
  });

  return cachedAuthContext;
}

/**
 * Clear cached authentication context
 */
export function clearAuthContext(): void {
  cachedAuthContext = null;
  debug("AUTH", "Cleared auth context cache");
}

/**
 * Decode a cold start token for debugging
 */
export function decodeColdStartToken(token: string): {
  identifier: string;
  timestamp: number;
  clientState: number;
  date: Date;
} {
  return BG.PoToken.decodeColdStartToken(token);
}
