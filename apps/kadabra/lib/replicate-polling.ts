/**
 * Replicate Polling Helper
 * Reliable alternative to webhooks - polls Replicate API until completion
 */

const REPLICATE_API_URL = "https://api.replicate.com/v1";

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error: string | null;
  logs: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ReplicatePollingOptions {
  maxWaitMs?: number;
  pollIntervalMs?: number;
  onProgress?: (prediction: ReplicatePrediction) => void;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start a Replicate prediction and poll until completion
 * Returns the output directly, handling all the polling logic
 */
export async function runReplicateWithPolling<T = unknown>(
  model: string,
  input: Record<string, unknown>,
  options: ReplicatePollingOptions = {}
): Promise<T> {
  const {
    maxWaitMs = 300000, // 5 minutes default
    pollIntervalMs = 3000, // 3 seconds
    onProgress,
  } = options;

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  // Start the prediction
  console.log(`[Replicate] Starting prediction for model: ${model}`);
  const createResponse = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: model,
      input,
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to start Replicate prediction: ${errorText}`);
  }

  const prediction: ReplicatePrediction = await createResponse.json();
  console.log(`[Replicate] Prediction started: ${prediction.id}`);

  // Poll until completion
  const startTime = Date.now();
  let lastStatus = prediction.status;

  while (Date.now() - startTime < maxWaitMs) {
    const statusResponse = await fetch(
      `${REPLICATE_API_URL}/predictions/${prediction.id}`,
      {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      }
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to check prediction status: ${statusResponse.statusText}`);
    }

    const currentPrediction: ReplicatePrediction = await statusResponse.json();

    // Log status changes
    if (currentPrediction.status !== lastStatus) {
      console.log(`[Replicate] ${prediction.id} status: ${lastStatus} -> ${currentPrediction.status}`);
      lastStatus = currentPrediction.status;
    }

    // Call progress callback if provided
    if (onProgress) {
      onProgress(currentPrediction);
    }

    // Check for completion
    if (currentPrediction.status === "succeeded") {
      console.log(`[Replicate] Prediction completed successfully in ${Date.now() - startTime}ms`);
      return currentPrediction.output as T;
    }

    if (currentPrediction.status === "failed") {
      console.error(`[Replicate] Prediction failed: ${currentPrediction.error}`);
      throw new Error(`Replicate prediction failed: ${currentPrediction.error || "Unknown error"}`);
    }

    if (currentPrediction.status === "canceled") {
      throw new Error("Replicate prediction was canceled");
    }

    // Wait before next poll
    await sleep(pollIntervalMs);
  }

  // Timeout - try to cancel the prediction
  console.error(`[Replicate] Prediction ${prediction.id} timed out after ${maxWaitMs}ms`);
  try {
    await fetch(`${REPLICATE_API_URL}/predictions/${prediction.id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}` },
    });
  } catch {
    // Ignore cancel errors
  }

  throw new Error(`Replicate prediction timed out after ${maxWaitMs / 1000} seconds`);
}

/**
 * Download a file from a URL with retry logic
 * Critical: Replicate outputs expire after 1 hour, so download immediately
 */
export async function downloadWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Download] Attempt ${attempt}/${maxRetries}: ${url.substring(0, 100)}...`);

      const response = await fetch(url, {
        // 60 second timeout per attempt
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`[Download] Success: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Download] Attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw new Error(`Download failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Check the status of an existing prediction
 * Useful for debugging and recovery
 */
export async function checkPredictionStatus(
  predictionId: string
): Promise<ReplicatePrediction> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  const response = await fetch(`${REPLICATE_API_URL}/predictions/${predictionId}`, {
    headers: {
      Authorization: `Token ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check prediction: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Cancel a running prediction
 */
export async function cancelPrediction(predictionId: string): Promise<void> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  await fetch(`${REPLICATE_API_URL}/predictions/${predictionId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
    },
  });
}

// Model version IDs for video processing
export const REPLICATE_MODELS = {
  // YouTube transcription (downloads + transcribes)
  YT_WHISPER: "zsxkib/yt-whisper:95fc0093e387a290b6ce58f544dd9fc86c40bfc9aef5cd8ed268c2fa8b5b17cc",

  // Fast transcription from audio/video file
  INCREDIBLY_FAST_WHISPER: "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",

  // Video trimming (FFmpeg-based)
  TRIM_VIDEO: "lucataco/trim-video:a58ed80215326cba0a80c77a11dd0d0968c567388228891b3c5c67de2a8d10cb",

  // Frame extraction for thumbnails
  FRAME_EXTRACTOR: "lucataco/frame-extractor:c02b3c1df64728476b1c21b0876235119e6ac08b0c9b8a99b82c5f0e0d42442d",

  // Auto-captioning
  AUTOCAPTION: "fictions-ai/autocaption:18a45ff0d95feb4449d192bbdc06b4a6df168fa33def76dfc51b78ae224b599b",
} as const;
