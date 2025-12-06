/**
 * Standalone YouTube Client
 *
 * This module directly interfaces with YouTube's internal API (like y2mate does)
 * without relying on any third-party YouTube libraries.
 *
 * How it works:
 * 1. Calls YouTube's /youtubei/v1/player endpoint with client impersonation
 * 2. Extracts streaming URLs from the response
 * 3. Handles signature deciphering for protected streams
 * 4. Downloads video with chunked requests to bypass rate limiting
 */

// YouTube API constants
const YOUTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"; // Public innertube API key
const YOUTUBE_PLAYER_URL = "https://www.youtube.com/youtubei/v1/player";

// Client context interface
interface ClientContext {
  clientName: string;
  clientVersion: string;
  userAgent: string;
  platform: string;
  androidSdkVersion?: number;
  deviceModel?: string;
}

// Client contexts for impersonation
const CLIENTS: Record<string, ClientContext> = {
  // Android client - often has fewer restrictions
  ANDROID: {
    clientName: "ANDROID",
    clientVersion: "19.09.37",
    androidSdkVersion: 30,
    userAgent: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
    platform: "MOBILE",
  },
  // iOS client
  IOS: {
    clientName: "IOS",
    clientVersion: "19.09.3",
    deviceModel: "iPhone14,3",
    userAgent: "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
    platform: "MOBILE",
  },
  // TV HTML5 client - good for age-gated content
  TV_EMBEDDED: {
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientVersion: "2.0",
    userAgent: "Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
    platform: "TV",
  },
  // Web client
  WEB: {
    clientName: "WEB",
    clientVersion: "2.20240101.00.00",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    platform: "DESKTOP",
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
function buildPlayerRequest(videoId: string, clientType: string = "ANDROID") {
  const client = CLIENTS[clientType];

  const context: Record<string, unknown> = {
    client: {
      clientName: client.clientName,
      clientVersion: client.clientVersion,
      hl: "en",
      gl: "US",
      ...(client.androidSdkVersion && { androidSdkVersion: client.androidSdkVersion }),
      ...(client.deviceModel && { deviceModel: client.deviceModel }),
    },
  };

  // For TV_EMBEDDED client, add embed context for age-gated videos
  if (clientType === "TV_EMBEDDED") {
    context.thirdParty = {
      embedUrl: "https://www.youtube.com/",
    };
  }

  return {
    videoId,
    context,
    contentCheckOk: true,
    racyCheckOk: true,
  };
}

/**
 * Fetch player response from YouTube API
 */
async function fetchPlayerResponse(
  videoId: string,
  clientType: string = "ANDROID"
): Promise<PlayerResponse> {
  const client = CLIENTS[clientType];
  const requestBody = buildPlayerRequest(videoId, clientType);

  const response = await fetch(`${YOUTUBE_PLAYER_URL}?key=${YOUTUBE_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": client.userAgent,
      "X-YouTube-Client-Name": client.clientName === "ANDROID" ? "3" :
                               client.clientName === "IOS" ? "5" :
                               client.clientName === "WEB" ? "1" : "85",
      "X-YouTube-Client-Version": client.clientVersion,
      "Origin": "https://www.youtube.com",
      "Referer": "https://www.youtube.com/",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
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
  const response = await fetch("https://www.youtube.com/iframe_api", {
    headers: {
      "User-Agent": CLIENTS.WEB.userAgent,
    },
  });

  const text = await response.text();

  // Extract player URL from iframe_api response
  const playerMatch = text.match(/\/s\/player\/([a-zA-Z0-9_-]+)\/player_ias\.vflset/);
  if (playerMatch) {
    return `https://www.youtube.com/s/player/${playerMatch[1]}/player_ias.vflset/en_US/base.js`;
  }

  // Fallback: try to get from watch page
  const watchResponse = await fetch("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
    headers: {
      "User-Agent": CLIENTS.WEB.userAgent,
    },
  });

  const watchText = await watchResponse.text();
  const baseJsMatch = watchText.match(/\/s\/player\/([a-zA-Z0-9_-]+)\/player_ias\.vflset\/[a-zA-Z_]+\/base\.js/);

  if (baseJsMatch) {
    return `https://www.youtube.com${baseJsMatch[0]}`;
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

    // Find the signature decipher function
    // Pattern: var XX={...};XX.YY=function(a){...};
    const funcNameMatch = playerJs.match(/\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*encodeURIComponent\(([a-zA-Z0-9$]+)\(/);
    if (!funcNameMatch) {
      console.log("[DECIPHER] Could not find decipher function name");
      return null;
    }

    const funcName = funcNameMatch[1];
    console.log(`[DECIPHER] Found function name: ${funcName}`);

    // Find the function definition
    const funcPattern = new RegExp(
      `${funcName.replace(/\$/g, "\\$")}=function\\(a\\)\\{([^}]+)\\}`,
      "s"
    );
    const funcMatch = playerJs.match(funcPattern);

    if (!funcMatch) {
      console.log("[DECIPHER] Could not find function body");
      return null;
    }

    const funcBody = funcMatch[1];
    console.log(`[DECIPHER] Found function body: ${funcBody.substring(0, 100)}...`);

    // Find the helper object
    const helperObjMatch = funcBody.match(/;([a-zA-Z0-9$]+)\./);
    if (!helperObjMatch) {
      console.log("[DECIPHER] Could not find helper object");
      return null;
    }

    const helperObjName = helperObjMatch[1];
    console.log(`[DECIPHER] Found helper object: ${helperObjName}`);

    // Find helper object definition
    const helperPattern = new RegExp(
      `var ${helperObjName.replace(/\$/g, "\\$")}=\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`,
      "s"
    );
    const helperMatch = playerJs.match(helperPattern);

    if (!helperMatch) {
      console.log("[DECIPHER] Could not find helper object definition");
      return null;
    }

    const helperObjBody = helperMatch[1];
    console.log(`[DECIPHER] Found helper object body`);

    // Build the decipher function
    const helperCode = `var ${helperObjName}={${helperObjBody}};`;
    const decipherCode = `${helperCode}\nfunction decipher(a){${funcBody}};`;

    // Create and return the function
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const decipherFn = new Function(`${decipherCode}\nreturn decipher;`)() as (sig: string) => string;

    return decipherFn;
  } catch (error) {
    console.error("[DECIPHER] Error extracting decipher function:", error);
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
    return format;
  }

  // If signature cipher is present, decipher it
  if (format.signatureCipher) {
    const parsed = parseSignatureCipher(format.signatureCipher);
    if (parsed) {
      try {
        const decipheredSig = await decipherSignature(parsed.s);
        const url = new URL(parsed.url);
        url.searchParams.set(parsed.sp, decipheredSig);
        return { ...format, url: url.toString() };
      } catch (error) {
        console.error("[FORMAT] Failed to decipher signature:", error);
      }
    }
  }

  return format;
}

/**
 * Get video information and streaming URLs
 */
export async function getVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
  // Try different clients in order of preference
  const clientOrder: string[] = ["ANDROID", "IOS", "TV_EMBEDDED", "WEB"];

  let lastError: Error | null = null;

  for (const clientType of clientOrder) {
    try {
      console.log(`[CLIENT] Trying ${clientType} client...`);
      const playerResponse = await fetchPlayerResponse(videoId, clientType);

      // Check playability status
      if (playerResponse.playabilityStatus?.status !== "OK") {
        const reason = playerResponse.playabilityStatus?.reason || "Unknown error";
        console.log(`[CLIENT] ${clientType} failed: ${reason}`);

        // If video is age-gated, try TV_EMBEDDED client
        if (reason.includes("age") || reason.includes("Sign in")) {
          continue;
        }

        throw new Error(reason);
      }

      const videoDetails = playerResponse.videoDetails;
      const streamingData = playerResponse.streamingData;

      if (!videoDetails) {
        throw new Error("No video details in response");
      }

      // Process formats to get working URLs
      const formats: VideoFormat[] = [];
      const adaptiveFormats: VideoFormat[] = [];

      // Process muxed formats
      if (streamingData?.formats) {
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
      if (streamingData?.adaptiveFormats) {
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

      console.log(`[CLIENT] ${clientType} success! Found ${formats.length} formats, ${adaptiveFormats.length} adaptive formats`);

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
      console.log(`[CLIENT] ${clientType} error:`, lastError.message);
    }
  }

  throw lastError || new Error("Failed to get video info");
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

  // First try to find a muxed format (video + audio combined)
  if (preferMuxed && info.formats.length > 0) {
    const muxedFormats = info.formats.filter(f => f.url);

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

      return { video: selectedFormat };
    }
  }

  // Fall back to adaptive formats (separate video + audio)
  const videoFormats = info.adaptiveFormats.filter(f => f.hasVideo && f.url);
  const audioFormats = info.adaptiveFormats.filter(f => f.hasAudio && f.url);

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

  // First, get content length
  const headResponse = await fetch(url, {
    method: "HEAD",
    headers: {
      "User-Agent": CLIENTS.ANDROID.userAgent,
    },
  });

  const contentLength = headResponse.headers.get("content-length");
  const totalSize = contentLength ? parseInt(contentLength) : null;

  console.log(`[DOWNLOAD] Total size: ${totalSize ? (totalSize / 1024 / 1024).toFixed(2) : "unknown"} MB`);

  // If total size is small enough or unknown, download in one request
  if (!totalSize || totalSize < CHUNK_SIZE) {
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
    return new Uint8Array(buffer);
  }

  // Download in chunks
  const chunks: Uint8Array[] = [];
  let downloaded = 0;

  while (downloaded < totalSize) {
    const start = downloaded;
    const end = Math.min(downloaded + CHUNK_SIZE - 1, totalSize - 1);

    console.log(`[DOWNLOAD] Downloading chunk: ${start}-${end}`);

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
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

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

  console.log(`[DOWNLOAD] Selected format: ${video.qualityLabel || video.quality} (${video.mimeType})`);

  // If we have separate audio, we need to mux them (not implemented in browser)
  // For now, prefer muxed formats
  if (audio && !video.hasAudio) {
    console.log("[DOWNLOAD] Warning: Video and audio are separate. Audio may be missing.");
    console.log(`[DOWNLOAD] Audio format: ${audio.audioQuality} (${audio.mimeType})`);
  }

  // Download video
  onProgress?.(0, null, "Downloading video...");
  const buffer = await downloadStream(video.url, (downloaded, total) => {
    onProgress?.(downloaded, total, "Downloading...");
  });

  return { buffer, info, format: video };
}
