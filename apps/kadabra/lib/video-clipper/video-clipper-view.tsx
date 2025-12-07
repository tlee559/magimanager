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
  ChevronDown,
  ChevronRight,
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
  Target,
  Users,
  Zap,
  TrendingUp,
  Star,
  Hash,
  Copy,
  SkipBack,
  SkipForward,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { UploadedVideo, UploadStatus, Transcript, TranscribeStatus, ClipSuggestion, AnalyzeStatus, GeneratedClip, SavedJob, SaveJobStatus, ClipExports, ExportKey, ExportStatesMap, ClipExportsWithProcessing, ExportProcessingState, MarketingContext, TrimAdjustment } from './types';
import {
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
  ERRORS,
  formatFileSize,
  formatDuration,
  PLATFORM_FORMATS,
  EXPORT_CELLS,
  MARKETING_GOALS,
  MARKETING_TONES,
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

  // Phase 7: Export grid state - tracks all 6 export variants per clip
  // Map<clipIndex, { exports: ClipExports, states: ExportStatesMap }>
  const [clipExports, setClipExports] = useState<Map<number, ClipExports>>(new Map());
  const [exportStates, setExportStates] = useState<Map<number, ExportStatesMap>>(new Map());

  // Phase 5: Job state
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [saveJobStatus, setSaveJobStatus] = useState<SaveJobStatus>('idle');
  const [saveJobError, setSaveJobError] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [showJobHistory, setShowJobHistory] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // UI state
  const [showTranscript, setShowTranscript] = useState(false);
  const [targetClipDuration, setTargetClipDuration] = useState<number>(30); // Default 30 seconds
  const [showMarketingContext, setShowMarketingContext] = useState(false);

  // Marketing context for AI analysis
  const [marketingContext, setMarketingContext] = useState<MarketingContext>({
    product: '',
    audience: '',
    goal: 'engagement',
    tone: 'casual',
  });

  // Trim adjustments per clip: Map<clipIndex, TrimAdjustment>
  const [trimAdjustments, setTrimAdjustments] = useState<Map<number, TrimAdjustment>>(new Map());

  // Expanded suggestion details: Set<clipIndex>
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());

  // YouTube URL input state
  const [inputMethod, setInputMethod] = useState<'upload' | 'youtube'>('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Phase 5: Load saved jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  // Check for pre-loaded video from YouTube Scraper
  useEffect(() => {
    const stored = localStorage.getItem('videoClipper_sourceVideo');
    if (stored) {
      try {
        const videoData = JSON.parse(stored);
        console.log('[VideoClipper] Loading video from YouTube Scraper:', videoData.title);
        setVideo({
          url: videoData.url,
          filename: videoData.title || 'YouTube Video',
          size: 0,
          duration: videoData.duration || null,
        });
        setStatus('success');
        localStorage.removeItem('videoClipper_sourceVideo');
      } catch (err) {
        console.error('[VideoClipper] Failed to parse pre-loaded video:', err);
      }
    }
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

  // Track clips being polled for background processing
  const pollingClipsRef = useRef<Set<string>>(new Set());

  // Poll for export completion when we have processing exports
  useEffect(() => {
    if (!currentJobId) return;

    const savedJob = savedJobs.find(j => j.id === currentJobId);
    if (!savedJob) return;

    // Check if any clips have processing exports
    const checkProcessingExports = async () => {
      for (const savedClip of savedJob.clips) {
        // Skip if already polling this clip
        if (pollingClipsRef.current.has(savedClip.id)) continue;

        const exports = savedClip.exports as ClipExportsWithProcessing | null;
        if (!exports?._processing) continue;

        // Check each processing export
        for (const [exportKey, state] of Object.entries(exports._processing)) {
          if (state?.status === 'processing') {
            console.log('[VideoClipper] Found processing export, starting poll:', { clipId: savedClip.id, exportKey });
            pollingClipsRef.current.add(savedClip.id);
            pollClipStatus(savedClip.id, savedJob.clips.indexOf(savedClip));
            break; // Only poll once per clip
          }
        }
      }
    };

    checkProcessingExports();
  }, [currentJobId, savedJobs]);

  // Poll a single clip for status updates
  const pollClipStatus = async (clipId: string, clipIndex: number) => {
    const pollInterval = 3000; // 3 seconds
    const maxAttempts = 120; // 6 minutes max
    let attempts = 0;

    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        console.log('[VideoClipper] Polling timed out for clip:', clipId);
        pollingClipsRef.current.delete(clipId);
        return;
      }

      try {
        const response = await fetch(`/api/video-clipper/clips/${clipId}`);
        if (!response.ok) {
          console.error('[VideoClipper] Poll failed:', response.status);
          pollingClipsRef.current.delete(clipId);
          return;
        }

        const data = await response.json();
        const exports = data.clip?.exports as ClipExportsWithProcessing;

        if (!exports?._processing) {
          pollingClipsRef.current.delete(clipId);
          return;
        }

        // Check if any exports are still processing
        let stillProcessing = false;
        for (const [exportKey, state] of Object.entries(exports._processing)) {
          if (state?.status === 'processing') {
            stillProcessing = true;
          } else if (state?.status === 'completed' && state.result) {
            // Update local state with completed export
            console.log('[VideoClipper] Export completed:', { clipId, exportKey });

            setClipExports(prev => {
              const next = new Map(prev);
              const current = next.get(clipIndex) || {};
              next.set(clipIndex, { ...current, [exportKey]: state.result });
              return next;
            });

            setExportStates(prev => {
              const next = new Map(prev);
              const states = next.get(clipIndex) || {};
              next.set(clipIndex, { ...states, [exportKey]: { status: 'success' } });
              return next;
            });

            // Refresh saved jobs to get updated data
            loadJobs();
          } else if (state?.status === 'failed') {
            console.error('[VideoClipper] Export failed:', { clipId, exportKey, error: state.error });

            setExportStates(prev => {
              const next = new Map(prev);
              const states = next.get(clipIndex) || {};
              next.set(clipIndex, { ...states, [exportKey]: { status: 'error', error: state.error } });
              return next;
            });
          }
        }

        if (stillProcessing) {
          setTimeout(poll, pollInterval);
        } else {
          pollingClipsRef.current.delete(clipId);
        }
      } catch (err) {
        console.error('[VideoClipper] Poll error:', err);
        pollingClipsRef.current.delete(clipId);
      }
    };

    poll();
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

  // Format timestamp for display (seconds to MM:SS)
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle YouTube URL download
  const handleYoutubeUrl = async () => {
    if (!youtubeUrl.trim()) return;

    console.log('[VideoClipper] Downloading YouTube video:', youtubeUrl);
    setYoutubeLoading(true);
    setError(null);

    try {
      // Call the YouTube scraper download endpoint
      const response = await fetch('/api/youtube-scraper/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl, quality: 'best' }),
      });

      const data = await response.json();
      console.log('[VideoClipper] Download API response:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to download`);
      }

      // Check job status - the API waits for completion and returns final status
      const job = data.job;
      console.log('[VideoClipper] Job status:', job.status, 'blobUrl:', job.blobUrl);

      if (job.blobUrl) {
        console.log('[VideoClipper] YouTube video ready:', job.title);

        // Extract duration from video
        let duration: number | null = job.duration || null;
        if (!duration && job.blobUrl) {
          try {
            duration = await extractDuration(job.blobUrl);
          } catch (e) {
            console.log('[VideoClipper] Could not extract duration:', e);
          }
        }

        setVideo({
          url: job.blobUrl,
          filename: job.title || 'YouTube Video',
          size: job.fileSize || 0,
          duration,
        });
        setStatus('success');
        setYoutubeUrl('');
      } else if (job.error) {
        throw new Error(`Download failed: ${job.error}`);
      } else if (job.status === 'failed') {
        // Check debug logs for more info
        const lastDebug = job.debug?.[job.debug.length - 1] || '';
        throw new Error(`Download failed: ${lastDebug || 'Unknown reason. Please try again.'}`);
      } else {
        // Job might still be processing - show what we know
        throw new Error(`Download not complete (status: ${job.status}). The video may be too long. Try a shorter video or use YouTube Scraper first.`);
      }
    } catch (err) {
      console.error('[VideoClipper] YouTube download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download YouTube video');
    } finally {
      setYoutubeLoading(false);
    }
  };

  // Combined flow status for the unified analyze button
  type AnalyzeFlowStep = 'idle' | 'transcribing' | 'analyzing' | 'generating' | 'complete' | 'error';
  const [analyzeFlowStep, setAnalyzeFlowStep] = useState<AnalyzeFlowStep>('idle');
  const [analyzeFlowError, setAnalyzeFlowError] = useState<string | null>(null);

  // Unified "Analyze Video" - combines transcribe + analyze + auto-generate clips
  const handleAnalyzeVideo = async () => {
    if (!video) return;

    console.log('[VideoClipper] Starting unified analyze flow...');
    setAnalyzeFlowStep('transcribing');
    setAnalyzeFlowError(null);
    setTranscribeError(null);
    setAnalyzeError(null);

    try {
      // Step 1: Transcribe
      console.log('[VideoClipper] Step 1: Transcribing...');
      setTranscribeStatus('transcribing');

      const transcribeResponse = await fetch('/api/video-clipper/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: video.url }),
      });

      const transcribeData = await transcribeResponse.json();

      if (!transcribeResponse.ok) {
        throw new Error(transcribeData.error || 'Transcription failed');
      }

      console.log('[VideoClipper] Transcription complete');
      setTranscript(transcribeData.transcript);
      setTranscribeStatus('success');

      // Step 2: Analyze
      console.log('[VideoClipper] Step 2: Analyzing for marketing moments...');
      setAnalyzeFlowStep('analyzing');
      setAnalyzeStatus('analyzing');

      const hasContext = marketingContext.product || marketingContext.audience;

      const analyzeResponse = await fetch('/api/video-clipper/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: transcribeData.transcript.segments,
          videoDuration: video.duration || 0,
          targetClipDuration,
          marketingContext: hasContext ? marketingContext : undefined,
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (!analyzeResponse.ok) {
        throw new Error(analyzeData.error || 'Analysis failed');
      }

      console.log('[VideoClipper] Analysis complete:', analyzeData.suggestions?.length, 'suggestions');
      setSuggestions(analyzeData.suggestions || []);
      setAnalyzeStatus('success');

      // Auto-expand first suggestion to show value
      if (analyzeData.suggestions?.length > 0) {
        setExpandedSuggestions(new Set([0]));
      }

      // Step 3: Auto-generate all clips
      console.log('[VideoClipper] Step 3: Generating clips...');
      setAnalyzeFlowStep('generating');

      const clipSuggestions = analyzeData.suggestions || [];
      for (let i = 0; i < clipSuggestions.length; i++) {
        const suggestion = clipSuggestions[i];
        console.log(`[VideoClipper] Generating clip ${i + 1}/${clipSuggestions.length}`);

        setClipGenerating(prev => new Set(prev).add(i));

        try {
          const clipResponse = await fetch('/api/video-clipper/clip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoUrl: video.url,
              startTime: suggestion.startTime,
              endTime: suggestion.endTime,
            }),
          });

          const clipData = await clipResponse.json();

          if (clipResponse.ok && clipData.clip?.url) {
            setGeneratedClips(prev => {
              const next = new Map(prev);
              next.set(i, {
                url: clipData.clip.url,
                startTime: suggestion.startTime,
                endTime: suggestion.endTime,
                duration: suggestion.endTime - suggestion.startTime,
              });
              return next;
            });
          } else {
            setClipErrors(prev => {
              const next = new Map(prev);
              next.set(i, clipData.error || 'Clip generation failed');
              return next;
            });
          }
        } catch (clipErr) {
          console.error(`[VideoClipper] Clip ${i + 1} error:`, clipErr);
          setClipErrors(prev => {
            const next = new Map(prev);
            next.set(i, clipErr instanceof Error ? clipErr.message : 'Clip generation failed');
            return next;
          });
        } finally {
          setClipGenerating(prev => {
            const next = new Set(prev);
            next.delete(i);
            return next;
          });
        }
      }

      console.log('[VideoClipper] All clips generated');
      setAnalyzeFlowStep('complete');
    } catch (err) {
      console.error('[VideoClipper] Analyze flow error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Analysis failed';
      setAnalyzeFlowError(errorMsg);
      setAnalyzeFlowStep('error');

      // Set appropriate status based on where we failed
      if (analyzeFlowStep === 'transcribing') {
        setTranscribeError(errorMsg);
        setTranscribeStatus('error');
      } else {
        setAnalyzeError(errorMsg);
        setAnalyzeStatus('error');
      }
    }
  };

  // Seek video to a specific time (for preview)
  const handleSeekToTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked, that's ok
      });
    }
  };

  // Legacy handlers for manual control (keep for re-try functionality)
  const handleTranscribe = async () => {
    if (!video) return;
    setTranscribeStatus('transcribing');
    setTranscribeError(null);
    try {
      const response = await fetch('/api/video-clipper/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: video.url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Transcription failed');
      setTranscript(data.transcript);
      setTranscribeStatus('success');
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Transcription failed');
      setTranscribeStatus('error');
    }
  };

  const handleAnalyze = async () => {
    if (!transcript || !video) return;
    setAnalyzeStatus('analyzing');
    setAnalyzeError(null);
    try {
      const hasContext = marketingContext.product || marketingContext.audience;
      const response = await fetch('/api/video-clipper/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: transcript.segments,
          videoDuration: video.duration || 0,
          targetClipDuration,
          marketingContext: hasContext ? marketingContext : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');
      setSuggestions(data.suggestions);
      setAnalyzeStatus('success');
      if (data.suggestions?.length > 0) {
        setExpandedSuggestions(new Set([0]));
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed');
      setAnalyzeStatus('error');
    }
  };

  // Phase 4: Handle clip generation (with optional trim adjustment)
  const handleGenerateClip = async (index: number, suggestion: ClipSuggestion, useTrimAdjustment = false) => {
    if (!video) return;

    // Apply trim adjustment if requested
    const trimAdj = useTrimAdjustment ? trimAdjustments.get(index) : undefined;
    const startTime = Math.max(0, suggestion.startTime + (trimAdj?.startOffset || 0));
    const endTime = Math.min(video.duration || suggestion.endTime, suggestion.endTime + (trimAdj?.endOffset || 0));

    console.log('[VideoClipper] Generating clip:', { index, startTime, endTime, trimAdj });

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
          startTime,
          endTime,
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

  // Batch export: Generate all 6 formats for a specific clip
  const handleBatchExport = async (clipIndex: number) => {
    const exportKeys: ExportKey[] = [
      'vertical', 'square', 'horizontal',
      'verticalCaptioned', 'squareCaptioned', 'horizontalCaptioned'
    ];

    for (const exportKey of exportKeys) {
      const exports = clipExports.get(clipIndex) || {};
      const states = exportStates.get(clipIndex) || {};

      // Skip if already generated or generating
      if (exports[exportKey] || states[exportKey]?.status === 'generating') {
        continue;
      }

      // Generate this format
      await handleGenerateExport(clipIndex, exportKey);
    }
  };

  // Copy text to clipboard with feedback
  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
      console.log('[VideoClipper] Copied to clipboard:', text.slice(0, 50));
    } catch (err) {
      console.error('[VideoClipper] Failed to copy:', err);
    }
  };

  // Update trim adjustment for a clip
  const handleTrimChange = (clipIndex: number, field: 'startOffset' | 'endOffset', value: number) => {
    setTrimAdjustments(prev => {
      const next = new Map(prev);
      const current = next.get(clipIndex) || { startOffset: 0, endOffset: 0 };
      next.set(clipIndex, { ...current, [field]: value });
      return next;
    });
  };

  // Toggle expanded state for a suggestion
  const toggleSuggestionExpanded = (index: number) => {
    setExpandedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Phase 7: Generate an export variant (handles both resize and captions)
  // If job is saved, uses background processing; otherwise runs synchronously
  const handleGenerateExport = async (clipIndex: number, exportKey: ExportKey) => {
    const clip = generatedClips.get(clipIndex);
    const suggestion = suggestions[clipIndex];
    if (!clip || !suggestion) return;

    const exportConfig = EXPORT_CELLS[exportKey];
    if (!exportConfig) return;

    const { format, withCaptions } = exportConfig;

    console.log('[VideoClipper] Generating export:', { clipIndex, exportKey, format, withCaptions });

    // Mark as generating
    setExportStates(prev => {
      const next = new Map(prev);
      const states = next.get(clipIndex) || {};
      next.set(clipIndex, { ...states, [exportKey]: { status: 'generating' } });
      return next;
    });

    // If job is saved, use async background processing
    if (currentJobId) {
      const savedClip = savedJobs.find(j => j.id === currentJobId)?.clips[clipIndex];
      if (savedClip) {
        try {
          const response = await fetch('/api/video-clipper/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clipId: savedClip.id,
              exportKey,
              sourceClipUrl: clip.url,
              transcript: suggestion.transcript,
              startTime: suggestion.startTime,
              endTime: suggestion.endTime,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to start export');
          }

          console.log('[VideoClipper] Background export started:', { clipId: savedClip.id, exportKey });

          // Start polling for this clip
          pollingClipsRef.current.add(savedClip.id);
          pollClipStatus(savedClip.id, clipIndex);
          return;
        } catch (err) {
          console.error('[VideoClipper] Failed to start background export:', err);
          setExportStates(prev => {
            const next = new Map(prev);
            const states = next.get(clipIndex) || {};
            next.set(clipIndex, { ...states, [exportKey]: { status: 'error', error: err instanceof Error ? err.message : 'Export failed' } });
            return next;
          });
          return;
        }
      }
    }

    // Fallback: synchronous processing (when job is not saved)
    try {
      // Step 1: Get the source video for this aspect ratio
      // If we don't have this format yet (no captions version), we need to resize first
      const existingExports = clipExports.get(clipIndex) || {};
      const baseFormatKey = format as ExportKey; // e.g., 'vertical', 'square', 'horizontal'
      let sourceVideoUrl = existingExports[baseFormatKey]?.url;

      // If we don't have the base format, resize from original clip
      if (!sourceVideoUrl) {
        console.log('[VideoClipper] Resizing to format:', format);
        const resizeResponse = await fetch('/api/video-clipper/resize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: clip.url,
            targetFormat: format,
          }),
        });

        const resizeData = await resizeResponse.json();
        if (!resizeResponse.ok) {
          throw new Error(resizeData.error || 'Resize failed');
        }

        sourceVideoUrl = resizeData.resizedUrl;

        // If this is the non-captioned version, save it directly
        if (!withCaptions) {
          const exportData = { url: resizeData.resizedUrl, width: resizeData.width, height: resizeData.height };

          // Update local state
          setClipExports(prev => {
            const next = new Map(prev);
            const exports = next.get(clipIndex) || {};
            next.set(clipIndex, { ...exports, [exportKey]: exportData });
            return next;
          });

          setExportStates(prev => {
            const next = new Map(prev);
            const states = next.get(clipIndex) || {};
            next.set(clipIndex, { ...states, [exportKey]: { status: 'success' } });
            return next;
          });

          console.log('[VideoClipper] Export complete (resize only):', exportKey);
          return;
        }
      }

      // Step 2: Add captions if needed
      if (withCaptions) {
        console.log('[VideoClipper] Adding captions to:', format);
        const captionResponse = await fetch('/api/video-clipper/caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: sourceVideoUrl,
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

        const captionData = await captionResponse.json();
        if (!captionResponse.ok) {
          throw new Error(captionData.error || 'Caption generation failed');
        }

        const config = PLATFORM_FORMATS[format];
        const exportData = { url: captionData.captionedClipUrl, width: config.width, height: config.height };

        // Update local state
        setClipExports(prev => {
          const next = new Map(prev);
          const exports = next.get(clipIndex) || {};
          next.set(clipIndex, { ...exports, [exportKey]: exportData });
          return next;
        });

        setExportStates(prev => {
          const next = new Map(prev);
          const states = next.get(clipIndex) || {};
          next.set(clipIndex, { ...states, [exportKey]: { status: 'success' } });
          return next;
        });

        console.log('[VideoClipper] Export complete (with captions):', exportKey);
      }
    } catch (err) {
      console.error('[VideoClipper] Export generation error:', err);
      setExportStates(prev => {
        const next = new Map(prev);
        const states = next.get(clipIndex) || {};
        next.set(clipIndex, { ...states, [exportKey]: { status: 'error', error: err instanceof Error ? err.message : 'Export failed' } });
        return next;
      });
    }
  };

  // Auto-save export to database when job is saved
  const autoSaveExport = async (clipIndex: number, exportKey: ExportKey, exportData: { url: string; width: number; height: number }) => {
    const savedClip = savedJobs.find(j => j.id === currentJobId)?.clips[clipIndex];
    if (!savedClip) return;

    try {
      await fetch(`/api/video-clipper/clips/${savedClip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportKey, exportData }),
      });
      console.log('[VideoClipper] Export auto-saved to database');
    } catch (err) {
      console.warn('[VideoClipper] Failed to auto-save export:', err);
    }
  };

  // Phase 5: Save current session as a job
  const handleSaveJob = async () => {
    if (!video || generatedClips.size === 0) return;

    console.log('[VideoClipper] Saving job...');
    setSaveJobStatus('saving');
    setSaveJobError(null);

    try {
      // Convert generated clips map to array with suggestion data and export variants
      const clipsToSave = Array.from(generatedClips.entries()).map(([index, clip]) => {
        const suggestion = suggestions[index];
        const exports = clipExports.get(index) || {};

        return {
          url: clip.url,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration,
          type: suggestion?.type || 'unknown',
          reason: suggestion?.reason || '',
          transcript: suggestion?.transcript || '',
          captionedUrl: null, // Legacy field - now using exports
          formatVariants: Object.keys(exports).length > 0 ? exports : null,
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
    const loadedExports = new Map<number, ClipExports>();
    const loadedExportStates = new Map<number, ExportStatesMap>();

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

      // Load export variants from platformRecommendations (now contains ClipExports structure)
      if (clip.platformRecommendations && typeof clip.platformRecommendations === 'object') {
        const exportsWithProcessing = clip.platformRecommendations as ClipExportsWithProcessing;
        const states: ExportStatesMap = {};

        // Separate processing state from actual exports
        const cleanExports: ClipExports = {};

        Object.keys(exportsWithProcessing).forEach((key) => {
          if (key === '_processing') {
            // Handle processing states
            const processing = exportsWithProcessing._processing;
            if (processing) {
              Object.entries(processing).forEach(([exportKey, state]) => {
                if (state?.status === 'processing') {
                  states[exportKey as ExportKey] = { status: 'generating' };
                } else if (state?.status === 'completed' && state.result) {
                  cleanExports[exportKey as ExportKey] = state.result;
                  states[exportKey as ExportKey] = { status: 'success' };
                } else if (state?.status === 'failed') {
                  states[exportKey as ExportKey] = { status: 'error', error: state.error };
                }
              });
            }
          } else {
            // Regular export - mark as success
            const exportKey = key as ExportKey;
            if (exportsWithProcessing[exportKey]) {
              cleanExports[exportKey] = exportsWithProcessing[exportKey];
              states[exportKey] = { status: 'success' };
            }
          }
        });

        if (Object.keys(cleanExports).length > 0 || Object.keys(states).length > 0) {
          loadedExports.set(index, cleanExports);
          loadedExportStates.set(index, states);
        }
      }

      // Handle legacy clipWithCaptionsUrl by mapping to the appropriate export
      // (we can't know which aspect ratio it was, so we skip this for now)
    });

    setGeneratedClips(clips);
    setSuggestions(loadedSuggestions);
    setClipExports(loadedExports);
    setExportStates(loadedExportStates);
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
    // Reset export state
    setClipExports(new Map());
    setExportStates(new Map());
    // Reset job state
    setCurrentJobId(null);
    setSaveJobStatus('idle');
    setSaveJobError(null);
    // Reset new marketing states
    setTrimAdjustments(new Map());
    setExpandedSuggestions(new Set());
    setShowMarketingContext(false);
    // Reset unified flow state
    setAnalyzeFlowStep('idle');
    setAnalyzeFlowError(null);
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
          {!video && status !== 'uploading' && !youtubeLoading && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-slate-700/50">
                <button
                  onClick={() => setInputMethod('upload')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
                    inputMethod === 'upload'
                      ? 'text-violet-400 bg-slate-700/30 border-b-2 border-violet-500'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload File
                </button>
                <button
                  onClick={() => setInputMethod('youtube')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
                    inputMethod === 'youtube'
                      ? 'text-red-400 bg-slate-700/30 border-b-2 border-red-500'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20'
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                  YouTube URL
                </button>
              </div>

              {/* Upload Tab Content */}
              {inputMethod === 'upload' && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-12 text-center cursor-pointer transition border-2 border-dashed m-4 rounded-xl ${
                    isDragging
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/70'
                  }`}
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

              {/* YouTube Tab Content */}
              {inputMethod === 'youtube' && (
                <div className="p-6">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !youtubeLoading) {
                            handleYoutubeUrl();
                          }
                        }}
                        placeholder="Paste YouTube URL here..."
                        className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-10 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50"
                      />
                    </div>
                    <button
                      onClick={handleYoutubeUrl}
                      disabled={youtubeLoading || !youtubeUrl.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium rounded-lg hover:from-red-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                      {youtubeLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Load Video
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 mt-3 text-center">
                    Downloads video from YouTube for AI clipping (may take a few minutes)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* YouTube Loading State */}
          {youtubeLoading && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-xl bg-red-500/20 flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                </div>
                <p className="text-lg font-medium text-slate-200">Downloading YouTube video...</p>
                <p className="text-sm text-slate-500 mt-1">This may take a few minutes depending on video length</p>
              </div>
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
                    </div>
                  </div>
                </div>
              </div>

              {/* Unified Analyze Video Section - Shows when no analysis done yet */}
              {suggestions.length === 0 && analyzeFlowStep !== 'complete' && (
                <div className="bg-gradient-to-br from-violet-500/10 to-emerald-500/5 rounded-xl border border-violet-500/20 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-violet-500/20 rounded-lg">
                        <Sparkles className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-100">Find Viral Moments</h3>
                        <p className="text-sm text-slate-500">AI will transcribe, analyze, and clip your video automatically</p>
                      </div>
                    </div>
                    {analyzeFlowStep === 'idle' && (
                      <button
                        onClick={() => setShowMarketingContext(!showMarketingContext)}
                        className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        <Target className="w-4 h-4" />
                        {showMarketingContext ? 'Hide' : 'Add'} Context
                        {showMarketingContext ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Marketing Context Form - Collapsible (only when idle) */}
                  {showMarketingContext && analyzeFlowStep === 'idle' && (
                    <div className="mb-5 bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 space-y-4">
                      <p className="text-xs text-slate-400 mb-3">
                        Optional: Add context to help AI find the best moments for your specific needs
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product/Service */}
                        <div>
                          <label className="flex items-center gap-2 text-sm text-slate-300 mb-1.5">
                            <Zap className="w-3 h-3 text-amber-400" />
                            Product/Service
                          </label>
                          <input
                            type="text"
                            value={marketingContext.product}
                            onChange={(e) => setMarketingContext(prev => ({ ...prev, product: e.target.value }))}
                            placeholder="e.g., SaaS tool, coaching program, physical product"
                            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                          />
                        </div>

                        {/* Target Audience */}
                        <div>
                          <label className="flex items-center gap-2 text-sm text-slate-300 mb-1.5">
                            <Users className="w-3 h-3 text-blue-400" />
                            Target Audience
                          </label>
                          <input
                            type="text"
                            value={marketingContext.audience}
                            onChange={(e) => setMarketingContext(prev => ({ ...prev, audience: e.target.value }))}
                            placeholder="e.g., small business owners, fitness enthusiasts"
                            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                          />
                        </div>

                        {/* Marketing Goal */}
                        <div>
                          <label className="flex items-center gap-2 text-sm text-slate-300 mb-1.5">
                            <Target className="w-3 h-3 text-emerald-400" />
                            Marketing Goal
                          </label>
                          <select
                            value={marketingContext.goal}
                            onChange={(e) => setMarketingContext(prev => ({ ...prev, goal: e.target.value }))}
                            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                          >
                            {MARKETING_GOALS.map(goal => (
                              <option key={goal.value} value={goal.value}>{goal.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Tone */}
                        <div>
                          <label className="flex items-center gap-2 text-sm text-slate-300 mb-1.5">
                            <MessageSquare className="w-3 h-3 text-pink-400" />
                            Desired Tone
                          </label>
                          <select
                            value={marketingContext.tone}
                            onChange={(e) => setMarketingContext(prev => ({ ...prev, tone: e.target.value as MarketingContext['tone'] }))}
                            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                          >
                            {MARKETING_TONES.map(tone => (
                              <option key={tone.value} value={tone.value}>{tone.emoji} {tone.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress Steps Indicator */}
                  {analyzeFlowStep !== 'idle' && analyzeFlowStep !== 'error' && (() => {
                    // Use string type to avoid TypeScript narrowing issues with union types
                    const step = analyzeFlowStep as string;
                    const isStep1Active = step === 'transcribing';
                    const isStep1Done = !isStep1Active;
                    const isStep2Active = step === 'analyzing';
                    const isStep2Done = step === 'generating' || step === 'complete';
                    const isStep3Active = step === 'generating';
                    const isStep3Done = step === 'complete';

                    return (
                      <div className="mb-5 bg-slate-900/50 rounded-lg border border-slate-700/50 p-4">
                        <div className="flex items-center gap-4">
                          {/* Step 1: Transcribe */}
                          <div className="flex items-center gap-2">
                            {isStep1Active ? (
                              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 text-emerald-400" />
                            )}
                            <span className={`text-sm ${isStep1Active ? 'text-violet-400' : 'text-emerald-400'}`}>
                              Transcribing
                            </span>
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-600" />

                          {/* Step 2: Analyze */}
                          <div className="flex items-center gap-2">
                            {isStep2Active ? (
                              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                            ) : isStep2Done ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
                            )}
                            <span className={`text-sm ${
                              isStep2Active ? 'text-violet-400' :
                              isStep2Done ? 'text-emerald-400' :
                              'text-slate-500'
                            }`}>
                              Finding Moments
                            </span>
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-600" />

                          {/* Step 3: Generate */}
                          <div className="flex items-center gap-2">
                            {isStep3Active ? (
                              <>
                                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                                <span className="text-sm text-violet-400">
                                  Generating Clips ({generatedClips.size}/{suggestions.length})
                                </span>
                              </>
                            ) : isStep3Done ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm text-emerald-400">Complete</span>
                              </>
                            ) : (
                              <>
                                <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
                                <span className="text-sm text-slate-500">Generating Clips</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Error Display */}
                  {analyzeFlowStep === 'error' && analyzeFlowError && (
                    <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-400">{analyzeFlowError}</p>
                        <button
                          onClick={() => {
                            setAnalyzeFlowStep('idle');
                            setAnalyzeFlowError(null);
                          }}
                          className="text-red-400 hover:text-red-300 underline mt-2 text-sm"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Analysis Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Clip Duration Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Clip length:</span>
                        <select
                          value={targetClipDuration}
                          onChange={(e) => setTargetClipDuration(Number(e.target.value))}
                          disabled={analyzeFlowStep !== 'idle'}
                          className="px-2 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
                        >
                          <option value={10}>~10 sec</option>
                          <option value={15}>~15 sec</option>
                          <option value={30}>~30 sec</option>
                          <option value={60}>~60 sec</option>
                          <option value={90}>~90 sec</option>
                        </select>
                      </div>
                    </div>

                    {analyzeFlowStep === 'idle' ? (
                      <button
                        onClick={handleAnalyzeVideo}
                        className="px-5 py-2.5 text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition flex items-center gap-2 font-medium"
                      >
                        <Sparkles className="w-4 h-4" />
                        Analyze Video
                      </button>
                    ) : analyzeFlowStep === 'error' ? (
                      <button
                        onClick={handleAnalyzeVideo}
                        className="px-5 py-2.5 text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition flex items-center gap-2 font-medium"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-5 py-2.5 text-white bg-emerald-500/50 rounded-lg flex items-center gap-2 cursor-not-allowed"
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Transcript Display - Collapsible (only show after analysis) */}
              {transcript && suggestions.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="font-semibold text-slate-100 flex items-center gap-2 hover:text-slate-200 transition"
                    >
                      {showTranscript ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <FileVideo className="w-4 h-4 text-slate-400" />
                      Transcript
                      <span className="text-sm text-slate-500 font-normal">
                        ({transcript.segments.length} segments)
                      </span>
                    </button>
                  </div>

                  {showTranscript && (
                    <div className="max-h-64 overflow-y-auto border-t border-slate-700/50">
                      {transcript.segments.length > 0 ? (
                        <div className="divide-y divide-slate-700/50">
                          {transcript.segments.map((segment, index) => (
                            <div
                              key={index}
                              className="px-5 py-3 hover:bg-slate-700/30 transition cursor-pointer"
                              onClick={() => handleSeekToTime(segment.start)}
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
                  )}
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
                              <button
                                onClick={() => handleSeekToTime(suggestion.startTime)}
                                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1 transition"
                                title="Click to preview in source video"
                              >
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(suggestion.startTime)} - {formatTimestamp(suggestion.endTime)}
                              </button>
                              <span className="text-xs text-slate-600">
                                ({Math.round(suggestion.endTime - suggestion.startTime)}s)
                              </span>
                            </div>

                            {/* Generate Clip Button */}
                            {!generatedClip && !isGenerating && (
                              <div className="flex items-center gap-2">
                                {/* Show different button if trim is adjusted */}
                                {(trimAdjustments.get(index)?.startOffset || trimAdjustments.get(index)?.endOffset) ? (
                                  <button
                                    onClick={() => handleGenerateClip(index, suggestion, true)}
                                    className="px-3 py-1.5 text-sm text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition flex items-center gap-1"
                                  >
                                    <Scissors className="w-3 h-3" />
                                    Generate Adjusted
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleGenerateClip(index, suggestion)}
                                    className="px-3 py-1.5 text-sm text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition flex items-center gap-1"
                                  >
                                    <Scissors className="w-3 h-3" />
                                    Generate
                                  </button>
                                )}
                              </div>
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
                            <p className="text-slate-500 text-xs italic border-l-2 border-slate-700 pl-3 mb-3">
                              "{suggestion.transcript}"
                            </p>
                          )}

                          {/* Scores and Marketing Insights */}
                          {suggestion.scores && (
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              {/* Overall Score */}
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <Star className="w-3 h-3 text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-400">
                                  {suggestion.scores.overallScore}/10
                                </span>
                              </div>

                              {/* Individual Scores */}
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">
                                <Zap className="w-3 h-3 text-amber-400" />
                                Hook: {suggestion.scores.hookStrength}
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">
                                <TrendingUp className="w-3 h-3 text-pink-400" />
                                Emotion: {suggestion.scores.emotionalImpact}
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">
                                <Target className="w-3 h-3 text-blue-400" />
                                Conversion: {suggestion.scores.conversionPotential}
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">
                                <TrendingUp className="w-3 h-3 text-violet-400" />
                                Viral: {suggestion.scores.viralPotential}
                              </div>

                              {/* Psychological Trigger */}
                              {suggestion.psychologicalTrigger && (
                                <span className="px-2 py-1 bg-violet-500/20 border border-violet-500/30 rounded text-xs text-violet-300 font-medium">
                                  {suggestion.psychologicalTrigger}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Suggested CTA */}
                          {suggestion.suggestedCTA && (
                            <div className="mb-3 flex items-center gap-2">
                              <span className="text-xs text-slate-500">Suggested CTA:</span>
                              <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                {suggestion.suggestedCTA}
                              </span>
                              <button
                                onClick={() => handleCopyToClipboard(suggestion.suggestedCTA || '')}
                                className="text-slate-500 hover:text-slate-300 transition"
                                title="Copy to clipboard"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {/* Platform Recommendations - Expandable */}
                          {suggestion.platformRecommendations && suggestion.platformRecommendations.length > 0 && (
                            <div className="mb-3">
                              <button
                                onClick={() => toggleSuggestionExpanded(index)}
                                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 mb-2"
                              >
                                {expandedSuggestions.has(index) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                Platform Recommendations ({suggestion.platformRecommendations.length})
                              </button>

                              {expandedSuggestions.has(index) && (
                                <div className="space-y-2">
                                  {suggestion.platformRecommendations.map((rec, recIdx) => (
                                    <div key={recIdx} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-200">{rec.platform}</span>
                                        <button
                                          onClick={() => handleCopyToClipboard(`${rec.suggestedCaption}\n\n${rec.hashtags.join(' ')}`)}
                                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                                        >
                                          <Copy className="w-3 h-3" />
                                          Copy All
                                        </button>
                                      </div>
                                      <p className="text-xs text-slate-300 mb-2">"{rec.suggestedCaption}"</p>
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {rec.hashtags.map((tag, tagIdx) => (
                                          <span key={tagIdx} className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                      <p className="text-xs text-slate-500">{rec.whyThisPlatform}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Trim Adjustment Controls - Before clip generation */}
                          {!generatedClip && (
                            <div className="mb-3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Scissors className="w-3 h-3" />
                                  Adjust Clip Boundaries
                                </span>
                                {(trimAdjustments.get(index)?.startOffset !== 0 || trimAdjustments.get(index)?.endOffset !== 0) && (
                                  <button
                                    onClick={() => setTrimAdjustments(prev => {
                                      const next = new Map(prev);
                                      next.delete(index);
                                      return next;
                                    })}
                                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    Reset
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-slate-500 flex items-center gap-1">
                                    <SkipBack className="w-3 h-3" />
                                    Start:
                                  </label>
                                  <select
                                    value={trimAdjustments.get(index)?.startOffset || 0}
                                    onChange={(e) => handleTrimChange(index, 'startOffset', Number(e.target.value))}
                                    className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200"
                                  >
                                    {[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(v => (
                                      <option key={v} value={v}>{v > 0 ? `+${v}s` : v === 0 ? '0s' : `${v}s`}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-slate-500 flex items-center gap-1">
                                    <SkipForward className="w-3 h-3" />
                                    End:
                                  </label>
                                  <select
                                    value={trimAdjustments.get(index)?.endOffset || 0}
                                    onChange={(e) => handleTrimChange(index, 'endOffset', Number(e.target.value))}
                                    className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200"
                                  >
                                    {[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(v => (
                                      <option key={v} value={v}>{v > 0 ? `+${v}s` : v === 0 ? '0s' : `${v}s`}</option>
                                    ))}
                                  </select>
                                </div>
                                <span className="text-xs text-slate-600">
                                  = {Math.round((suggestion.endTime + (trimAdjustments.get(index)?.endOffset || 0)) - (suggestion.startTime + (trimAdjustments.get(index)?.startOffset || 0)))}s
                                </span>
                              </div>
                            </div>
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

                          {/* Generated Clip Player with Original Video */}
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
                                  {Math.round(generatedClip.duration)}s • Original
                                </span>
                                <a
                                  href={generatedClip.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={`clip-${index + 1}-${suggestion.type}-original.mp4`}
                                  className="px-3 py-1.5 text-sm text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  Download Original
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Phase 7: 3x2 Export Grid */}
                          {generatedClip && (
                            <div className="mt-4 bg-slate-900/30 rounded-lg border border-slate-700/50 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                  <Maximize2 className="w-4 h-4 text-slate-400" />
                                  Export Formats
                                </h4>
                                <div className="flex items-center gap-2">
                                  {/* Batch Export Button */}
                                  {(() => {
                                    const exports = clipExports.get(index) || {};
                                    const states = exportStates.get(index) || {};
                                    const generatedCount = Object.keys(exports).length;
                                    const processingCount = Object.values(states).filter(s => s?.status === 'generating').length;

                                    if (generatedCount >= 6) return null; // All generated
                                    if (processingCount > 0) {
                                      return (
                                        <span className="text-xs text-violet-400 bg-violet-500/10 px-2 py-1 rounded-full flex items-center gap-1">
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          {currentJobId ? 'Processing in background' : 'Processing...'}
                                        </span>
                                      );
                                    }

                                    return (
                                      <button
                                        onClick={() => handleBatchExport(index)}
                                        className="px-3 py-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg transition flex items-center gap-1"
                                      >
                                        <Sparkles className="w-3 h-3" />
                                        Generate All ({6 - generatedCount})
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Grid Header */}
                              <div className="grid grid-cols-4 gap-2 mb-2">
                                <div className="text-xs text-slate-500"></div>
                                <div className="text-xs text-slate-400 text-center font-medium">9:16</div>
                                <div className="text-xs text-slate-400 text-center font-medium">1:1</div>
                                <div className="text-xs text-slate-400 text-center font-medium">16:9</div>
                              </div>

                              {/* Row 1: Without Captions */}
                              <div className="grid grid-cols-4 gap-2 mb-2">
                                <div className="text-xs text-slate-500 flex items-center">No Captions</div>
                                {(['vertical', 'square', 'horizontal'] as const).map((format) => {
                                  const exportKey = format as ExportKey;
                                  const exports = clipExports.get(index) || {};
                                  const states = exportStates.get(index) || {};
                                  const exportData = exports[exportKey];
                                  const state = states[exportKey];
                                  const isGenerating = state?.status === 'generating';
                                  const isGenerated = !!exportData;
                                  const hasError = state?.status === 'error';

                                  if (isGenerated && exportData) {
                                    return (
                                      <a
                                        key={format}
                                        href={exportData.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={`clip-${index + 1}-${suggestion.type}-${format}.mp4`}
                                        className="px-2 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition flex items-center justify-center gap-1"
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                    );
                                  }

                                  if (isGenerating) {
                                    return (
                                      <button
                                        key={format}
                                        disabled
                                        className="px-2 py-1.5 text-xs text-slate-400 bg-slate-700/50 border border-slate-600/50 rounded flex items-center justify-center"
                                      >
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      </button>
                                    );
                                  }

                                  return (
                                    <button
                                      key={format}
                                      onClick={() => handleGenerateExport(index, exportKey)}
                                      className={`px-2 py-1.5 text-xs rounded transition flex items-center justify-center ${
                                        hasError
                                          ? 'text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20'
                                          : 'text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50'
                                      }`}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Row 2: With Captions */}
                              <div className="grid grid-cols-4 gap-2">
                                <div className="text-xs text-amber-500/80 flex items-center gap-1">
                                  <Type className="w-3 h-3" />
                                  Captions
                                </div>
                                {(['vertical', 'square', 'horizontal'] as const).map((format) => {
                                  const exportKey = `${format}Captioned` as ExportKey;
                                  const exports = clipExports.get(index) || {};
                                  const states = exportStates.get(index) || {};
                                  const exportData = exports[exportKey];
                                  const state = states[exportKey];
                                  const isGenerating = state?.status === 'generating';
                                  const isGenerated = !!exportData;
                                  const hasError = state?.status === 'error';

                                  if (isGenerated && exportData) {
                                    return (
                                      <a
                                        key={format}
                                        href={exportData.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={`clip-${index + 1}-${suggestion.type}-${format}-captioned.mp4`}
                                        className="px-2 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition flex items-center justify-center gap-1"
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                    );
                                  }

                                  if (isGenerating) {
                                    return (
                                      <button
                                        key={format}
                                        disabled
                                        className="px-2 py-1.5 text-xs text-slate-400 bg-slate-700/50 border border-slate-600/50 rounded flex items-center justify-center"
                                      >
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      </button>
                                    );
                                  }

                                  return (
                                    <button
                                      key={format}
                                      onClick={() => handleGenerateExport(index, exportKey)}
                                      className={`px-2 py-1.5 text-xs rounded transition flex items-center justify-center ${
                                        hasError
                                          ? 'text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20'
                                          : 'text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50'
                                      }`}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Error display */}
                              {(() => {
                                const states = exportStates.get(index) || {};
                                const errorEntry = Object.entries(states).find(([, s]) => s?.status === 'error');
                                if (errorEntry && errorEntry[1]?.error) {
                                  return (
                                    <div className="mt-3 text-xs text-red-400 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      {errorEntry[1].error}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
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
