"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import {
  ArrowLeft,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  Download,
  Trash2,
  Clock,
  Scissors,
  Target,
  TrendingUp,
  Zap,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Film,
  Type,
  Palette,
  Settings,
  X,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface VideoClipJob {
  id: string;
  name?: string;
  sourceType: "youtube" | "upload";
  sourceUrl?: string;
  uploadedVideoUrl?: string;
  videoDuration?: number;
  videoTitle?: string;
  videoThumbnail?: string;
  status: "PENDING" | "DOWNLOADING" | "ANALYZING" | "CLIPPING" | "CAPTIONING" | "COMPLETED" | "FAILED";
  progress: number;
  processingError?: string;
  analysisResults?: string;
  targetFormat: string;
  targetDuration: number;
  maxClips: number;
  addCaptions: boolean;
  captionStyle: string;
  industry?: string;
  productContext?: string;
  targetAudience?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  clips: VideoClip[];
}

interface VideoClip {
  id: string;
  jobId: string;
  startTime: number;
  endTime: number;
  duration: number;
  momentType: string;
  marketingScore: number;
  conversionPotential: number;
  hookStrength: number;
  emotionalImpact: number;
  whySelected: string;
  suggestedCaption?: string;
  keyMoments?: string;
  transcript?: string;
  status: "PENDING" | "PROCESSING" | "CAPTIONING" | "COMPLETED" | "FAILED";
  processingProgress: number;
  processingError?: string;
  clipUrl?: string;
  clipWithCaptionsUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MOMENT_TYPES = {
  hook: { label: "Hook", icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  testimonial: { label: "Testimonial", icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-500/10" },
  benefit: { label: "Benefit", icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10" },
  cta: { label: "Call to Action", icon: Target, color: "text-purple-400", bg: "bg-purple-500/10" },
  social_proof: { label: "Social Proof", icon: CheckCircle, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  urgency: { label: "Urgency", icon: Clock, color: "text-red-400", bg: "bg-red-500/10" },
};

const INDUSTRIES = [
  { value: "saas", label: "SaaS / Software" },
  { value: "ecommerce", label: "E-commerce / Retail" },
  { value: "coaching", label: "Coaching / Consulting" },
  { value: "agency", label: "Marketing Agency" },
  { value: "fitness", label: "Fitness / Health" },
  { value: "finance", label: "Finance / Investing" },
  { value: "education", label: "Education / Courses" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const CAPTION_STYLES = [
  { value: "minimal", label: "Minimal", description: "Clean, simple text" },
  { value: "modern", label: "Modern", description: "Animated with highlights" },
  { value: "bold", label: "Bold", description: "Large, attention-grabbing" },
  { value: "branded", label: "Branded", description: "Custom colors & fonts" },
];

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusColor(status: VideoClipJob["status"]): string {
  switch (status) {
    case "COMPLETED":
      return "text-emerald-400";
    case "FAILED":
      return "text-red-400";
    case "PENDING":
      return "text-slate-400";
    default:
      return "text-violet-400";
  }
}

function getStatusBg(status: VideoClipJob["status"]): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500/10 border-emerald-500/20";
    case "FAILED":
      return "bg-red-500/10 border-red-500/20";
    case "PENDING":
      return "bg-slate-500/10 border-slate-500/20";
    default:
      return "bg-violet-500/10 border-violet-500/20";
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

// ============================================================================
// INPUT STEP - SOURCE SELECTION
// ============================================================================

function InputStep({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: {
    sourceType: "upload";
    uploadedFile: File;
    name?: string;
    targetFormat: string;
    targetDuration: number;
    maxClips: number;
    addCaptions: boolean;
    captionStyle: string;
    industry?: string;
    productContext?: string;
    targetAudience?: string;
  }) => void;
  isLoading: boolean;
}) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [targetFormat, setTargetFormat] = useState("vertical");
  const [targetDuration, setTargetDuration] = useState(60);
  const [maxClips, setMaxClips] = useState(5);
  const [addCaptions, setAddCaptions] = useState(true);
  const [captionStyle, setCaptionStyle] = useState("modern");
  const [industry, setIndustry] = useState("");
  const [productContext, setProductContext] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setUploadedFile(file);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) return;

    onSubmit({
      sourceType: "upload",
      uploadedFile,
      name: name || undefined,
      targetFormat,
      targetDuration,
      maxClips,
      addCaptions,
      captionStyle,
      industry: industry || undefined,
      productContext: productContext || undefined,
      targetAudience: targetAudience || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 mb-4">
          <Scissors className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">
          AI Video Clipper
        </h2>
        <p className="text-sm text-slate-400">
          Transform long videos into high-converting vertical clips for Reels & TikTok
        </p>
      </div>

      {/* File Upload */}
      <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-pink-400" />
              Upload Video File *
            </div>
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              uploadedFile
                ? "border-violet-500 bg-violet-500/10"
                : "border-slate-700 hover:border-slate-600"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadedFile ? (
              <div className="space-y-2">
                <Film className="w-10 h-10 text-violet-400 mx-auto" />
                <p className="text-slate-100 font-medium">{uploadedFile.name}</p>
                <p className="text-xs text-slate-400">
                  {formatFileSize(uploadedFile.size)}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadedFile(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-slate-400">
                  Drag & drop or click to upload
                </p>
                <p className="text-xs text-slate-500">
                  MP4, MOV, WebM up to 500MB
                </p>
              </div>
            )}
          </div>
        </div>

      {/* Project Name */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Project Name (Optional)
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Video Clips"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* Output Format */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-pink-400" />
            Output Format
          </div>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "vertical", label: "Vertical", desc: "9:16 (Reels/TikTok)" },
            { value: "square", label: "Square", desc: "1:1 (Feed)" },
            { value: "horizontal", label: "Horizontal", desc: "16:9 (YouTube)" },
          ].map((format) => (
            <button
              key={format.value}
              type="button"
              onClick={() => setTargetFormat(format.value)}
              className={`p-3 rounded-xl border transition text-left ${
                targetFormat === format.value
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-slate-700 hover:border-slate-600"
              }`}
            >
              <span className="block text-sm font-medium text-slate-100">
                {format.label}
              </span>
              <span className="block text-xs text-slate-500">{format.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Clip Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-pink-400" />
              Target Clip Duration
            </div>
          </label>
          <select
            value={targetDuration}
            onChange={(e) => setTargetDuration(Number(e.target.value))}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 transition appearance-none cursor-pointer"
          >
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
            <option value={90}>90 seconds</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-pink-400" />
              Max Clips
            </div>
          </label>
          <select
            value={maxClips}
            onChange={(e) => setMaxClips(Number(e.target.value))}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 transition appearance-none cursor-pointer"
          >
            <option value={3}>3 clips</option>
            <option value={5}>5 clips</option>
            <option value={10}>10 clips</option>
            <option value={15}>15 clips</option>
          </select>
        </div>
      </div>

      {/* Captions Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
        <div className="flex items-center gap-3">
          <Type className="w-5 h-5 text-pink-400" />
          <div>
            <span className="text-sm font-medium text-slate-100">Auto-Captions</span>
            <p className="text-xs text-slate-500">Add dynamic captions to clips</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAddCaptions(!addCaptions)}
          className={`relative w-12 h-6 rounded-full transition ${
            addCaptions ? "bg-violet-500" : "bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${
              addCaptions ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>

      {/* Caption Style */}
      {addCaptions && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-pink-400" />
              Caption Style
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CAPTION_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => setCaptionStyle(style.value)}
                className={`p-3 rounded-xl border transition text-left ${
                  captionStyle === style.value
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <span className="block text-sm font-medium text-slate-100">
                  {style.label}
                </span>
                <span className="block text-xs text-slate-500">
                  {style.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Settings Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition"
      >
        <Settings className="w-4 h-4" />
        Advanced Settings
        {showAdvanced ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Industry Context
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 transition appearance-none cursor-pointer"
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Helps AI identify industry-specific selling points
            </p>
          </div>

          {/* Product Context */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Product/Service Context
            </label>
            <textarea
              value={productContext}
              onChange={(e) => setProductContext(e.target.value)}
              placeholder="What product or service is being promoted in this video?"
              rows={2}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
            />
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Target Audience
            </label>
            <textarea
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Who is the ideal viewer for these clips?"
              rows={2}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !uploadedFile}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating Project...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Find High-Converting Clips
          </>
        )}
      </button>
    </form>
  );
}

// ============================================================================
// PROCESSING VIEW
// ============================================================================

function ProcessingView({
  job,
  onCancel,
}: {
  job: VideoClipJob;
  onCancel: () => void;
}) {
  const getStatusMessage = () => {
    switch (job.status) {
      case "PENDING":
        return "Queuing your request...";
      case "DOWNLOADING":
        return "Downloading video...";
      case "ANALYZING":
        return "AI analyzing for high-converting moments...";
      case "CLIPPING":
        return "Creating clips...";
      case "CAPTIONING":
        return "Adding auto-captions...";
      default:
        return "Processing...";
    }
  };

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      {/* Animated Processing Icon */}
      <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-violet-500/20" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin"
          style={{ animationDuration: "1.5s" }}
        />
        <Scissors className="w-10 h-10 text-violet-400" />
      </div>

      {/* Status */}
      <h3 className="text-xl font-semibold text-slate-100 mb-2">
        {getStatusMessage()}
      </h3>
      <p className="text-sm text-slate-400 mb-6">
        {job.videoTitle || "Processing your video"}
      </p>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all duration-500"
          style={{ width: `${job.progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mb-8">{job.progress}% complete</p>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
      >
        Cancel
      </button>
    </div>
  );
}

// ============================================================================
// CLIP CARD
// ============================================================================

function ClipCard({
  clip,
  onPreview,
}: {
  clip: VideoClip;
  onPreview: (clip: VideoClip) => void;
}) {
  const momentConfig = MOMENT_TYPES[clip.momentType as keyof typeof MOMENT_TYPES] || {
    label: clip.momentType,
    icon: Zap,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
  };
  const MomentIcon = momentConfig.icon;

  // Check if we have a real video or thumbnail
  const hasVideo = clip.clipUrl && clip.clipUrl.length > 0;
  const hasThumbnail = clip.thumbnailUrl && clip.thumbnailUrl.length > 0;

  const handleDownload = async (e: React.MouseEvent, url: string, filename: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition">
      {/* Thumbnail/Preview */}
      <div
        className="relative aspect-[9/16] bg-gradient-to-br from-slate-800 to-slate-900 cursor-pointer group"
        onClick={() => onPreview(clip)}
      >
        {/* Show real thumbnail if available */}
        {hasThumbnail ? (
          <img
            src={clip.thumbnailUrl}
            alt="Clip thumbnail"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* Fallback gradient background with clip info */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <div className={`p-3 rounded-2xl ${momentConfig.bg} mb-3`}>
              <MomentIcon className={`w-8 h-8 ${momentConfig.color}`} />
            </div>
            <span className={`text-sm font-semibold ${momentConfig.color} mb-1`}>
              {momentConfig.label}
            </span>
            <span className="text-xs text-slate-500">
              {formatDuration(clip.startTime)} - {formatDuration(clip.endTime)}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
          <div className="text-center">
            <Play className="w-10 h-10 text-white mx-auto mb-2" />
            <span className="text-xs text-white/80">{hasVideo ? "Play Clip" : "View Details"}</span>
          </div>
        </div>

        {/* Moment Type Badge */}
        {hasThumbnail && (
          <div className={`absolute top-2 left-2 px-2 py-1 ${momentConfig.bg} rounded text-xs ${momentConfig.color} font-medium`}>
            {momentConfig.label}
          </div>
        )}

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white font-medium">
          {formatDuration(clip.duration)}
        </div>

        {/* Status Badge */}
        {clip.status !== "COMPLETED" && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-violet-500/80 rounded text-xs text-white flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {clip.status === "PROCESSING" ? "Processing" : clip.status === "PENDING" ? "Queued" : "Captioning"}
          </div>
        )}

        {/* Video Ready Badge */}
        {hasVideo && clip.status === "COMPLETED" && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/80 rounded text-xs text-white flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Ready
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-3">
        {/* Scores */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-slate-900/50 rounded-lg">
            <div className={`text-lg font-bold ${getScoreColor(clip.marketingScore)}`}>
              {clip.marketingScore}
            </div>
            <div className="text-[10px] text-slate-500 uppercase">Marketing</div>
          </div>
          <div className="text-center p-2 bg-slate-900/50 rounded-lg">
            <div className={`text-lg font-bold ${getScoreColor(clip.conversionPotential)}`}>
              {clip.conversionPotential}
            </div>
            <div className="text-[10px] text-slate-500 uppercase">Conversion</div>
          </div>
        </div>

        {/* Why Selected */}
        <p className="text-xs text-slate-400 line-clamp-2">{clip.whySelected}</p>

        {/* Download Buttons - show if video is ready */}
        {hasVideo && clip.status === "COMPLETED" && (
          <div className="flex gap-2">
            <button
              onClick={(e) => handleDownload(e, clip.clipUrl!, `clip-${clip.id}.mp4`)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition"
            >
              <Download className="w-3 h-3" />
              Video
            </button>
            {clip.clipWithCaptionsUrl && (
              <button
                onClick={(e) => handleDownload(e, clip.clipWithCaptionsUrl!, `clip-${clip.id}-captions.mp4`)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs text-white transition"
              >
                <Download className="w-3 h-3" />
                + Captions
              </button>
            )}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => onPreview(clip)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-500 hover:bg-violet-400 rounded-lg text-xs text-white transition"
        >
          {hasVideo ? <Play className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {hasVideo ? "Play & Analyze" : "View Analysis"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// CLIP PREVIEW MODAL
// ============================================================================

function ClipPreviewModal({
  clip,
  onClose,
}: {
  clip: VideoClip;
  onClose: () => void;
}) {
  const [showCaptionedVersion, setShowCaptionedVersion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const momentConfig = MOMENT_TYPES[clip.momentType as keyof typeof MOMENT_TYPES] || {
    label: clip.momentType,
    icon: Zap,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
  };
  const MomentIcon = momentConfig.icon;

  const hasVideo = clip.clipUrl && clip.clipUrl.length > 0;
  const hasCaptionedVideo = clip.clipWithCaptionsUrl && clip.clipWithCaptionsUrl.length > 0;
  const currentVideoUrl = showCaptionedVersion && hasCaptionedVideo ? clip.clipWithCaptionsUrl : clip.clipUrl;

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${momentConfig.bg}`}>
              <MomentIcon className={`w-5 h-5 ${momentConfig.color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">
                {momentConfig.label}
              </h3>
              <p className="text-xs text-slate-500">
                {formatDuration(clip.startTime)} - {formatDuration(clip.endTime)} ({formatDuration(clip.duration)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        {hasVideo && (
          <div className="relative bg-black">
            <video
              ref={videoRef}
              src={currentVideoUrl!}
              className="w-full aspect-[9/16] max-h-[50vh] object-contain bg-black"
              controls
              playsInline
            />

            {/* Video Version Toggle */}
            {hasCaptionedVideo && (
              <div className="absolute top-2 right-2 flex gap-1 bg-black/70 rounded-lg p-1">
                <button
                  onClick={() => {
                    setShowCaptionedVersion(false);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    !showCaptionedVersion
                      ? "bg-violet-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => {
                    setShowCaptionedVersion(true);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    showCaptionedVersion
                      ? "bg-violet-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Type className="w-3 h-3 inline mr-1" />
                  Captions
                </button>
              </div>
            )}
          </div>
        )}

        {/* No Video - Show Thumbnail or Placeholder */}
        {!hasVideo && (
          <div className="relative aspect-[9/16] max-h-[40vh] bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
            {clip.thumbnailUrl ? (
              <img
                src={clip.thumbnailUrl}
                alt="Clip thumbnail"
                className="absolute inset-0 w-full h-full object-cover opacity-50"
              />
            ) : null}
            <div className="relative z-10 text-center">
              <div className={`p-4 rounded-2xl ${momentConfig.bg} mb-4 inline-block`}>
                <MomentIcon className={`w-10 h-10 ${momentConfig.color}`} />
              </div>
              <p className="text-sm text-slate-400">
                {clip.status === "PROCESSING" || clip.status === "CAPTIONING" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Processing video...
                  </>
                ) : clip.status === "PENDING" ? (
                  "Video processing queued"
                ) : (
                  "Video preview not available"
                )}
              </p>
            </div>
          </div>
        )}

        {/* Download Buttons */}
        {hasVideo && (
          <div className="p-4 border-b border-slate-800 flex gap-2">
            <button
              onClick={() => handleDownload(clip.clipUrl!, `clip-${clip.id}.mp4`)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-white transition"
            >
              <Download className="w-4 h-4" />
              Download Video
            </button>
            {hasCaptionedVideo && (
              <button
                onClick={() => handleDownload(clip.clipWithCaptionsUrl!, `clip-${clip.id}-captions.mp4`)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm text-white transition"
              >
                <Download className="w-4 h-4" />
                <Type className="w-4 h-4" />
                With Captions
              </button>
            )}
          </div>
        )}

        {/* Scores Grid */}
        <div className="p-4 border-b border-slate-800">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-slate-800/50 rounded-xl">
              <div className={`text-2xl font-bold ${getScoreColor(clip.marketingScore)}`}>
                {clip.marketingScore}
              </div>
              <div className="text-[10px] text-slate-500 uppercase mt-1">Marketing</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-xl">
              <div className={`text-2xl font-bold ${getScoreColor(clip.conversionPotential)}`}>
                {clip.conversionPotential}
              </div>
              <div className="text-[10px] text-slate-500 uppercase mt-1">Conversion</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-xl">
              <div className={`text-2xl font-bold ${getScoreColor(clip.hookStrength)}`}>
                {clip.hookStrength}
              </div>
              <div className="text-[10px] text-slate-500 uppercase mt-1">Hook</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-xl">
              <div className={`text-2xl font-bold ${getScoreColor(clip.emotionalImpact)}`}>
                {clip.emotionalImpact}
              </div>
              <div className="text-[10px] text-slate-500 uppercase mt-1">Emotion</div>
            </div>
          </div>
        </div>

        {/* Analysis Content */}
        <div className="p-4 space-y-4 max-h-[30vh] overflow-y-auto">
          {/* Why Selected */}
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase mb-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              Why This Moment
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">{clip.whySelected}</p>
          </div>

          {/* Suggested Caption */}
          {clip.suggestedCaption && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase mb-2 flex items-center gap-2">
                <Type className="w-3.5 h-3.5 text-pink-400" />
                Suggested Caption
              </h4>
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-sm text-slate-200 font-medium">&ldquo;{clip.suggestedCaption}&rdquo;</p>
              </div>
            </div>
          )}

          {/* Transcript */}
          {clip.transcript && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase mb-2 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                Transcript
              </h4>
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-sm text-slate-400 italic">&ldquo;{clip.transcript}&rdquo;</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!hasVideo && (
          <div className="p-4 border-t border-slate-800 bg-slate-800/30">
            <div className="text-center text-xs text-slate-500">
              Use timestamps above to clip this moment in your video editor.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RESULTS VIEW
// ============================================================================

function ResultsView({
  job,
  onBack,
}: {
  job: VideoClipJob;
  onBack: () => void;
}) {
  const [previewClip, setPreviewClip] = useState<VideoClip | null>(null);
  const completedClips = job.clips.filter((c) => c.status === "COMPLETED");
  const sortedClips = [...job.clips].sort((a, b) => b.marketingScore - a.marketingScore);

  // Check if clips have actual video files generated
  const hasVideoFiles = sortedClips.some(c => c.clipUrl && !c.clipUrl.includes("placeholder"));

  return (
    <div className="space-y-6">
      {/* Info Banner - Video export coming soon */}
      {!hasVideoFiles && sortedClips.length > 0 && (
        <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-violet-300">AI Analysis Complete</h4>
              <p className="text-xs text-violet-400/80 mt-1">
                The AI has identified the best marketing moments in your video. Video clip export feature coming soon -
                for now, use the timestamps to manually clip these moments in your video editor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </button>
          <h2 className="text-xl font-semibold text-slate-100">
            {job.name || job.videoTitle || "Video Clips"}
          </h2>
          <p className="text-sm text-slate-400">
            {completedClips.length} clips generated • {formatDuration(job.videoDuration || 0)} source
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
          <div className="text-2xl font-bold text-slate-100">{job.clips.length}</div>
          <div className="text-xs text-slate-500">Clips Found</div>
        </div>
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {Math.round(job.clips.reduce((sum, c) => sum + c.marketingScore, 0) / job.clips.length || 0)}
          </div>
          <div className="text-xs text-slate-500">Avg Score</div>
        </div>
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
          <div className="text-2xl font-bold text-violet-400">
            {formatDuration(job.clips.reduce((sum, c) => sum + c.duration, 0))}
          </div>
          <div className="text-xs text-slate-500">Total Content</div>
        </div>
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
          <div className="text-2xl font-bold text-pink-400">{completedClips.length}</div>
          <div className="text-xs text-slate-500">Ready</div>
        </div>
      </div>

      {/* Clips Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sortedClips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            onPreview={setPreviewClip}
          />
        ))}
      </div>

      {/* Preview Modal - Full Analysis View */}
      {previewClip && (
        <ClipPreviewModal
          clip={previewClip}
          onClose={() => setPreviewClip(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// JOB LIST
// ============================================================================

function JobList({
  jobs,
  onSelectJob,
  onDeleteJob,
  isLoading,
}: {
  jobs: VideoClipJob[];
  onSelectJob: (job: VideoClipJob) => void;
  onDeleteJob: (jobId: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-300">Recent Projects</h3>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-slate-600 transition cursor-pointer"
            onClick={() => onSelectJob(job)}
          >
            <div className="flex items-center gap-4">
              {/* Thumbnail */}
              <div className="w-16 h-16 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0">
                {job.videoThumbnail ? (
                  <img
                    src={job.videoThumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-6 h-6 text-slate-700" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div>
                <h4 className="font-medium text-slate-100">
                  {job.name || job.videoTitle || "Untitled Project"}
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className={`flex items-center gap-1 ${getStatusColor(job.status)}`}>
                    {job.status === "COMPLETED" ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : job.status === "FAILED" ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    {job.status}
                  </span>
                  <span>{job.clips?.length || 0} clips</span>
                  <span>{formatDate(job.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {job.status !== "COMPLETED" && job.status !== "FAILED" && (
                <div className="text-xs text-slate-500">{job.progress}%</div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteJob(job.id);
                }}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VideoClipperView({
  onBack,
}: {
  onBack: () => void;
}) {
  const [view, setView] = useState<"input" | "processing" | "results">("input");
  const [jobs, setJobs] = useState<VideoClipJob[]>([]);
  const [currentJob, setCurrentJob] = useState<VideoClipJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // Fetch existing jobs on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Poll for updates when processing
  useEffect(() => {
    if (currentJob && !["COMPLETED", "FAILED"].includes(currentJob.status)) {
      const interval = setInterval(() => {
        fetchJobStatus(currentJob.id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentJob?.id, currentJob?.status]);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/video-clipper/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const fetchJobStatus = async (jobId: string) => {
    try {
      const res = await fetch(`/api/video-clipper/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentJob(data.job);
        if (data.job.status === "COMPLETED" || data.job.status === "FAILED") {
          setView("results");
          fetchJobs(); // Refresh list
        }
      }
    } catch (error) {
      console.error("Failed to fetch job status:", error);
    }
  };

  const handleSubmit = async (data: {
    sourceType: "upload";
    uploadedFile: File;
    name?: string;
    targetFormat: string;
    targetDuration: number;
    maxClips: number;
    addCaptions: boolean;
    captionStyle: string;
    industry?: string;
    productContext?: string;
    targetAudience?: string;
  }) => {
    setIsLoading(true);
    try {
      // Validate file size before upload
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (data.uploadedFile.size > maxSize) {
        throw new Error("File too large. Maximum size is 500MB");
      }

      // Upload the video file using client-side upload (bypasses serverless function limits)
      console.log("[Video Clipper] Uploading video:", data.uploadedFile.name, "Size:", data.uploadedFile.size);

      let uploadedVideoUrl: string;
      try {
        const blob = await upload(
          `video-clipper/${Date.now()}-${data.uploadedFile.name}`,
          data.uploadedFile,
          {
            access: "public",
            handleUploadUrl: "/api/video-clipper/upload",
          }
        );
        uploadedVideoUrl = blob.url;
        console.log("[Video Clipper] Upload complete:", uploadedVideoUrl);
      } catch (uploadError) {
        console.error("[Video Clipper] Upload error:", uploadError);
        throw new Error(
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload video. Please try again."
        );
      }

      // Create job
      let res: Response;
      try {
        res = await fetch("/api/video-clipper/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "upload",
            uploadedVideoUrl,
            name: data.name,
            targetFormat: data.targetFormat,
            targetDuration: data.targetDuration,
            maxClips: data.maxClips,
            addCaptions: data.addCaptions,
            captionStyle: data.captionStyle,
            industry: data.industry,
            productContext: data.productContext,
            targetAudience: data.targetAudience,
          }),
        });
      } catch (fetchError) {
        console.error("[Video Clipper] Job creation fetch error:", fetchError);
        throw new Error("Network error while creating job. Please try again.");
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create job with status ${res.status}`);
      }
      const jobData = await res.json();
      console.log("[Video Clipper] Job created:", jobData.job.id);
      setCurrentJob(jobData.job);
      setView("processing");
    } catch (error) {
      console.error("[Video Clipper] Submit error:", error);
      alert(error instanceof Error ? error.message : "Failed to create job. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectJob = (job: VideoClipJob) => {
    setCurrentJob(job);
    if (job.status === "COMPLETED" || job.status === "FAILED") {
      setView("results");
    } else {
      setView("processing");
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Delete this project?")) return;
    try {
      await fetch(`/api/video-clipper/jobs/${jobId}`, { method: "DELETE" });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      if (currentJob?.id === jobId) {
        setCurrentJob(null);
        setView("input");
      }
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-pink-500 to-violet-600 rounded-xl">
                <Scissors className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-100">AI Video Clipper</h1>
                <p className="text-xs text-slate-500">Marketing-optimized clips in minutes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {view === "input" && (
          <div className="space-y-8">
            <InputStep onSubmit={handleSubmit} isLoading={isLoading} />
            <JobList
              jobs={jobs}
              onSelectJob={handleSelectJob}
              onDeleteJob={handleDeleteJob}
              isLoading={isLoadingJobs}
            />
          </div>
        )}

        {view === "processing" && currentJob && (
          <ProcessingView
            job={currentJob}
            onCancel={() => {
              setView("input");
              setCurrentJob(null);
            }}
          />
        )}

        {view === "results" && currentJob && (
          <ResultsView
            job={currentJob}
            onBack={() => {
              setView("input");
              setCurrentJob(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
