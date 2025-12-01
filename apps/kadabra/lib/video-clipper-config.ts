/**
 * Video Clipper Configuration Validation
 * Ensures all required environment variables are set before processing
 */

export interface VideoClipperConfigResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    replicateApiToken: string | null;
    blobReadWriteToken: string | null;
    googleApiKey: string | null;
    webhookBaseUrl: string | null;
  };
}

/**
 * Validates all required environment variables for the video clipper
 * Call this at the start of job creation to fail fast
 */
export function validateVideoClipperConfig(): VideoClipperConfigResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: Replicate API for video processing
  const replicateApiToken = process.env.REPLICATE_API_TOKEN || null;
  if (!replicateApiToken) {
    errors.push("REPLICATE_API_TOKEN is required for video processing");
  }

  // Required: Vercel Blob for file storage
  const blobReadWriteToken = process.env.BLOB_READ_WRITE_TOKEN || null;
  if (!blobReadWriteToken) {
    errors.push("BLOB_READ_WRITE_TOKEN is required for file storage");
  }

  // Required: Google API for AI analysis
  const googleApiKey = process.env.GOOGLE_API_KEY || null;
  if (!googleApiKey) {
    warnings.push("GOOGLE_API_KEY not set - AI analysis will use simplified fallback");
  }

  // Required: Base URL for webhooks (fallback handled)
  const webhookBaseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || null;
  if (!webhookBaseUrl) {
    warnings.push("NEXTAUTH_URL not set - webhook callbacks may not work");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config: {
      replicateApiToken,
      blobReadWriteToken,
      googleApiKey,
      webhookBaseUrl,
    },
  };
}

/**
 * Error messages for different failure scenarios
 */
export const VIDEO_CLIPPER_ERRORS = {
  CONFIG_INVALID: "Server configuration error. Please contact support.",
  YOUTUBE_DOWNLOAD_FAILED: "Could not download YouTube video. Please try uploading the file directly.",
  TRANSCRIPTION_FAILED: "Failed to transcribe video audio. Please try a different video or shorter clip.",
  ANALYSIS_FAILED: "AI analysis failed. Please try again.",
  CLIP_GENERATION_FAILED: "Failed to generate video clip. Please try again.",
  CLIP_GENERATION_TIMEOUT: "Clip generation timed out. The video may be too long or complex.",
  UPLOAD_FAILED: "Video upload failed. Please check file size (max 500MB) and format.",
  THUMBNAIL_FAILED: "Failed to generate thumbnail.",
  CAPTION_FAILED: "Failed to add captions to clip.",
  INVALID_VIDEO_URL: "Invalid video URL provided.",
  VIDEO_TOO_LONG: "Video is too long. Maximum supported duration is 60 minutes.",
  NO_MOMENTS_FOUND: "No marketing moments found in the video. Try a different video.",
} as const;

export type VideoClipperErrorKey = keyof typeof VIDEO_CLIPPER_ERRORS;
