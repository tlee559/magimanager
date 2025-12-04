// Video Clipper Constants

export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
export const MAX_DURATION = 30 * 60; // 30 minutes in seconds
export const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov'];

export const ERRORS = {
  FILE_TOO_LARGE: 'File exceeds 1GB limit',
  INVALID_FORMAT: 'Use MP4, MOV, or WebM format',
  TOO_LONG: 'Video must be under 30 minutes',
  UPLOAD_FAILED: 'Upload failed. Please try again.',
  NO_FILE: 'No file selected',
};

// Phase 7: Platform Format Variations
export type PlatformFormat =
  | 'tiktok'
  | 'reels'
  | 'shorts'
  | 'meta_feed'
  | 'instagram_post'
  | 'youtube'
  | 'linkedin';

export interface PlatformConfig {
  width: number;
  height: number;
  name: string;
  aspectRatio: string;
  icon: string;
}

export const PLATFORM_FORMATS: Record<PlatformFormat, PlatformConfig> = {
  // Vertical (9:16) - 1080x1920
  tiktok: { width: 1080, height: 1920, name: 'TikTok', aspectRatio: '9:16', icon: '📱' },
  reels: { width: 1080, height: 1920, name: 'Instagram Reels', aspectRatio: '9:16', icon: '📸' },
  shorts: { width: 1080, height: 1920, name: 'YouTube Shorts', aspectRatio: '9:16', icon: '▶️' },

  // Square (1:1) - 1080x1080
  meta_feed: { width: 1080, height: 1080, name: 'Meta Feed', aspectRatio: '1:1', icon: '📘' },
  instagram_post: { width: 1080, height: 1080, name: 'Instagram Post', aspectRatio: '1:1', icon: '🖼️' },

  // Horizontal (16:9) - 1920x1080
  youtube: { width: 1920, height: 1080, name: 'YouTube', aspectRatio: '16:9', icon: '🎬' },
  linkedin: { width: 1920, height: 1080, name: 'LinkedIn', aspectRatio: '16:9', icon: '💼' },
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
