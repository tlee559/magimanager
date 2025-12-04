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

// Marketing context for AI analysis
export interface MarketingContext {
  product: string;           // What is being sold/promoted
  audience: string;          // Target audience description
  goal: string;              // Marketing goal (awareness, conversion, etc.)
  tone: 'professional' | 'casual' | 'energetic' | 'emotional' | 'educational';
}

// Clip scoring - rates each moment on marketing effectiveness
export interface ClipScores {
  hookStrength: number;        // 1-10: How attention-grabbing is the opening
  emotionalImpact: number;     // 1-10: Emotional resonance (fear, joy, curiosity, etc.)
  conversionPotential: number; // 1-10: Likelihood to drive action
  viralPotential: number;      // 1-10: Shareability factor
  overallScore: number;        // 1-10: Weighted average
}

// Platform-specific recommendations per clip
export interface PlatformRecommendation {
  platform: string;
  suggestedCaption: string;
  hashtags: string[];
  bestTimeToPost?: string;
  whyThisPlatform: string;
}

// Phase 3: AI Analysis types
export interface ClipSuggestion {
  startTime: number;
  endTime: number;
  type: 'hook' | 'testimonial' | 'benefit' | 'cta' | 'problem' | 'solution' | 'viral';
  reason: string;
  transcript: string;
  // New marketing-focused fields
  scores?: ClipScores;
  platformRecommendations?: PlatformRecommendation[];
  psychologicalTrigger?: string;   // e.g., "FOMO", "Social Proof", "Scarcity"
  suggestedCTA?: string;           // AI-generated call to action
}

export type AnalyzeStatus = 'idle' | 'analyzing' | 'success' | 'error';

// Phase 4: Clipping types
export interface GeneratedClip {
  url: string;
  startTime: number;
  endTime: number;
  duration: number;
}

// Trim adjustment for fine-tuning clip boundaries
export interface TrimAdjustment {
  startOffset: number;  // Seconds to add/subtract from start (-5 to +5)
  endOffset: number;    // Seconds to add/subtract from end (-5 to +5)
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

// Background processing state (stored in DB)
export interface ExportProcessingState {
  status: 'processing' | 'completed' | 'failed';
  predictionId?: string;
  step?: 'resize' | 'caption';
  error?: string;
  result?: {
    url: string;
    width: number;
    height: number;
  };
}

// Extended ClipExports with processing states for DB storage
export interface ClipExportsWithProcessing extends ClipExports {
  _processing?: {
    [K in ExportKey]?: ExportProcessingState;
  };
}

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
  platformRecommendations?: ClipExportsWithProcessing | SavedFormatVariants | null; // Can contain processing states
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
