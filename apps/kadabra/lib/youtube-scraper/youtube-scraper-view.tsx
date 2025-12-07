"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Loader2,
  Play,
  Trash2,
  Link2,
  Clock,
  Eye,
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Volume2,
  VolumeX,
  Maximize,
  Pause,
  Scissors,
} from "lucide-react";
import type { DownloadJob, YouTubeVideo } from "./types";

interface YouTubeScraperViewProps {
  onBack?: () => void;
}

export function YouTubeScraperView({ onBack }: YouTubeScraperViewProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<YouTubeVideo | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<DownloadJob | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved jobs on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Poll for job updates
  useEffect(() => {
    const pendingJobs = jobs.filter(
      (j) => j.status === "pending" || j.status === "downloading" || j.status === "processing"
    );

    if (pendingJobs.length > 0) {
      pollIntervalRef.current = setInterval(() => {
        fetchJobs();
      }, 2000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobs]);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/youtube-scraper/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  };

  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  };

  const fetchVideoInfo = async () => {
    if (!url.trim()) {
      setError("Please enter a YouTube URL");
      return;
    }

    if (!validateYouTubeUrl(url)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const res = await fetch("/api/youtube-scraper/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to fetch video info");
        return;
      }

      setVideoInfo(data.video);
    } catch (err) {
      setError("Failed to fetch video info. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async () => {
    if (!videoInfo) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/youtube-scraper/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          quality: "best",
          format: "mp4",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to start download");
        return;
      }

      // Add job to list and reset form
      setJobs((prev) => [data.job, ...prev]);
      setVideoInfo(null);
      setUrl("");
    } catch (err) {
      setError("Failed to start download. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/youtube-scraper/jobs/${jobId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (activeVideo?.id === jobId) {
          setActiveVideo(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete job:", err);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "Unknown";
    if (bytes >= 1073741824) {
      return `${(bytes / 1073741824).toFixed(2)} GB`;
    }
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  const getStatusIcon = (status: DownloadJob["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-slate-400" />;
      case "downloading":
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusText = (status: DownloadJob["status"]) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "downloading":
        return "Downloading...";
      case "processing":
        return "Processing...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Tools</span>
        </button>
      )}

      {/* URL Input Section */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Download YouTube Video</h2>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  fetchVideoInfo();
                }
              }}
              placeholder="Paste YouTube URL here..."
              className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-10 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50"
            />
          </div>
          <button
            onClick={fetchVideoInfo}
            disabled={loading || !url.trim()}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium rounded-lg hover:from-red-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Fetch Info
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Video Preview */}
        {videoInfo && (
          <div className="mt-6 bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
            <div className="flex gap-4">
              <div className="relative w-48 h-27 flex-shrink-0">
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white">
                  {formatDuration(videoInfo.duration)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-slate-100 font-medium truncate">{videoInfo.title}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {videoInfo.channel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {formatNumber(videoInfo.viewCount)} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {videoInfo.uploadDate}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 line-clamp-2">{videoInfo.description}</p>
                <button
                  onClick={startDownload}
                  disabled={loading}
                  className="mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {activeVideo && activeVideo.blobUrl && (
        <VideoPlayer video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}

      {/* Downloaded Videos */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Downloaded Videos</h2>
          <button
            onClick={fetchJobs}
            className="text-slate-400 hover:text-slate-200 transition p-2 hover:bg-slate-700/50 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Download className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No downloaded videos yet</p>
            <p className="text-sm mt-1">Paste a YouTube URL above to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30 hover:border-slate-600/50 transition"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="relative w-32 h-20 flex-shrink-0 group">
                    {job.videoInfo?.thumbnail ? (
                      <img
                        src={job.videoInfo.thumbnail}
                        alt={job.videoInfo.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-800 rounded-lg flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
                      </div>
                    )}
                    {job.status === "completed" && job.blobUrl && (
                      <button
                        onClick={() => setActiveVideo(job)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-lg"
                      >
                        <Play className="w-8 h-8 text-white" fill="currentColor" />
                      </button>
                    )}
                    {job.videoInfo?.duration && (
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white">
                        {formatDuration(job.videoInfo.duration)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-100 font-medium truncate">
                      {job.videoInfo?.title || "Loading..."}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        {getStatusIcon(job.status)}
                        {getStatusText(job.status)}
                        {job.progress > 0 && job.progress < 100 && ` (${job.progress}%)`}
                      </span>
                      {job.fileSize && (
                        <span className="text-slate-500">{formatFileSize(job.fileSize)}</span>
                      )}
                    </div>
                    {job.error && <p className="mt-1 text-xs text-red-400">{job.error}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {job.status === "completed" && job.blobUrl && (
                      <>
                        <button
                          onClick={() => setActiveVideo(job)}
                          className="p-2 text-slate-400 hover:text-green-400 hover:bg-slate-700/50 rounded-lg transition"
                          title="Play"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <a
                          href={job.blobUrl}
                          download={`${job.videoInfo?.title || "video"}.mp4`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => {
                            localStorage.setItem(
                              "videoClipper_sourceVideo",
                              JSON.stringify({
                                url: job.blobUrl,
                                title: job.videoInfo?.title,
                                duration: job.videoInfo?.duration,
                                thumbnail: job.videoInfo?.thumbnail,
                              })
                            );
                            router.push("/admin/tools/video-clipper");
                          }}
                          className="p-2 text-slate-400 hover:text-purple-400 hover:bg-slate-700/50 rounded-lg transition"
                          title="Send to Video Clipper"
                        >
                          <Scissors className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {(job.status === "downloading" || job.status === "processing") && (
                  <div className="mt-3 w-full bg-slate-700/50 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-red-500 to-orange-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}

                {/* Debug info for failed/in-progress jobs */}
                {job.debug && job.debug.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                      Debug logs ({job.debug.length} entries)
                    </summary>
                    <div className="mt-2 p-2 bg-slate-950 rounded text-xs font-mono text-slate-400 max-h-40 overflow-y-auto">
                      {job.debug.map((log, i) => (
                        <div key={i} className={log.includes("ERROR") ? "text-red-400" : ""}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Video Player Component
function VideoPlayer({
  video,
  onClose,
}: {
  video: DownloadJob;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = percent * videoRef.current.duration;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full bg-slate-900 rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Video */}
        <video
          ref={videoRef}
          src={video.blobUrl}
          className="w-full aspect-video bg-black"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={togglePlay}
          muted={muted}
        />

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress bar */}
          <div
            className="w-full h-1 bg-slate-700/50 rounded-full cursor-pointer mb-3"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-red-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="p-2 text-white hover:text-red-400 transition"
            >
              {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" fill="currentColor" />}
            </button>

            <button
              onClick={() => setMuted(!muted)}
              className="p-2 text-white hover:text-red-400 transition"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <span className="text-sm text-white/80">
              {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <button
              onClick={toggleFullscreen}
              className="p-2 text-white hover:text-red-400 transition"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="p-4 border-t border-slate-700/50">
          <h3 className="text-slate-100 font-medium">{video.videoInfo?.title}</h3>
          <p className="text-sm text-slate-400 mt-1">{video.videoInfo?.channel}</p>
        </div>
      </div>
    </div>
  );
}
