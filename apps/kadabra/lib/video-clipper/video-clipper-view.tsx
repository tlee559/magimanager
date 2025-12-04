'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import {
  Upload,
  Play,
  Clock,
  FileVideo,
  Sparkles,
  Download,
  Trash2,
  ChevronLeft,
  History,
  Plus,
  Check,
  AlertCircle,
  Loader2,
  Scissors,
  Wand2,
  Save,
  Eye,
  Film,
  Type,
  MessageSquare,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UploadedVideo, UploadStatus, Transcript, TranscribeStatus, ClipSuggestion, AnalyzeStatus, GeneratedClip, SavedJob, SaveJobStatus, CaptionState, FormatState, CropMode, SavedFormatVariants } from './types';
import {
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
  ERRORS,
  formatFileSize,
  formatDuration,
  PLATFORM_FORMATS,
  type PlatformFormat,
} from './constants';

interface VideoClipperViewProps {
  onBack: () => void;
}

export function VideoClipperView({ onBack }: VideoClipperViewProps) {
  const [video, setVideo] = useState<UploadedVideo | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Phase 2: Transcription state
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [transcribeStatus, setTranscribeStatus] = useState<TranscribeStatus>('idle');
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // Phase 3: Analysis state
  const [suggestions, setSuggestions] = useState<ClipSuggestion[]>([]);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>('idle');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Phase 4: Clipping state
  const [generatedClips, setGeneratedClips] = useState<Map<number, GeneratedClip>>(new Map());
  const [clipGenerating, setClipGenerating] = useState<Set<number>>(new Set());
  const [clipErrors, setClipErrors] = useState<Map<number, string>>(new Map());

  // Phase 6: Caption state
  const [captionStates, setCaptionStates] = useState<Map<number, CaptionState>>(new Map());

  // Phase 7: Format variation state
  // Map<clipIndex, Map<format, FormatState>>
  const [formatStates, setFormatStates] = useState<Map<number, Map<PlatformFormat, FormatState>>>(new Map());
  const [expandedFormats, setExpandedFormats] = useState<Set<number>>(new Set());

  // Phase 5: Job state
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [saveJobStatus, setSaveJobStatus] = useState<SaveJobStatus>('idle');
  const [saveJobError, setSaveJobError] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [showJobHistory, setShowJobHistory] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Phase 5: Load saved jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    console.log('[VideoClipper] Loading saved jobs...');
    setLoadingJobs(true);
    try {
      const response = await fetch('/api/video-clipper/jobs');
      const data = await response.json();
      if (response.ok) {
        console.log('[VideoClipper] Loaded jobs:', data.jobs?.length || 0);
        setSavedJobs(data.jobs || []);
      } else {
        console.error('[VideoClipper] Failed to load jobs:', data.error);
      }
    } catch (err) {
      console.error('[VideoClipper] Error loading jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    console.log('[VideoClipper] Validating file:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!ALLOWED_TYPES.includes(file.type)) {
      return ERRORS.INVALID_FORMAT;
    }
    if (file.size > MAX_FILE_SIZE) {
      return ERRORS.FILE_TOO_LARGE;
    }
    return null;
  };

  // Extract video duration
  const extractDuration = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        console.log('[VideoClipper] Duration extracted:', video.duration);
        resolve(video.duration);
      };
      video.onerror = () => reject(new Error('Failed to load video metadata'));
      video.src = url;
    });
  };

  // Handle file upload
  const handleUpload = async (file: File) => {
    console.log('[VideoClipper] Starting upload:', file.name);

    // Validate
    const validationError = validateFile(file);
    if (validationError) {
      console.log('[VideoClipper] Validation failed:', validationError);
      setError(validationError);
      return;
    }

    setStatus('uploading');
    setError(null);
    setProgress(0);

    try {
      // Upload to Vercel Blob
      const blob = await upload(
        `video-clipper/${Date.now()}-${file.name}`,
        file,
        {
          access: 'public',
          handleUploadUrl: '/api/video-clipper/upload',
          multipart: true,
          clientPayload: JSON.stringify({
            size: file.size,
            type: file.type,
          }),
          onUploadProgress: (progressEvent) => {
            const pct = Math.round(progressEvent.percentage);
            console.log('[VideoClipper] Upload progress:', pct);
            setProgress(pct);
          },
        }
      );

      console.log('[VideoClipper] Upload complete:', blob.url);

      // Extract duration
      let duration: number | null = null;
      try {
        duration = await extractDuration(blob.url);
      } catch (e) {
        console.log('[VideoClipper] Could not extract duration:', e);
      }

      setVideo({
        url: blob.url,
        filename: file.name,
        size: file.size,
        duration,
      });
      setStatus('success');
    } catch (err) {
      console.error('[VideoClipper] Upload error:', err);
      setError(err instanceof Error ? err.message : ERRORS.UPLOAD_FAILED);
      setStatus('error');
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleUpload(file);
    }
  }, []);

  // Phase 2: Handle transcription
  const handleTranscribe = async () => {
    if (!video) return;

    console.log('[VideoClipper] Starting transcription for:', video.url);
    setTranscribeStatus('transcribing');
    setTranscribeError(null);

    try {
      const response = await fetch('/api/video-clipper/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: video.url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      console.log('[VideoClipper] Transcription complete:', data.transcript);
      setTranscript(data.transcript);
      setTranscribeStatus('success');
    } catch (err) {
      console.error('[VideoClipper] Transcription error:', err);
      setTranscribeError(err instanceof Error ? err.message : 'Transcription failed');
      setTranscribeStatus('error');
    }
  };

  // Format timestamp for display (seconds to MM:SS)
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Phase 3: Handle AI analysis
  const handleAnalyze = async () => {
    if (!transcript || !video) return;

    console.log('[VideoClipper] Starting AI analysis...');
    setAnalyzeStatus('analyzing');
    setAnalyzeError(null);

    try {
      const response = await fetch('/api/video-clipper/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: transcript.segments,
          videoDuration: video.duration || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      console.log('[VideoClipper] Analysis complete:', data.suggestions);
      setSuggestions(data.suggestions);
      setAnalyzeStatus('success');
    } catch (err) {
      console.error('[VideoClipper] Analysis error:', err);
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed');
      setAnalyzeStatus('error');
    }
  };

  // Phase 4: Handle clip generation
  const handleGenerateClip = async (index: number, suggestion: ClipSuggestion) => {
    if (!video) return;

    console.log('[VideoClipper] Generating clip:', { index, startTime: suggestion.startTime, endTime: suggestion.endTime });

    // Mark as generating
    setClipGenerating(prev => new Set(prev).add(index));
    setClipErrors(prev => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });

    try {
      const response = await fetch('/api/video-clipper/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: video.url,
          startTime: suggestion.startTime,
          endTime: suggestion.endTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Clip generation failed');
      }

      console.log('[VideoClipper] Clip generated:', data.clip);

      // Store the generated clip
      setGeneratedClips(prev => {
        const next = new Map(prev);
        next.set(index, data.clip);
        return next;
      });
    } catch (err) {
      console.error('[VideoClipper] Clip generation error:', err);
      setClipErrors(prev => {
        const next = new Map(prev);
        next.set(index, err instanceof Error ? err.message : 'Clip generation failed');
        return next;
      });
    } finally {
      setClipGenerating(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  // Generate all clips at once
  const handleGenerateAllClips = async () => {
    if (!video || suggestions.length === 0) return;

    // Generate clips that haven't been generated yet
    for (let i = 0; i < suggestions.length; i++) {
      if (!generatedClips.has(i) && !clipGenerating.has(i)) {
        await handleGenerateClip(i, suggestions[i]);
      }
    }
  };

  // Phase 6: Handle caption generation
  const handleAddCaptions = async (index: number) => {
    const clip = generatedClips.get(index);
    const suggestion = suggestions[index];
    if (!clip || !suggestion) return;

    console.log('[VideoClipper] Adding captions to clip:', { index, clipUrl: clip.url });

    // Mark as generating
    setCaptionStates(prev => {
      const next = new Map(prev);
      next.set(index, { status: 'generating' });
      return next;
    });

    try {
      const response = await fetch('/api/video-clipper/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipUrl: clip.url,
          transcript: suggestion.transcript,
          startTime: suggestion.startTime,
          endTime: suggestion.endTime,
          style: {
            fontSize: 'medium',
            position: 'bottom',
            fontColor: '#FFE135',
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Caption generation failed');
      }

      console.log('[VideoClipper] Captions added:', data.captionedClipUrl);

      // Store the captioned URL
      setCaptionStates(prev => {
        const next = new Map(prev);
        next.set(index, {
          status: 'success',
          captionedUrl: data.captionedClipUrl,
        });
        return next;
      });
    } catch (err) {
      console.error('[VideoClipper] Caption error:', err);
      setCaptionStates(prev => {
        const next = new Map(prev);
        next.set(index, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Caption generation failed',
        });
        return next;
      });
    }
  };

  // Phase 7: Toggle format panel expansion
  const toggleFormatPanel = (index: number) => {
    setExpandedFormats(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Phase 7: Handle format variation generation
  const handleGenerateFormat = async (clipIndex: number, format: PlatformFormat, cropMode: CropMode = 'pad') => {
    const clip = generatedClips.get(clipIndex);
    if (!clip) return;

    console.log('[VideoClipper] Generating format variation:', { clipIndex, format, cropMode });

    // Mark as generating
    setFormatStates(prev => {
      const next = new Map(prev);
      const clipFormats = next.get(clipIndex) || new Map<PlatformFormat, FormatState>();
      clipFormats.set(format, { status: 'generating' });
      next.set(clipIndex, clipFormats);
      return next;
    });

    try {
      const response = await fetch('/api/video-clipper/resize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipUrl: clip.url,
          targetFormat: format,
          cropMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Format generation failed');
      }

      console.log('[VideoClipper] Format generated:', data);

      // Store the generated format
      setFormatStates(prev => {
        const next = new Map(prev);
        const clipFormats = next.get(clipIndex) || new Map<PlatformFormat, FormatState>();
        clipFormats.set(format, {
          status: 'success',
          variant: {
            format,
            url: data.resizedUrl,
            width: data.width,
            height: data.height,
            cropMode,
          },
        });
        next.set(clipIndex, clipFormats);
        return next;
      });
    } catch (err) {
      console.error('[VideoClipper] Format generation error:', err);
      setFormatStates(prev => {
        const next = new Map(prev);
        const clipFormats = next.get(clipIndex) || new Map<PlatformFormat, FormatState>();
        clipFormats.set(format, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Format generation failed',
        });
        next.set(clipIndex, clipFormats);
        return next;
      });
    }
  };

  // Phase 5: Save current session as a job
  const handleSaveJob = async () => {
    if (!video || generatedClips.size === 0) return;

    console.log('[VideoClipper] Saving job...');
    setSaveJobStatus('saving');
    setSaveJobError(null);

    try {
      // Convert generated clips map to array with suggestion data and format variants
      const clipsToSave = Array.from(generatedClips.entries()).map(([index, clip]) => {
        const suggestion = suggestions[index];
        const captionState = captionStates.get(index);
        const clipFormats = formatStates.get(index);

        // Convert format variants to saveable format
        const formatVariants: SavedFormatVariants = {};
        if (clipFormats) {
          clipFormats.forEach((state, format) => {
            if (state.status === 'success' && state.variant) {
              formatVariants[format] = {
                url: state.variant.url,
                width: state.variant.width,
                height: state.variant.height,
                cropMode: state.variant.cropMode,
              };
            }
          });
        }

        return {
          url: clip.url,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration,
          type: suggestion?.type || 'unknown',
          reason: suggestion?.reason || '',
          transcript: suggestion?.transcript || '',
          captionedUrl: captionState?.captionedUrl || null,
          formatVariants: Object.keys(formatVariants).length > 0 ? formatVariants : null,
        };
      });

      const response = await fetch('/api/video-clipper/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: video.filename,
          sourceVideoUrl: video.url,
          videoDuration: video.duration,
          transcript: transcript,
          suggestions: suggestions,
          generatedClips: clipsToSave,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save job');
      }

      console.log('[VideoClipper] Job saved:', data.job?.id);
      setCurrentJobId(data.job?.id || null);
      setSaveJobStatus('success');

      // Refresh jobs list
      await loadJobs();
    } catch (err) {
      console.error('[VideoClipper] Save job error:', err);
      setSaveJobError(err instanceof Error ? err.message : 'Failed to save job');
      setSaveJobStatus('error');
    }
  };

  // Phase 5: Delete a job
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    console.log('[VideoClipper] Deleting job:', jobId);

    try {
      const response = await fetch(`/api/video-clipper/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete job');
      }

      console.log('[VideoClipper] Job deleted');

      // Refresh jobs list
      await loadJobs();
    } catch (err) {
      console.error('[VideoClipper] Delete job error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  // Phase 5: Load a saved job
  const handleLoadJob = (job: SavedJob) => {
    console.log('[VideoClipper] Loading job:', job.id);

    // Reset current state
    setStatus('success');
    setVideo({
      url: job.uploadedVideoUrl || '',
      filename: job.name,
      size: 0,
      duration: job.videoDuration,
    });

    // Set current job ID
    setCurrentJobId(job.id);

    // Load clips as generated clips
    const clips = new Map<number, GeneratedClip>();
    const loadedSuggestions: ClipSuggestion[] = [];
    const loadedCaptionStates = new Map<number, CaptionState>();
    const loadedFormatStates = new Map<number, Map<PlatformFormat, FormatState>>();

    job.clips.forEach((clip, index) => {
      clips.set(index, {
        url: clip.clipUrl || '',
        startTime: clip.startTime,
        endTime: clip.endTime,
        duration: clip.duration,
      });

      loadedSuggestions.push({
        startTime: clip.startTime,
        endTime: clip.endTime,
        type: clip.momentType as ClipSuggestion['type'],
        reason: clip.whySelected || '',
        transcript: clip.transcript || '',
      });

      // Load captioned URL if exists
      if (clip.clipWithCaptionsUrl) {
        loadedCaptionStates.set(index, {
          status: 'success',
          captionedUrl: clip.clipWithCaptionsUrl,
        });
      }

      // Load format variants if exists
      if (clip.platformRecommendations && typeof clip.platformRecommendations === 'object') {
        const formatMap = new Map<PlatformFormat, FormatState>();
        const variants = clip.platformRecommendations as SavedFormatVariants;

        Object.entries(variants).forEach(([format, variant]) => {
          formatMap.set(format as PlatformFormat, {
            status: 'success',
            variant: {
              format: format as PlatformFormat,
              url: variant.url,
              width: variant.width,
              height: variant.height,
              cropMode: variant.cropMode,
            },
          });
        });

        if (formatMap.size > 0) {
          loadedFormatStates.set(index, formatMap);
        }
      }
    });

    setGeneratedClips(clips);
    setSuggestions(loadedSuggestions);
    setCaptionStates(loadedCaptionStates);
    setFormatStates(loadedFormatStates);
    setExpandedFormats(new Set());
    setAnalyzeStatus('success');
    setTranscribeStatus('success');

    // Load transcript from job if available
    if (job.transcript && job.transcript.segments && job.transcript.segments.length > 0) {
      setTranscript(job.transcript);
    } else {
      // Fallback: construct transcript from clip transcripts
      const allTranscripts = job.clips
        .filter(clip => clip.transcript)
        .map(clip => clip.transcript)
        .join(' ');
      setTranscript({
        fullText: allTranscripts,
        segments: []
      });
    }

    setShowJobHistory(false);
  };

  // Get label color for clip type (dark theme)
  const getTypeColor = (type: ClipSuggestion['type']) => {
    const colors = {
      hook: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      testimonial: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      benefit: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      cta: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      problem: 'bg-red-500/20 text-red-400 border-red-500/30',
      solution: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      viral: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    };
    return colors[type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  // Reset to upload another
  const handleReset = () => {
    setVideo(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
    // Reset transcription state
    setTranscript(null);
    setTranscribeStatus('idle');
    setTranscribeError(null);
    // Reset analysis state
    setSuggestions([]);
    setAnalyzeStatus('idle');
    setAnalyzeError(null);
    // Reset clip state
    setGeneratedClips(new Map());
    setClipGenerating(new Set());
    setClipErrors(new Map());
    // Reset caption state
    setCaptionStates(new Map());
    // Reset format state
    setFormatStates(new Map());
    setExpandedFormats(new Set());
    // Reset job state
    setCurrentJobId(null);
    setSaveJobStatus('idle');
    setSaveJobError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate progress stats
  const clipsGenerated = generatedClips.size;
  const clipsTotal = suggestions.length;
  const isGeneratingAny = clipGenerating.size > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-slate-200"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Video Clipper</h1>
            <p className="text-sm text-slate-500 mt-1">
              {showJobHistory
                ? 'View your saved clip jobs'
                : 'AI-powered video clipping for ads and viral content'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowJobHistory(!showJobHistory)}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            showJobHistory
              ? 'bg-violet-600 text-white hover:bg-violet-500'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
          }`}
        >
          {showJobHistory ? (
            <>
              <Plus className="w-4 h-4" />
              New Clip
            </>
          ) : (
            <>
              <History className="w-4 h-4" />
              History
              {savedJobs.length > 0 && (
                <span className="bg-violet-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {savedJobs.length}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Job History View */}
      {showJobHistory && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            Saved Jobs
          </h2>

          {loadingJobs ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto text-violet-400 animate-spin" />
              <p className="text-slate-500 mt-3">Loading jobs...</p>
            </div>
          ) : savedJobs.length === 0 ? (
            <div className="text-center py-12">
              <Film className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">No saved jobs yet.</p>
              <button
                onClick={() => setShowJobHistory(false)}
                className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition"
              >
                Create your first clip
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-100 truncate">{job.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Scissors className="w-3 h-3" />
                          {job.clips.length} clip{job.clips.length !== 1 ? 's' : ''}
                        </span>
                        {job.videoDuration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(job.videoDuration)}
                          </span>
                        )}
                        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.clips.slice(0, 5).map((clip) => (
                          <span
                            key={clip.id}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${getTypeColor(clip.momentType as ClipSuggestion['type'])}`}
                          >
                            {clip.momentType}
                          </span>
                        ))}
                        {job.clips.length > 5 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-400">
                            +{job.clips.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleLoadJob(job)}
                        className="px-3 py-1.5 text-sm text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {!showJobHistory && (
        <div className="space-y-6">
          {/* Upload Zone - shown when no video */}
          {!video && status !== 'uploading' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                bg-slate-800/50 rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition
                ${isDragging
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/70'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className={`mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${
                isDragging ? 'bg-violet-500/20' : 'bg-slate-700/50'
              }`}>
                <Upload className={`w-8 h-8 ${isDragging ? 'text-violet-400' : 'text-slate-400'}`} />
              </div>
              <p className="text-lg font-medium text-slate-200">
                Drop video here or click to browse
              </p>
              <p className="text-sm text-slate-500 mt-2">
                MP4, MOV, WebM (max 1GB, 30 minutes)
              </p>
            </div>
          )}

          {/* Upload Progress */}
          {status === 'uploading' && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8">
              <div className="text-center mb-6">
                {progress < 100 ? (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-violet-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-200">Uploading video...</p>
                    <p className="text-3xl font-bold text-violet-400 mt-2">{progress}%</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                    </div>
                    <p className="text-lg font-medium text-slate-200">Processing video...</p>
                    <p className="text-sm text-slate-500 mt-1">Almost done</p>
                  </>
                )}
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress >= 100 ? 'bg-violet-500 animate-pulse' : 'bg-violet-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400">{error}</p>
                <button
                  onClick={handleReset}
                  className="text-red-400 hover:text-red-300 underline mt-2 text-sm"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Video Player - shown after upload */}
          {video && status === 'success' && (
            <div className="space-y-6">
              {/* Video Card */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                {/* Video Element */}
                <div className="bg-black">
                  <video
                    ref={videoRef}
                    src={video.url}
                    controls
                    className="w-full max-h-[500px]"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                {/* Video Info Bar */}
                <div className="px-5 py-4 border-t border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-700/50 rounded-lg">
                        <FileVideo className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{video.filename}</p>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                          <span>{formatFileSize(video.size)}</span>
                          {video.duration && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(video.duration)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleReset}
                        className="px-4 py-2 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
                      >
                        Upload Another
                      </button>

                      {/* Transcribe Button */}
                      {!transcript && transcribeStatus !== 'transcribing' && (
                        <button
                          onClick={handleTranscribe}
                          className="px-4 py-2 text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition text-sm flex items-center gap-2"
                        >
                          <Wand2 className="w-4 h-4" />
                          Transcribe Video
                        </button>
                      )}

                      {/* Transcribing State */}
                      {transcribeStatus === 'transcribing' && (
                        <button
                          disabled
                          className="px-4 py-2 text-white bg-violet-500/50 rounded-lg flex items-center gap-2 cursor-not-allowed text-sm"
                        >
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Transcribing...
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcription Error */}
              {transcribeError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400">{transcribeError}</p>
                    <button
                      onClick={() => {
                        setTranscribeError(null);
                        setTranscribeStatus('idle');
                      }}
                      className="text-red-400 hover:text-red-300 underline mt-2 text-sm"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}

              {/* Transcript Display */}
              {transcript && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                      <FileVideo className="w-4 h-4 text-slate-400" />
                      Transcript
                      <span className="text-sm text-slate-500 font-normal">
                        ({transcript.segments.length} segments)
                      </span>
                    </h3>

                    {/* Analyze Button */}
                    {suggestions.length === 0 && analyzeStatus !== 'analyzing' && (
                      <button
                        onClick={handleAnalyze}
                        className="px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition text-sm flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Find Ad Moments
                      </button>
                    )}

                    {analyzeStatus === 'analyzing' && (
                      <button
                        disabled
                        className="px-4 py-2 text-white bg-emerald-500/50 rounded-lg flex items-center gap-2 cursor-not-allowed text-sm"
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {transcript.segments.length > 0 ? (
                      <div className="divide-y divide-slate-700/50">
                        {transcript.segments.map((segment, index) => (
                          <div
                            key={index}
                            className="px-5 py-3 hover:bg-slate-700/30 transition"
                          >
                            <span className="text-xs font-mono text-violet-400 mr-3">
                              {formatTimestamp(segment.start)}
                            </span>
                            <span className="text-slate-300">{segment.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-5 text-slate-500">
                        {transcript.fullText || 'No transcript available'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Analysis Error */}
              {analyzeError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400">{analyzeError}</p>
                    <button
                      onClick={() => {
                        setAnalyzeError(null);
                        setAnalyzeStatus('idle');
                      }}
                      className="text-red-400 hover:text-red-300 underline mt-2 text-sm"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}

              {/* Clip Suggestions */}
              {suggestions.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-slate-400" />
                        Suggested Clips
                        <span className="text-sm text-slate-500 font-normal">
                          ({clipsGenerated}/{clipsTotal} generated)
                        </span>
                      </h3>
                    </div>

                    {/* Generate All Button */}
                    {clipsGenerated < clipsTotal && (
                      <button
                        onClick={handleGenerateAllClips}
                        disabled={isGeneratingAny}
                        className={`px-4 py-2 rounded-lg transition text-sm flex items-center gap-2 ${
                          isGeneratingAny
                            ? 'bg-violet-500/50 text-white cursor-not-allowed'
                            : 'bg-violet-600 hover:bg-violet-500 text-white'
                        }`}
                      >
                        {isGeneratingAny ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Scissors className="w-4 h-4" />
                            Generate All Clips
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-700/50">
                    {suggestions.map((suggestion, index) => {
                      const isGenerating = clipGenerating.has(index);
                      const generatedClip = generatedClips.get(index);
                      const clipError = clipErrors.get(index);
                      const captionState = captionStates.get(index);

                      return (
                        <div key={index} className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-slate-300">
                                #{index + 1}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wide border ${getTypeColor(suggestion.type)}`}>
                                {suggestion.type}
                              </span>
                              <span className="text-sm text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(suggestion.startTime)} - {formatTimestamp(suggestion.endTime)}
                              </span>
                              <span className="text-xs text-slate-600">
                                ({Math.round(suggestion.endTime - suggestion.startTime)}s)
                              </span>
                            </div>

                            {/* Generate Clip Button */}
                            {!generatedClip && !isGenerating && (
                              <button
                                onClick={() => handleGenerateClip(index, suggestion)}
                                className="px-3 py-1.5 text-sm text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition flex items-center gap-1"
                              >
                                <Scissors className="w-3 h-3" />
                                Generate
                              </button>
                            )}

                            {/* Generating State */}
                            {isGenerating && (
                              <button
                                disabled
                                className="px-3 py-1.5 text-sm text-white bg-violet-500/50 rounded-lg flex items-center gap-1 cursor-not-allowed"
                              >
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Generating...
                              </button>
                            )}

                            {/* Generated Badge */}
                            {generatedClip && (
                              <span className="px-3 py-1.5 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg flex items-center gap-1 border border-emerald-500/20">
                                <Check className="w-3 h-3" />
                                Generated
                              </span>
                            )}
                          </div>

                          <p className="text-slate-300 text-sm mb-2">
                            {suggestion.reason}
                          </p>

                          {suggestion.transcript && (
                            <p className="text-slate-500 text-xs italic border-l-2 border-slate-700 pl-3">
                              "{suggestion.transcript}"
                            </p>
                          )}

                          {/* Clip Error */}
                          {clipError && (
                            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-red-400 text-sm">{clipError}</p>
                                <button
                                  onClick={() => handleGenerateClip(index, suggestion)}
                                  className="text-red-400 hover:text-red-300 underline text-xs mt-1"
                                >
                                  Try again
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Generated Clip Player */}
                          {generatedClip && (
                            <div className="mt-4 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700/50">
                              <video
                                src={generatedClip.url}
                                controls
                                className="w-full max-h-[300px]"
                              />
                              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {Math.round(generatedClip.duration)}s
                                </span>
                                <div className="flex gap-2">
                                  {/* Add Captions Button */}
                                  {!captionState?.captionedUrl && captionState?.status !== 'generating' && (
                                    <button
                                      onClick={() => handleAddCaptions(index)}
                                      className="px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition flex items-center gap-1"
                                    >
                                      <Type className="w-3 h-3" />
                                      Add Captions
                                    </button>
                                  )}
                                  {captionState?.status === 'generating' && (
                                    <button
                                      disabled
                                      className="px-3 py-1.5 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-1 cursor-not-allowed"
                                    >
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Adding...
                                    </button>
                                  )}
                                  <a
                                    href={generatedClip.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={`clip-${index + 1}-${suggestion.type}.mp4`}
                                    className="px-3 py-1.5 text-sm text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    Download
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Caption Error */}
                          {captionState?.status === 'error' && (
                            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-red-400 text-sm">{captionState.error}</p>
                                <button
                                  onClick={() => handleAddCaptions(index)}
                                  className="text-red-400 hover:text-red-300 underline text-xs mt-1"
                                >
                                  Try again
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Captioned Clip Player */}
                          {captionState?.captionedUrl && (
                            <div className="mt-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-lg overflow-hidden border border-amber-500/20">
                              <div className="px-4 py-2 border-b border-amber-500/20 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium text-amber-400">With Captions</span>
                              </div>
                              <video
                                src={captionState.captionedUrl}
                                controls
                                className="w-full max-h-[300px]"
                              />
                              <div className="flex items-center justify-end px-4 py-3 border-t border-amber-500/20">
                                <a
                                  href={captionState.captionedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={`clip-${index + 1}-${suggestion.type}-captioned.mp4`}
                                  className="px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  Download Captioned
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Phase 7: Format Variations Panel */}
                          {generatedClip && (
                            <div className="mt-4">
                              {/* Toggle Button */}
                              <button
                                onClick={() => toggleFormatPanel(index)}
                                className="w-full px-4 py-3 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-lg flex items-center justify-between text-cyan-400 hover:bg-cyan-500/15 transition"
                              >
                                <div className="flex items-center gap-2">
                                  <Maximize2 className="w-4 h-4" />
                                  <span className="text-sm font-medium">Platform Format Variations</span>
                                  {formatStates.get(index) && formatStates.get(index)!.size > 0 && (
                                    <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded-full">
                                      {Array.from(formatStates.get(index)!.values()).filter(s => s.status === 'success').length} generated
                                    </span>
                                  )}
                                </div>
                                {expandedFormats.has(index) ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>

                              {/* Expanded Format Panel */}
                              {expandedFormats.has(index) && (
                                <div className="mt-3 bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
                                  <div className="p-4">
                                    <p className="text-xs text-slate-500 mb-4">
                                      Generate platform-specific versions with correct aspect ratios
                                    </p>

                                    {/* Format Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                      {(Object.entries(PLATFORM_FORMATS) as [PlatformFormat, typeof PLATFORM_FORMATS[PlatformFormat]][]).map(([format, config]) => {
                                        const clipFormats = formatStates.get(index);
                                        const formatState = clipFormats?.get(format);
                                        const isGenerating = formatState?.status === 'generating';
                                        const isGenerated = formatState?.status === 'success';
                                        const hasError = formatState?.status === 'error';

                                        return (
                                          <div
                                            key={format}
                                            className={`p-3 rounded-lg border transition ${
                                              isGenerated
                                                ? 'bg-cyan-500/10 border-cyan-500/30'
                                                : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-lg">{config.icon}</span>
                                              <div>
                                                <p className="text-sm font-medium text-slate-200">{config.name}</p>
                                                <p className="text-xs text-slate-500">{config.aspectRatio}</p>
                                              </div>
                                            </div>

                                            {isGenerated && formatState?.variant ? (
                                              <div className="space-y-2">
                                                <video
                                                  src={formatState.variant.url}
                                                  controls
                                                  className="w-full rounded"
                                                  style={{ maxHeight: '120px' }}
                                                />
                                                <a
                                                  href={formatState.variant.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  download={`clip-${index + 1}-${suggestion.type}-${format}.mp4`}
                                                  className="block w-full text-center px-2 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded transition"
                                                >
                                                  <Download className="w-3 h-3 inline mr-1" />
                                                  Download
                                                </a>
                                              </div>
                                            ) : isGenerating ? (
                                              <button
                                                disabled
                                                className="w-full px-2 py-1.5 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded flex items-center justify-center gap-1"
                                              >
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Generating...
                                              </button>
                                            ) : (
                                              <div className="space-y-2">
                                                {hasError && (
                                                  <p className="text-xs text-red-400 truncate" title={formatState?.error}>
                                                    {formatState?.error}
                                                  </p>
                                                )}
                                                <div className="flex gap-1">
                                                  <button
                                                    onClick={() => handleGenerateFormat(index, format, 'pad')}
                                                    className="flex-1 px-2 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded transition"
                                                    title="Add black bars to fit"
                                                  >
                                                    Pad
                                                  </button>
                                                  <button
                                                    onClick={() => handleGenerateFormat(index, format, 'crop')}
                                                    className="flex-1 px-2 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded transition"
                                                    title="Crop to fit"
                                                  >
                                                    Crop
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Save Job Section */}
              {generatedClips.size > 0 && (
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl border border-emerald-500/20 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <Save className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-100">Save This Job</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {currentJobId
                            ? 'This job is already saved'
                            : `Save ${generatedClips.size} generated clip${generatedClips.size !== 1 ? 's' : ''} for later`}
                        </p>
                      </div>
                    </div>
                    {!currentJobId && (
                      <button
                        onClick={handleSaveJob}
                        disabled={saveJobStatus === 'saving'}
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                          saveJobStatus === 'saving'
                            ? 'bg-emerald-500/50 text-white cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {saveJobStatus === 'saving' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Job
                          </>
                        )}
                      </button>
                    )}
                    {currentJobId && (
                      <span className="text-emerald-400 flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <Check className="w-4 h-4" />
                        Saved
                      </span>
                    )}
                  </div>

                  {saveJobStatus === 'success' && !currentJobId && (
                    <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                      <p className="text-emerald-400 text-sm flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Job saved successfully!
                      </p>
                    </div>
                  )}

                  {saveJobError && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {saveJobError}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
