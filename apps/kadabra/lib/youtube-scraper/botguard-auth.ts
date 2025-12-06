/**
 * BotGuard Authentication Module
 *
 * This module handles YouTube's Proof of Origin (PO) token generation
 * using the full BotGuard VM execution (like y2mate does).
 *
 * Based on: https://github.com/Brainicism/bgutil-ytdlp-pot-provider
 *
 * YouTube requires PO tokens for:
 * - Video playback requests
 * - Stream URL access
 * - Bypassing "Sign in" requirements
 *
 * NOTE: Uses dynamic imports to avoid webpack bundling issues
 */

// Debug logging
const DEBUG = true;
function debug(category: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[BG:${category}]`, ...args);
  }
}

// Request key used by YouTube
const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";

// Token TTL in hours
const TOKEN_TTL_HOURS = 6;

// Flag to track if JSDOM has been set up
let hasDom = false;

// User agent for BotGuard requests
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)';

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

// Lazy-loaded module references
let JSDOM: typeof import("jsdom").JSDOM | null = null;
let Innertube: typeof import("youtubei.js").Innertube | null = null;
let BG: typeof import("bgutils-js").BG | null = null;
let bgBuildURL: typeof import("bgutils-js").buildURL | null = null;
let bgGetHeaders: typeof import("bgutils-js").getHeaders | null = null;

/**
 * Dynamically load required modules
 */
async function loadModules(): Promise<void> {
  if (JSDOM && Innertube && BG && bgBuildURL && bgGetHeaders) {
    return; // Already loaded
  }

  debug("MODULES", "Loading required modules dynamically...");

  try {
    const jsdomModule = await import("jsdom");
    JSDOM = jsdomModule.JSDOM;
    debug("MODULES", "JSDOM loaded");
  } catch (error) {
    debug("MODULES", "Failed to load JSDOM:", error);
    throw new Error("Failed to load JSDOM module");
  }

  try {
    const innertubeModule = await import("youtubei.js");
    Innertube = innertubeModule.Innertube;
    debug("MODULES", "youtubei.js loaded");
  } catch (error) {
    debug("MODULES", "Failed to load youtubei.js:", error);
    throw new Error("Failed to load youtubei.js module");
  }

  try {
    const bgModule = await import("bgutils-js");
    BG = bgModule.BG;
    bgBuildURL = bgModule.buildURL;
    bgGetHeaders = bgModule.getHeaders;
    debug("MODULES", "bgutils-js loaded");
  } catch (error) {
    debug("MODULES", "Failed to load bgutils-js:", error);
    throw new Error("Failed to load bgutils-js module");
  }
}

/**
 * Set up JSDOM environment for BotGuard
 * This simulates a browser environment needed for BotGuard VM execution
 */
function setupJsdom(): void {
  if (hasDom || !JSDOM) return;

  debug("JSDOM", "Setting up browser environment...");

  const dom = new JSDOM(
    '<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
    {
      url: "https://www.youtube.com/",
      referrer: "https://www.youtube.com/",
      userAgent: USER_AGENT,
    }
  );

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    origin: dom.window.origin,
  });

  if (!Reflect.has(globalThis, "navigator")) {
    Object.defineProperty(globalThis, "navigator", {
      value: dom.window.navigator,
    });
  }

  hasDom = true;
  debug("JSDOM", "Browser environment ready");
}

// BgConfig interface
interface BgConfig {
  fetch: typeof fetch;
  globalObj: typeof globalThis;
  identifier: string;
  requestKey: string;
}

// Challenge data interface
interface DescrambledChallenge {
  program: string;
  globalName: string;
  interpreterHash: string;
  interpreterJavascript: {
    privateDoNotAccessOrElseSafeScriptWrappedValue: string;
    privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string;
  };
}

// Token minter interface
interface TokenMinter {
  expiry: Date;
  integrityToken: string;
  minter: {
    mintAsWebsafeString: (contentBinding: string) => Promise<string>;
  };
}

let cachedMinter: TokenMinter | null = null;

/**
 * Custom fetch wrapper for BotGuard API calls
 */
function createFetch(): typeof fetch {
  return async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    debug("FETCH", `${options?.method || "GET"} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        "User-Agent": USER_AGENT,
      },
    });

    debug("FETCH", `Response: ${response.status}`);
    return response;
  };
}

/**
 * Generate visitor data using Innertube
 */
export async function generateVisitorData(): Promise<string | null> {
  await loadModules();

  if (!Innertube) {
    throw new Error("Innertube module not loaded");
  }

  debug("VISITOR", "Generating visitor data via Innertube...");

  try {
    const innertube = await Innertube.create({ retrieve_player: false });
    const visitorData = innertube.session.context.client.visitorData;

    if (!visitorData) {
      debug("VISITOR", "Unable to generate visitor data via Innertube");
      return null;
    }

    debug("VISITOR", `Generated visitor data: ${visitorData.substring(0, 20)}...`);
    return visitorData;
  } catch (error) {
    debug("VISITOR", "Error generating visitor data:", error);
    return null;
  }
}

/**
 * Get challenge from YouTube's attestation endpoint
 */
async function getChallenge(
  bgConfig: BgConfig,
  innertubeContext?: unknown
): Promise<DescrambledChallenge> {
  if (!BG || !bgGetHeaders) {
    throw new Error("BG module not loaded");
  }

  debug("CHALLENGE", "Getting BotGuard challenge...");

  try {
    // Try to get challenge from YouTube's attestation endpoint
    if (innertubeContext) {
      debug("CHALLENGE", "Using challenge from /att/get");
      const attGetResponse = await bgConfig.fetch(
        "https://www.youtube.com/youtubei/v1/att/get?prettyPrint=false",
        {
          method: "POST",
          headers: {
            ...bgGetHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            context: innertubeContext,
            engagementType: "ENGAGEMENT_TYPE_UNBOUND",
          }),
        }
      );

      const attestation = await attGetResponse.json() as {
        bgChallenge?: {
          program: string;
          globalName: string;
          interpreterHash: string;
          interpreterUrl: {
            privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string;
          };
        };
      };

      if (attestation?.bgChallenge) {
        const challenge = attestation.bgChallenge;
        const { program, globalName, interpreterHash, interpreterUrl } = challenge;

        // Fetch the interpreter JS
        const interpreterJSResponse = await bgConfig.fetch(
          `https:${interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue}`
        );
        const interpreterJS = await interpreterJSResponse.text();

        debug("CHALLENGE", `Got challenge: globalName=${globalName}, hash=${interpreterHash}`);

        return {
          program,
          globalName,
          interpreterHash,
          interpreterJavascript: {
            privateDoNotAccessOrElseSafeScriptWrappedValue: interpreterJS,
            privateDoNotAccessOrElseTrustedResourceUrlWrappedValue:
              interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue,
          },
        };
      }
    }
  } catch (error) {
    debug("CHALLENGE", "Failed to get challenge from /att/get, trying /Create:", error);
  }

  // Fallback to BG.Challenge.create
  debug("CHALLENGE", "Using /Create endpoint");
  const descrambledChallenge = await BG.Challenge.create(bgConfig);
  if (!descrambledChallenge) {
    throw new Error("Could not get BotGuard challenge");
  }

  debug("CHALLENGE", `Got challenge from /Create: globalName=${descrambledChallenge.globalName}`);
  return descrambledChallenge as DescrambledChallenge;
}

/**
 * Generate a token minter using BotGuard VM
 */
async function generateTokenMinter(
  bgConfig: BgConfig,
  innertubeContext?: unknown
): Promise<TokenMinter> {
  if (!BG || !bgBuildURL || !bgGetHeaders) {
    throw new Error("BG module not loaded");
  }

  debug("MINTER", "Generating token minter...");

  const descrambledChallenge = await getChallenge(bgConfig, innertubeContext);
  const { program, globalName, interpreterJavascript } = descrambledChallenge;

  // Execute the interpreter JS to load the BotGuard VM
  const interpreterJS = interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (interpreterJS) {
    debug("MINTER", "Loading BotGuard VM...");
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(interpreterJS)();
  } else {
    throw new Error("Could not load BotGuard VM - no interpreter JS");
  }

  // Create BotGuard client
  debug("MINTER", "Creating BotGuard client...");
  const bgClient = await BG.BotGuardClient.create({
    program,
    globalName,
    globalObj: bgConfig.globalObj,
  });

  // Take snapshot to get BotGuard response
  debug("MINTER", "Taking BotGuard snapshot...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webPoSignalOutput: any[] = [];
  const botguardResponse = await bgClient.snapshot({ webPoSignalOutput });

  debug("MINTER", `BotGuard response: ${botguardResponse.substring(0, 50)}...`);

  // Get integrity token from Google's WAA API
  debug("MINTER", "Getting integrity token...");
  const integrityTokenResp = await bgConfig.fetch(bgBuildURL("GenerateIT"), {
    method: "POST",
    headers: bgGetHeaders(),
    body: JSON.stringify([REQUEST_KEY, botguardResponse]),
  });

  const integrityTokenJson = await integrityTokenResp.json() as [string, number, number, string];
  const [integrityToken, estimatedTtlSecs] = integrityTokenJson;

  if (!integrityToken) {
    throw new Error(`Failed to get integrity token: ${JSON.stringify(integrityTokenJson)}`);
  }

  debug("MINTER", `Got integrity token, TTL: ${estimatedTtlSecs}s`);

  // Create WebPoMinter
  const minter = await BG.WebPoMinter.create(
    {
      integrityToken,
      estimatedTtlSecs,
      mintRefreshThreshold: integrityTokenJson[2],
      websafeFallbackToken: integrityTokenJson[3],
    },
    webPoSignalOutput
  );

  const tokenMinter: TokenMinter = {
    expiry: new Date(Date.now() + estimatedTtlSecs * 1000),
    integrityToken,
    minter,
  };

  cachedMinter = tokenMinter;
  debug("MINTER", "Token minter created successfully");

  return tokenMinter;
}

/**
 * Mint a PO token for the given content binding (visitor data)
 */
async function mintPoToken(contentBinding: string, minter: TokenMinter): Promise<string> {
  debug("TOKEN", `Minting PO token for: ${contentBinding.substring(0, 20)}...`);

  const poToken = await minter.minter.mintAsWebsafeString(contentBinding);

  if (!poToken) {
    throw new Error("Failed to mint PO token - empty result");
  }

  debug("TOKEN", `Minted PO token: ${poToken.substring(0, 40)}...`);
  return poToken;
}

/**
 * Generate a cold start PO token (fallback, may not work for all videos)
 */
export async function generateColdStartToken(identifier: string, clientState: number = 1): Promise<string> {
  await loadModules();

  if (!BG) {
    throw new Error("BG module not loaded");
  }

  debug("TOKEN", `Generating cold start token for: ${identifier.substring(0, 15)}...`);
  const token = BG.PoToken.generateColdStartToken(identifier, clientState);
  debug("TOKEN", `Generated cold start token: ${token.substring(0, 30)}...`);
  return token;
}

/**
 * Get or create authentication context with full BotGuard PO token
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

  debug("AUTH", "Creating new auth context with full BotGuard flow...");

  // Load modules dynamically
  await loadModules();

  // Set up JSDOM environment
  setupJsdom();

  // Generate visitor data
  const visitorData = await generateVisitorData();
  if (!visitorData) {
    throw new Error("Failed to generate visitor data");
  }

  // Create bgConfig
  const bgConfig: BgConfig = {
    fetch: createFetch(),
    globalObj: globalThis,
    identifier: visitorData,
    requestKey: REQUEST_KEY,
  };

  // Get or create token minter
  let minter = cachedMinter;
  if (!minter || new Date() >= minter.expiry || forceRefresh) {
    debug("AUTH", "Creating new token minter...");

    // Get Innertube context for better challenge retrieval
    let innertubeContext: unknown = undefined;
    try {
      if (Innertube) {
        const innertube = await Innertube.create({ retrieve_player: false });
        innertubeContext = innertube.session.context;
      }
    } catch (error) {
      debug("AUTH", "Could not get Innertube context:", error);
    }

    minter = await generateTokenMinter(bgConfig, innertubeContext);
  }

  // Mint PO token
  const poToken = await mintPoToken(visitorData, minter);

  // Create auth context
  const now = Date.now();
  cachedAuthContext = {
    visitorData,
    poToken,
    clientState: 1,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_HOURS * 60 * 60 * 1000,
  };

  debug("AUTH", "Auth context created successfully:", {
    visitorData: visitorData.substring(0, 20) + "...",
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
  cachedMinter = null;
  debug("AUTH", "Cleared auth context cache");
}

/**
 * Generate visitor ID (simpler fallback)
 */
export function generateVisitorId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "Cgt";
  for (let i = 0; i < 11; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
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
 * Fetch visitor data from YouTube (fallback)
 */
export async function fetchVisitorData(): Promise<string | null> {
  return generateVisitorData();
}
