// Video Clipper Types

// Import types needed for Phase 7
import type { PlatformFormat } from './constants';

export interface UploadedVideo {
  url: string;
  filename: string;
  size: number;
  duration: number | null;
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

// Phase 2: Transcription types
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  fullText: string;
  segments: TranscriptSegment[];
}

export type TranscribeStatus = 'idle' | 'transcribing' | 'success' | 'error';

// Phase 3: AI Analysis types
export interface ClipSuggestion {
  startTime: number;
  endTime: number;
  type: 'hook' | 'testimonial' | 'benefit' | 'cta' | 'problem' | 'solution' | 'viral';
  reason: string;
  transcript: string;
}

export type AnalyzeStatus = 'idle' | 'analyzing' | 'success' | 'error';

// Phase 4: Clipping types
export interface GeneratedClip {
  url: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export type ClipStatus = 'idle' | 'generating' | 'success' | 'error';

// Phase 6: Caption types
export type CaptionStatus = 'idle' | 'generating' | 'success' | 'error';

export interface CaptionStyle {
  fontSize: 'small' | 'medium' | 'large';
  position: 'bottom' | 'center' | 'top';
  fontColor: string;
}

export interface CaptionState {
  status: CaptionStatus;
  captionedUrl?: string;
  error?: string;
}

// Phase 7: Export Variants - 3x2 Grid (3 aspect ratios × 2 caption options)
export type ExportStatus = 'idle' | 'generating' | 'success' | 'error';

// Each export variant can be with or without captions
export interface ExportVariant {
  url: string;
  width: number;
  height: number;
}

// The 6 possible exports per clip
export interface ClipExports {
  // Without captions
  vertical?: ExportVariant;      // 9:16 no captions
  square?: ExportVariant;        // 1:1 no captions
  horizontal?: ExportVariant;    // 16:9 no captions
  // With captions
  verticalCaptioned?: ExportVariant;   // 9:16 with captions
  squareCaptioned?: ExportVariant;     // 1:1 with captions
  horizontalCaptioned?: ExportVariant; // 16:9 with captions
}

// Key for each cell in the 3x2 grid
export type ExportKey =
  | 'vertical' | 'square' | 'horizontal'
  | 'verticalCaptioned' | 'squareCaptioned' | 'horizontalCaptioned';

// Status tracking for each export in the grid
export interface ExportState {
  status: ExportStatus;
  error?: string;
}

export type ExportStatesMap = {
  [K in ExportKey]?: ExportState;
};

// Legacy types for backwards compatibility
export type FormatStatus = ExportStatus;

export interface FormatVariant {
  format: PlatformFormat;
  url: string;
  width: number;
  height: number;
}

export interface FormatState {
  status: FormatStatus;
  variant?: FormatVariant;
  error?: string;
}

// Saved format variants structure (for job persistence) - now includes captioned versions
export interface SavedFormatVariants {
  [format: string]: {
    url: string;
    width: number;
    height: number;
  };
}

// Phase 5: Job types (after Phase 7 types since SavedClip references SavedFormatVariants)
export interface SavedClip {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  momentType: string;
  clipUrl: string | null;                           // Original clip (source aspect ratio)
  clipWithCaptionsUrl?: string | null;              // Legacy: captioned in source aspect ratio
  whySelected: string | null;
  transcript: string | null;
  exports?: ClipExports | null;                     // New: all 6 export variants
  platformRecommendations?: SavedFormatVariants | null; // Legacy: keep for backwards compat
}

export interface SavedJob {
  id: string;
  name: string;
  sourceType: string;
  uploadedVideoUrl: string | null;
  videoDuration: number | null;
  status: string;
  createdAt: string;
  clips: SavedClip[];
  transcript?: Transcript | null;
}

export type SaveJobStatus = 'idle' | 'saving' | 'success' | 'error';
