export interface YouTubeVideo {
  id: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number; // seconds
  uploadDate: string;
  viewCount: number;
  likeCount?: number;
  channel: string;
  channelUrl: string;
}

export interface DownloadJob {
  id: string;
  url: string;
  status: "pending" | "downloading" | "processing" | "completed" | "failed";
  progress: number;
  videoInfo?: YouTubeVideo;
  downloadUrl?: string;
  blobUrl?: string;
  fileSize?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadRequest {
  url: string;
  quality?: "best" | "720p" | "480p" | "360p";
  format?: "mp4" | "webm";
}

export interface VideoInfoResponse {
  success: boolean;
  video?: YouTubeVideo;
  error?: string;
}

export interface DownloadResponse {
  success: boolean;
  job?: DownloadJob;
  error?: string;
}

export interface JobStatusResponse {
  success: boolean;
  job?: DownloadJob;
  error?: string;
}
