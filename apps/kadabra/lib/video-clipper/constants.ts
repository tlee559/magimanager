// Video Clipper Constants

export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

// Marketing Context Options
export const MARKETING_GOALS = [
  { value: 'awareness', label: 'Brand Awareness', description: 'Get more people to know about you' },
  { value: 'engagement', label: 'Engagement', description: 'Drive likes, comments, and shares' },
  { value: 'conversion', label: 'Conversion', description: 'Drive purchases or sign-ups' },
  { value: 'traffic', label: 'Traffic', description: 'Drive clicks to website or landing page' },
  { value: 'viral', label: 'Viral Reach', description: 'Maximize shareability and reach' },
] as const;

export const MARKETING_TONES = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'casual', label: 'Casual', emoji: '😊' },
  { value: 'energetic', label: 'Energetic', emoji: '⚡' },
  { value: 'emotional', label: 'Emotional', emoji: '❤️' },
  { value: 'educational', label: 'Educational', emoji: '📚' },
] as const;

// Psychological Triggers used in marketing
export const PSYCHOLOGICAL_TRIGGERS = [
  'FOMO',           // Fear of missing out
  'Social Proof',   // Others are doing it
  'Scarcity',       // Limited time/availability
  'Authority',      // Expert endorsement
  'Reciprocity',    // Give to get
  'Curiosity',      // Need to know more
  'Pain Point',     // Problem identification
  'Transformation', // Before/after
  'Trust',          // Credibility building
  'Urgency',        // Act now
] as const;
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

// Phase 7: Platform Format Variations - Simplified to 3 aspect ratios
export type PlatformFormat = 'vertical' | 'square' | 'horizontal';

export interface PlatformConfig {
  width: number;
  height: number;
  name: string;
  aspectRatio: string;
  description: string;
}

export const PLATFORM_FORMATS: Record<PlatformFormat, PlatformConfig> = {
  vertical: {
    width: 1080,
    height: 1920,
    name: 'Vertical',
    aspectRatio: '9:16',
    description: 'TikTok, Reels, Shorts'
  },
  square: {
    width: 1080,
    height: 1080,
    name: 'Square',
    aspectRatio: '1:1',
    description: 'Instagram, Facebook Feed'
  },
  horizontal: {
    width: 1920,
    height: 1080,
    name: 'Horizontal',
    aspectRatio: '16:9',
    description: 'YouTube, LinkedIn'
  },
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

// Export Grid Configuration for 3x2 grid (3 aspect ratios × 2 caption options)
export const EXPORT_GRID = {
  formats: ['vertical', 'square', 'horizontal'] as PlatformFormat[],
  captionOptions: [false, true] as const, // without, with
};

// Map export keys to display info
export interface ExportCellConfig {
  format: PlatformFormat;
  withCaptions: boolean;
  label: string;
}

export const EXPORT_CELLS: Record<string, ExportCellConfig> = {
  vertical: { format: 'vertical', withCaptions: false, label: '9:16' },
  square: { format: 'square', withCaptions: false, label: '1:1' },
  horizontal: { format: 'horizontal', withCaptions: false, label: '16:9' },
  verticalCaptioned: { format: 'vertical', withCaptions: true, label: '9:16 + Captions' },
  squareCaptioned: { format: 'square', withCaptions: true, label: '1:1 + Captions' },
  horizontalCaptioned: { format: 'horizontal', withCaptions: true, label: '16:9 + Captions' },
};
