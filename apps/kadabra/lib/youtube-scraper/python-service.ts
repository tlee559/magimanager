/**
 * Python YouTube Downloader Service Client
 *
 * Calls the Railway-hosted Python service that uses yt-dlp.
 * This bypasses YouTube's bot detection that blocks serverless environments.
 */

const YOUTUBE_SERVICE_URL =
  process.env.YOUTUBE_SERVICE_URL ||
  "https://youtube-downloader-production-4222.up.railway.app";
const YOUTUBE_SERVICE_API_KEY =
  process.env.YOUTUBE_SERVICE_API_KEY || "yt-magi-secret-2024";

export interface PythonVideoFormat {
  format_id: string;
  ext: string;
  quality: string | number | null;
  resolution: string | null;
  filesize: number | null;
  vcodec: string | null;
  acodec: string | null;
  fps: number | null;
}

export interface PythonVideoInfo {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  view_count: number | null;
  formats: PythonVideoFormat[];
  best_video_url: string | null;
  best_audio_url: string | null;
}

export interface PythonDownloadUrlResponse {
  url: string;
  format_id: string;
  ext: string;
  filesize: number | null;
  quality: string | null;
}

export interface PythonServiceError {
  detail: string;
}

/**
 * Get video info from the Python service
 */
export async function getVideoInfoFromPython(
  url: string
): Promise<PythonVideoInfo> {
  console.log("[PYTHON] Fetching video info from Python service...");

  const response = await fetch(`${YOUTUBE_SERVICE_URL}/info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      api_key: YOUTUBE_SERVICE_API_KEY,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as PythonServiceError;
    throw new Error(`Python service error: ${error.detail || response.statusText}`);
  }

  const info = (await response.json()) as PythonVideoInfo;
  console.log(`[PYTHON] Got video info: "${info.title}"`);
  return info;
}

/**
 * Get a direct download URL from the Python service
 */
export async function getDownloadUrlFromPython(
  url: string,
  quality: "best" | "720p" | "480p" | "360p" = "best",
  format: "mp4" | "webm" | "mp3" = "mp4"
): Promise<PythonDownloadUrlResponse> {
  console.log(`[PYTHON] Getting download URL (quality: ${quality}, format: ${format})...`);

  const response = await fetch(`${YOUTUBE_SERVICE_URL}/download-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      api_key: YOUTUBE_SERVICE_API_KEY,
      quality,
      format,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as PythonServiceError;
    throw new Error(`Python service error: ${error.detail || response.statusText}`);
  }

  const result = (await response.json()) as PythonDownloadUrlResponse;
  console.log(`[PYTHON] Got download URL for format: ${result.format_id}`);
  return result;
}

/**
 * Check if the Python service is healthy
 */
export async function checkPythonServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${YOUTUBE_SERVICE_URL}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Download video via Python service (Railway downloads from YouTube, returns file to us)
 * This bypasses YouTube's IP blocking on Vercel
 */
export async function downloadVideoFromPython(
  url: string,
  quality: "best" | "720p" | "480p" | "360p" = "best",
  format: "mp4" | "webm" | "mp3" = "mp4"
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  console.log(`[PYTHON] Downloading video via Railway (quality: ${quality}, format: ${format})...`);

  const response = await fetch(`${YOUTUBE_SERVICE_URL}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      api_key: YOUTUBE_SERVICE_API_KEY,
      quality,
      format,
    }),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const error = (await response.json()) as PythonServiceError;
      errorDetail = error.detail || response.statusText;
    } catch {
      // Response might not be JSON
    }
    throw new Error(`Python service error: ${errorDetail}`);
  }

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers.get("content-disposition");
  let filename = "video.mp4";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  const contentType = response.headers.get("content-type") || "video/mp4";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`[PYTHON] Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB - ${filename}`);

  return { buffer, contentType, filename };
}
