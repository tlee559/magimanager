// Video Clipper Constants - Phase 1

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
