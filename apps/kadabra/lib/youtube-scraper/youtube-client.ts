/**
 * Standalone YouTube Client
 *
 * This module directly interfaces with YouTube's internal API (like y2mate does)
 * without relying on any third-party YouTube libraries.
 *
 * How it works:
 * 1. Calls YouTube's /youtubei/v1/player endpoint with client impersonation
 * 2. Uses BotGuard authentication (PO tokens + visitor data) like y2mate
 * 3. Extracts streaming URLs from the response
 * 4. Handles signature deciphering for protected streams
 * 5. Downloads video with chunked requests to bypass rate limiting
 */

import { getAuthContext, type AuthContext } from "./botguard-auth";

// YouTube API constants
const YOUTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"; // Public innertube API key
const YOUTUBE_PLAYER_URL = "https://www.youtube.com/youtubei/v1/player";

// Debug logging
const DEBUG = true;
function debug(category: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[YT:${category}]`, ...args);
  }
}

// Client context interface
interface ClientContext {
  clientName: string;
  clientVersion: string;
  userAgent: string;
  platform: string;
  androidSdkVersion?: number;
  deviceModel?: string;
  osName?: string;
  osVersion?: string;
}

// Client contexts for impersonation
// Updated based on what currently works (Dec 2024)
const CLIENTS: Record<string, ClientContext> = {
  // Android client - often bypasses age restrictions
  ANDROID: {
    clientName: "ANDROID",
    clientVersion: "19.29.37",
    androidSdkVersion: 30,
    osName: "Android",
    osVersion: "11",
    userAgent: "com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip",
    platform: "MOBILE",
  },
  // Android Music - sometimes works when others don't
  ANDROID_MUSIC: {
    clientName: "ANDROID_MUSIC",
    clientVersion: "6.42.52",
    androidSdkVersion: 30,
    osName: "Android",
    osVersion: "11",
    userAgent: "com.google.android.apps.youtube.music/6.42.52 (Linux; U; Android 11) gzip",
    platform: "MOBILE",
  },
  // Android Embedded - good for embedded videos
  ANDROID_EMBEDDED: {
    clientName: "ANDROID_EMBEDDED_PLAYER",
    clientVersion: "19.29.37",
    androidSdkVersion: 30,
    osName: "Android",
    osVersion: "11",
    userAgent: "com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip",
    platform: "MOBILE",
  },
  // iOS client
  IOS: {
    clientName: "IOS",
    clientVersion: "19.29.1",
    deviceModel: "iPhone16,2",
    osName: "iPhone",
    osVersion: "17.5.1.21F90",
    userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
    platform: "MOBILE",
  },
  // TV HTML5 client - good for age-gated content
  TV_EMBEDDED: {
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientVersion: "2.0",
    userAgent: "Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
    platform: "TV",
  },
  // Web client - most compatible but may require signature deciphering
  WEB: {
    clientName: "WEB",
    clientVersion: "2.20241201.00.00",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    platform: "DESKTOP",
  },
  // Media Connect (often works when others fail)
  MEDIA_CONNECT: {
    clientName: "MEDIA_CONNECT_FRONTEND",
    clientVersion: "0.1",
    userAgent: "Mozilla/5.0",
    platform: "TV",
  },
};

export interface VideoFormat {
  itag: number;
  url?: string;
  signatureCipher?: string;
  mimeType: string;
  bitrate: number;
  width?: number;
  height?: number;
  qualityLabel?: string;
  quality: string;
  fps?: number;
  audioQuality?: string;
  audioSampleRate?: string;
  audioChannels?: number;
  contentLength?: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface VideoDetails {
  videoId: string;
  title: string;
  lengthSeconds: number;
  channelId: string;
  shortDescription: string;
  thumbnail: {
    url: string;
    width: number;
    height: number;
  };
  author: string;
  viewCount: number;
  isLive: boolean;
  isPrivate: boolean;
}

export interface PlayerResponse {
  videoDetails?: VideoDetails;
  streamingData?: {
    formats?: VideoFormat[];
    adaptiveFormats?: VideoFormat[];
    expiresInSeconds?: string;
  };
  playabilityStatus?: {
    status: string;
    reason?: string;
    playableInEmbed?: boolean;
    messages?: string[];
    liveStreamability?: unknown;
  };
}

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  author: string;
  viewCount: number;
  formats: VideoFormat[];
  adaptiveFormats: VideoFormat[];
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Build the request body for YouTube's player API
 */
function buildPlayerRequest(
  videoId: string,
  clientType: string = "ANDROID",
  authContext?: AuthContext
) {
  const client = CLIENTS[clientType];

  const clientInfo: Record<string, unknown> = {
    clientName: client.clientName,
    clientVersion: client.clientVersion,
    hl: "en",
    gl: "US",
    timeZone: "America/New_York",
  };

  // Add platform-specific fields
  if (client.androidSdkVersion) {
    clientInfo.androidSdkVersion = client.androidSdkVersion;
  }
  if (client.deviceModel) {
    clientInfo.deviceModel = client.deviceModel;
  }
  if (client.osName) {
    clientInfo.osName = client.osName;
  }
  if (client.osVersion) {
    clientInfo.osVersion = client.osVersion;
  }

  // Add visitor data from auth context
  if (authContext?.visitorData) {
    clientInfo.visitorData = authContext.visitorData;
  }

  const context: Record<string, unknown> = {
    client: clientInfo,
  };

  // For embedded clients, add embed context
  if (clientType === "TV_EMBEDDED" || clientType === "ANDROID_EMBEDDED") {
    context.thirdParty = {
      embedUrl: "https://www.youtube.com/",
    };
  }

  const request: Record<string, unknown> = {
    videoId,
    context,
    contentCheckOk: true,
    racyCheckOk: true,
  };

  // Add playback context for some clients
  if (clientType === "ANDROID" || clientType === "IOS") {
    request.playbackContext = {
      contentPlaybackContext: {
        html5Preference: "HTML5_PREF_WANTS",
        signatureTimestamp: 20073, // This should ideally be extracted from player JS
      },
    };
  }

  // Add PO token for service integrity (like y2mate does)
  if (authContext?.poToken) {
    request.serviceIntegrityDimensions = {
      poToken: authContext.poToken,
    };
  }

  return request;
}

/**
 * Get client number for X-YouTube-Client-Name header
 */
function getClientNumber(clientName: string): string {
  const clientNumbers: Record<string, string> = {
    WEB: "1",
    ANDROID: "3",
    IOS: "5",
    ANDROID_MUSIC: "21",
    ANDROID_EMBEDDED_PLAYER: "55",
    TVHTML5_SIMPLY_EMBEDDED_PLAYER: "85",
    MEDIA_CONNECT_FRONTEND: "95",
  };
  return clientNumbers[clientName] || "1";
}

/**
 * Fetch player response from YouTube API
 */
async function fetchPlayerResponse(
  videoId: string,
  clientType: string = "ANDROID",
  authContext?: AuthContext
): Promise<PlayerResponse> {
  const client = CLIENTS[clientType];
  const requestBody = buildPlayerRequest(videoId, clientType, authContext);

  debug("REQUEST", `Fetching with ${clientType} client for video ${videoId}`);
  debug("REQUEST", `Auth context: visitorData=${authContext?.visitorData?.substring(0, 15) || "none"}..., poToken=${authContext?.poToken?.substring(0, 20) || "none"}...`);
  debug("REQUEST", "Request body:", JSON.stringify(requestBody, null, 2));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": client.userAgent,
    "X-YouTube-Client-Name": getClientNumber(client.clientName),
    "X-YouTube-Client-Version": client.clientVersion,
  };

  // Add origin/referer for web-based clients
  if (client.platform === "DESKTOP" || client.platform === "TV") {
    headers["Origin"] = "https://www.youtube.com";
    headers["Referer"] = "https://www.youtube.com/";
  }

  debug("REQUEST", "Headers:", headers);

  const response = await fetch(`${YOUTUBE_PLAYER_URL}?key=${YOUTUBE_API_KEY}&prettyPrint=false`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  debug("RESPONSE", `Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    debug("RESPONSE", "Error body:", errorText);
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  debug("RESPONSE", "Playability status:", data.playabilityStatus?.status);
  debug("RESPONSE", "Playability reason:", data.playabilityStatus?.reason || "none");
  debug("RESPONSE", "Video title:", data.videoDetails?.title || "none");
  debug("RESPONSE", "Formats count:", data.streamingData?.formats?.length || 0);
  debug("RESPONSE", "Adaptive formats count:", data.streamingData?.adaptiveFormats?.length || 0);

  if (data.playabilityStatus?.messages) {
    debug("RESPONSE", "Messages:", data.playabilityStatus.messages);
  }

  return data;
}

/**
 * Parse signature cipher URL
 */
function parseSignatureCipher(signatureCipher: string): { url: string; s: string; sp: string } | null {
  try {
    const params = new URLSearchParams(signatureCipher);
    const url = params.get("url");
    const s = params.get("s");
    const sp = params.get("sp") || "signature";

    if (url && s) {
      return { url, s, sp };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Get the base.js player URL from YouTube
 */
async function getPlayerJsUrl(): Promise<string> {
  debug("DECIPHER", "Fetching player JS URL...");

  const response = await fetch("https://www.youtube.com/iframe_api", {
    headers: {
      "User-Agent": CLIENTS.WEB.userAgent,
    },
  });

  const text = await response.text();

  // Extract player URL from iframe_api response
  const playerMatch = text.match(/\/s\/player\/([a-zA-Z0-9_-]+)\/player_ias\.vflset/);
  if (playerMatch) {
    const url = `https://www.youtube.com/s/player/${playerMatch[1]}/player_ias.vflset/en_US/base.js`;
    debug("DECIPHER", "Found player JS URL:", url);
    return url;
  }

  // Fallback: try to get from watch page
  debug("DECIPHER", "Falling back to watch page...");
  const watchResponse = await fetch("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
    headers: {
      "User-Agent": CLIENTS.WEB.userAgent,
    },
  });

  const watchText = await watchResponse.text();
  const baseJsMatch = watchText.match(/\/s\/player\/([a-zA-Z0-9_-]+)\/player_ias\.vflset\/[a-zA-Z_]+\/base\.js/);

  if (baseJsMatch) {
    const url = `https://www.youtube.com${baseJsMatch[0]}`;
    debug("DECIPHER", "Found player JS URL from watch page:", url);
    return url;
  }

  throw new Error("Could not find player JS URL");
}

/**
 * Extract signature decipher function from player JS
 */
async function extractDecipherFunction(): Promise<((sig: string) => string) | null> {
  try {
    const playerJsUrl = await getPlayerJsUrl();
    const response = await fetch(playerJsUrl, {
      headers: {
        "User-Agent": CLIENTS.WEB.userAgent,
      },
    });

    const playerJs = await response.text();
    debug("DECIPHER", `Loaded player JS: ${playerJs.length} bytes`);

    // Find the signature decipher function
    // Pattern: var XX={...};XX.YY=function(a){...};
    const funcNameMatch = playerJs.match(/\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*encodeURIComponent\(([a-zA-Z0-9$]+)\(/);
    if (!funcNameMatch) {
      debug("DECIPHER", "Could not find decipher function name");
      return null;
    }

    const funcName = funcNameMatch[1];
    debug("DECIPHER", `Found function name: ${funcName}`);

    // Find the function definition
    const funcPattern = new RegExp(
      `${funcName.replace(/\$/g, "\\$")}=function\\(a\\)\\{([^}]+)\\}`,
      "s"
    );
    const funcMatch = playerJs.match(funcPattern);

    if (!funcMatch) {
      debug("DECIPHER", "Could not find function body");
      return null;
    }

    const funcBody = funcMatch[1];
    debug("DECIPHER", `Found function body: ${funcBody.substring(0, 100)}...`);

    // Find the helper object
    const helperObjMatch = funcBody.match(/;([a-zA-Z0-9$]+)\./);
    if (!helperObjMatch) {
      debug("DECIPHER", "Could not find helper object");
      return null;
    }

    const helperObjName = helperObjMatch[1];
    debug("DECIPHER", `Found helper object: ${helperObjName}`);

    // Find helper object definition
    const helperPattern = new RegExp(
      `var ${helperObjName.replace(/\$/g, "\\$")}=\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`,
      "s"
    );
    const helperMatch = playerJs.match(helperPattern);

    if (!helperMatch) {
      debug("DECIPHER", "Could not find helper object definition");
      return null;
    }

    const helperObjBody = helperMatch[1];
    debug("DECIPHER", "Found helper object body");

    // Build the decipher function
    const helperCode = `var ${helperObjName}={${helperObjBody}};`;
    const decipherCode = `${helperCode}\nfunction decipher(a){${funcBody}};`;

    // Create and return the function
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const decipherFn = new Function(`${decipherCode}\nreturn decipher;`)() as (sig: string) => string;

    debug("DECIPHER", "Successfully created decipher function");
    return decipherFn;
  } catch (error) {
    debug("DECIPHER", "Error extracting decipher function:", error);
    return null;
  }
}

// Cache for decipher function
let cachedDecipherFn: ((sig: string) => string) | null = null;

/**
 * Decipher a signature
 */
async function decipherSignature(signature: string): Promise<string> {
  if (!cachedDecipherFn) {
    cachedDecipherFn = await extractDecipherFunction();
  }

  if (!cachedDecipherFn) {
    throw new Error("Could not extract decipher function");
  }

  return cachedDecipherFn(signature);
}

/**
 * Process format to get working URL
 */
async function processFormat(format: VideoFormat): Promise<VideoFormat> {
  // If URL is directly available, use it
  if (format.url) {
    debug("FORMAT", `Format ${format.itag} has direct URL`);
    return format;
  }

  // If signature cipher is present, decipher it
  if (format.signatureCipher) {
    debug("FORMAT", `Format ${format.itag} has signature cipher, deciphering...`);
    const parsed = parseSignatureCipher(format.signatureCipher);
    if (parsed) {
      try {
        const decipheredSig = await decipherSignature(parsed.s);
        const url = new URL(parsed.url);
        url.searchParams.set(parsed.sp, decipheredSig);
        debug("FORMAT", `Format ${format.itag} deciphered successfully`);
        return { ...format, url: url.toString() };
      } catch (error) {
        debug("FORMAT", `Format ${format.itag} decipher failed:`, error);
      }
    }
  }

  debug("FORMAT", `Format ${format.itag} has no usable URL`);
  return format;
}

/**
 * Get video information and streaming URLs
 */
export async function getVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
  debug("INFO", `Getting video info for: ${videoId}`);

  // Get authentication context (visitor data + PO token)
  debug("INFO", "Getting authentication context...");
  let authContext: AuthContext | undefined;
  try {
    authContext = await getAuthContext();
    if (authContext?.visitorData) {
      debug("INFO", `Auth context ready: visitorData=${authContext.visitorData.substring(0, 15)}...`);
    } else {
      debug("INFO", "Auth context ready but missing visitorData");
    }
  } catch (error) {
    debug("INFO", "Failed to get auth context, continuing without it:", error);
  }

  // Try different clients in order of preference
  // Order matters - some clients work better for certain video types
  const clientOrder: string[] = [
    "ANDROID",           // Usually works well
    "IOS",               // Alternative mobile
    "ANDROID_MUSIC",     // Sometimes bypasses restrictions
    "TV_EMBEDDED",       // Good for age-gated
    "ANDROID_EMBEDDED",  // Embedded player
    "WEB",               // Fallback (may need signature deciphering)
    "MEDIA_CONNECT",     // Last resort
  ];

  let lastError: Error | null = null;
  const errors: string[] = [];

  for (const clientType of clientOrder) {
    try {
      debug("INFO", `Trying ${clientType} client...`);
      const playerResponse = await fetchPlayerResponse(videoId, clientType, authContext);

      // Check playability status
      const status = playerResponse.playabilityStatus?.status;
      const reason = playerResponse.playabilityStatus?.reason || "Unknown error";

      if (status !== "OK") {
        debug("INFO", `${clientType} failed with status "${status}": ${reason}`);
        errors.push(`${clientType}: ${reason}`);

        // Continue to next client if sign-in required or age-gated
        if (
          reason.includes("Sign in") ||
          reason.includes("age") ||
          reason.includes("confirm your age") ||
          status === "LOGIN_REQUIRED" ||
          status === "AGE_CHECK_REQUIRED"
        ) {
          continue;
        }

        // For other errors, still try next client
        continue;
      }

      const videoDetails = playerResponse.videoDetails;
      const streamingData = playerResponse.streamingData;

      if (!videoDetails) {
        debug("INFO", `${clientType}: No video details in response`);
        errors.push(`${clientType}: No video details`);
        continue;
      }

      // Check if we have streaming data
      if (!streamingData || (!streamingData.formats?.length && !streamingData.adaptiveFormats?.length)) {
        debug("INFO", `${clientType}: No streaming data available`);
        errors.push(`${clientType}: No streaming data`);
        continue;
      }

      // Process formats to get working URLs
      const formats: VideoFormat[] = [];
      const adaptiveFormats: VideoFormat[] = [];

      // Process muxed formats
      if (streamingData.formats) {
        debug("INFO", `Processing ${streamingData.formats.length} muxed formats...`);
        for (const format of streamingData.formats) {
          const processed = await processFormat({
            ...format,
            hasAudio: true,
            hasVideo: true,
          });
          formats.push(processed);
        }
      }

      // Process adaptive formats
      if (streamingData.adaptiveFormats) {
        debug("INFO", `Processing ${streamingData.adaptiveFormats.length} adaptive formats...`);
        for (const format of streamingData.adaptiveFormats) {
          const hasVideo = format.mimeType?.startsWith("video/") ?? false;
          const hasAudio = format.mimeType?.startsWith("audio/") ?? false;
          const processed = await processFormat({
            ...format,
            hasVideo,
            hasAudio,
          });
          adaptiveFormats.push(processed);
        }
      }

      // Check if we have any usable URLs
      const usableFormats = formats.filter(f => f.url).length;
      const usableAdaptive = adaptiveFormats.filter(f => f.url).length;

      if (usableFormats === 0 && usableAdaptive === 0) {
        debug("INFO", `${clientType}: No usable format URLs`);
        errors.push(`${clientType}: No usable format URLs`);
        continue;
      }

      debug("INFO", `${clientType} SUCCESS! ${usableFormats} muxed, ${usableAdaptive} adaptive formats with URLs`);

      return {
        videoId,
        title: videoDetails.title,
        description: videoDetails.shortDescription,
        thumbnail: videoDetails.thumbnail?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: videoDetails.lengthSeconds,
        author: videoDetails.author,
        viewCount: videoDetails.viewCount,
        formats,
        adaptiveFormats,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      debug("INFO", `${clientType} error:`, lastError.message);
      errors.push(`${clientType}: ${lastError.message}`);
    }
  }

  // All clients failed - provide detailed error
  const errorDetails = errors.join("; ");
  debug("INFO", `All clients failed. Errors: ${errorDetails}`);

  throw new Error(`Failed to get video info. Tried all clients: ${errorDetails}`);
}

/**
 * Select the best format for download
 */
export function selectBestFormat(
  info: YouTubeVideoInfo,
  options: {
    quality?: "best" | "720p" | "480p" | "360p";
    preferMuxed?: boolean;
  } = {}
): { video?: VideoFormat; audio?: VideoFormat } {
  const { quality = "best", preferMuxed = true } = options;

  debug("FORMAT", `Selecting format: quality=${quality}, preferMuxed=${preferMuxed}`);
  debug("FORMAT", `Available: ${info.formats.length} muxed, ${info.adaptiveFormats.length} adaptive`);

  // First try to find a muxed format (video + audio combined)
  if (preferMuxed && info.formats.length > 0) {
    const muxedFormats = info.formats.filter(f => f.url);
    debug("FORMAT", `Muxed formats with URLs: ${muxedFormats.length}`);

    if (muxedFormats.length > 0) {
      // Sort by quality
      muxedFormats.sort((a, b) => {
        const aHeight = a.height || 0;
        const bHeight = b.height || 0;
        return bHeight - aHeight;
      });

      let selectedFormat = muxedFormats[0];

      // If specific quality requested, try to match
      if (quality !== "best") {
        const targetHeight = parseInt(quality);
        const matched = muxedFormats.find(f => f.height && f.height <= targetHeight);
        if (matched) {
          selectedFormat = matched;
        }
      }

      debug("FORMAT", `Selected muxed: ${selectedFormat.qualityLabel || selectedFormat.quality} (${selectedFormat.mimeType})`);
      return { video: selectedFormat };
    }
  }

  // Fall back to adaptive formats (separate video + audio)
  const videoFormats = info.adaptiveFormats.filter(f => f.hasVideo && f.url);
  const audioFormats = info.adaptiveFormats.filter(f => f.hasAudio && f.url);

  debug("FORMAT", `Adaptive with URLs: ${videoFormats.length} video, ${audioFormats.length} audio`);

  if (videoFormats.length === 0) {
    throw new Error("No video formats available");
  }

  // Sort video by quality
  videoFormats.sort((a, b) => {
    const aHeight = a.height || 0;
    const bHeight = b.height || 0;
    return bHeight - aHeight;
  });

  let selectedVideo = videoFormats[0];

  if (quality !== "best") {
    const targetHeight = parseInt(quality);
    const matched = videoFormats.find(f => f.height && f.height <= targetHeight);
    if (matched) {
      selectedVideo = matched;
    }
  }

  // Sort audio by bitrate
  audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const selectedAudio = audioFormats[0];

  debug("FORMAT", `Selected video: ${selectedVideo.qualityLabel || selectedVideo.quality} (${selectedVideo.mimeType})`);
  if (selectedAudio) {
    debug("FORMAT", `Selected audio: ${selectedAudio.audioQuality} (${selectedAudio.mimeType})`);
  }

  return { video: selectedVideo, audio: selectedAudio };
}

/**
 * Download with chunked requests to bypass rate limiting
 */
export async function downloadStream(
  url: string,
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<Uint8Array> {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

  debug("DOWNLOAD", "Starting download...");

  // First, get content length
  const headResponse = await fetch(url, {
    method: "HEAD",
    headers: {
      "User-Agent": CLIENTS.ANDROID.userAgent,
    },
  });

  const contentLength = headResponse.headers.get("content-length");
  const totalSize = contentLength ? parseInt(contentLength) : null;

  debug("DOWNLOAD", `Total size: ${totalSize ? (totalSize / 1024 / 1024).toFixed(2) : "unknown"} MB`);

  // If total size is small enough or unknown, download in one request
  if (!totalSize || totalSize < CHUNK_SIZE) {
    debug("DOWNLOAD", "Downloading in single request...");
    const response = await fetch(url, {
      headers: {
        "User-Agent": CLIENTS.ANDROID.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    onProgress?.(buffer.byteLength, totalSize);
    debug("DOWNLOAD", `Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    return new Uint8Array(buffer);
  }

  // Download in chunks
  debug("DOWNLOAD", `Downloading in ${Math.ceil(totalSize / CHUNK_SIZE)} chunks...`);
  const chunks: Uint8Array[] = [];
  let downloaded = 0;

  while (downloaded < totalSize) {
    const start = downloaded;
    const end = Math.min(downloaded + CHUNK_SIZE - 1, totalSize - 1);

    debug("DOWNLOAD", `Chunk ${start}-${end} (${((end - start + 1) / 1024 / 1024).toFixed(2)} MB)`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": CLIENTS.ANDROID.userAgent,
        "Range": `bytes=${start}-${end}`,
      },
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Chunk download failed: ${response.status}`);
    }

    const chunk = new Uint8Array(await response.arrayBuffer());
    chunks.push(chunk);
    downloaded += chunk.length;

    onProgress?.(downloaded, totalSize);
  }

  // Combine chunks
  debug("DOWNLOAD", "Combining chunks...");
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  debug("DOWNLOAD", `Download complete: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  return result;
}

/**
 * Download video to buffer
 */
export async function downloadVideo(
  videoId: string,
  options: {
    quality?: "best" | "720p" | "480p" | "360p";
    onProgress?: (downloaded: number, total: number | null, stage: string) => void;
  } = {}
): Promise<{ buffer: Uint8Array; info: YouTubeVideoInfo; format: VideoFormat }> {
  const { quality = "best", onProgress } = options;

  // Get video info
  onProgress?.(0, null, "Getting video info...");
  const info = await getVideoInfo(videoId);

  // Select best format
  onProgress?.(0, null, "Selecting format...");
  const { video, audio } = selectBestFormat(info, { quality, preferMuxed: true });

  if (!video?.url) {
    throw new Error("No downloadable format found");
  }

  debug("DOWNLOAD", `Selected format: ${video.qualityLabel || video.quality} (${video.mimeType})`);

  // If we have separate audio, we need to mux them (not implemented in browser)
  // For now, prefer muxed formats
  if (audio && !video.hasAudio) {
    debug("DOWNLOAD", "Warning: Video and audio are separate. Audio may be missing.");
    debug("DOWNLOAD", `Audio format: ${audio.audioQuality} (${audio.mimeType})`);
  }

  // Download video
  onProgress?.(0, null, "Downloading video...");
  const buffer = await downloadStream(video.url, (downloaded, total) => {
    onProgress?.(downloaded, total, "Downloading...");
  });

  return { buffer, info, format: video };
}
