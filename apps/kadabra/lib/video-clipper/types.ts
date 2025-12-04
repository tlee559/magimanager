// Video Clipper Types - Phase 1

export interface UploadedVideo {
  url: string;
  filename: string;
  size: number;
  duration: number | null;
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
