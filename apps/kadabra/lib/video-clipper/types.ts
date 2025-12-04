// Video Clipper Types

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

// Phase 5: Job types
export interface SavedClip {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  momentType: string;
  clipUrl: string | null;
  whySelected: string | null;
  transcript: string | null;
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
}

export type SaveJobStatus = 'idle' | 'saving' | 'success' | 'error';

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
