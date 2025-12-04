'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import { UploadedVideo, UploadStatus, Transcript, TranscribeStatus, ClipSuggestion, AnalyzeStatus, GeneratedClip, SavedJob, SaveJobStatus } from './types';
import {
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
  ERRORS,
  formatFileSize,
  formatDuration,
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

  // Phase 5: Save current session as a job
  const handleSaveJob = async () => {
    if (!video || generatedClips.size === 0) return;

    console.log('[VideoClipper] Saving job...');
    setSaveJobStatus('saving');
    setSaveJobError(null);

    try {
      // Convert generated clips map to array with suggestion data
      const clipsToSave = Array.from(generatedClips.entries()).map(([index, clip]) => {
        const suggestion = suggestions[index];
        return {
          url: clip.url,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration,
          type: suggestion?.type || 'unknown',
          reason: suggestion?.reason || '',
          transcript: suggestion?.transcript || '',
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
    });

    setGeneratedClips(clips);
    setSuggestions(loadedSuggestions);
    setAnalyzeStatus('success');
    setTranscribeStatus('success');
    setTranscript({ fullText: '', segments: [] });
    setShowJobHistory(false);
  };

  // Get label color for clip type
  const getTypeColor = (type: ClipSuggestion['type']) => {
    const colors = {
      hook: 'bg-purple-100 text-purple-700',
      testimonial: 'bg-green-100 text-green-700',
      benefit: 'bg-blue-100 text-blue-700',
      cta: 'bg-orange-100 text-orange-700',
      problem: 'bg-red-100 text-red-700',
      solution: 'bg-teal-100 text-teal-700',
      viral: 'bg-pink-100 text-pink-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
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
    // Reset job state
    setCurrentJobId(null);
    setSaveJobStatus('idle');
    setSaveJobError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
          >
            ← Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Video Clipper</h1>
              <p className="text-gray-600 mt-1">
                {showJobHistory ? 'View your saved clip jobs' : 'Upload a video to get started'}
              </p>
            </div>
            <button
              onClick={() => setShowJobHistory(!showJobHistory)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showJobHistory
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showJobHistory ? 'New Clip' : `History (${savedJobs.length})`}
            </button>
          </div>
        </div>

        {/* Job History View */}
        {showJobHistory && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Jobs</h2>

            {loadingJobs ? (
              <div className="text-center py-8">
                <svg className="animate-spin h-8 w-8 mx-auto text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-500 mt-2">Loading jobs...</p>
              </div>
            ) : savedJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No saved jobs yet.</p>
                <button
                  onClick={() => setShowJobHistory(false)}
                  className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700 underline"
                >
                  Create your first clip
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {savedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{job.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {job.clips.length} clip{job.clips.length !== 1 ? 's' : ''} •
                          {job.videoDuration ? ` ${formatDuration(job.videoDuration)} video • ` : ' '}
                          {new Date(job.createdAt).toLocaleDateString()}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {job.clips.slice(0, 5).map((clip, idx) => (
                            <span
                              key={clip.id}
                              className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(clip.momentType as ClipSuggestion['type'])}`}
                            >
                              {clip.momentType}
                            </span>
                          ))}
                          {job.clips.length > 5 && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              +{job.clips.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleLoadJob(job)}
                          className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg transition-colors"
                        >
                          Delete
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Upload Zone - shown when no video */}
          {!video && status !== 'uploading' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                transition-colors
                ${isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
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
              <div className="text-gray-400 mb-4">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-700">
                Drop video here or click to browse
              </p>
              <p className="text-sm text-gray-500 mt-2">
                MP4, MOV, WebM (max 1GB, 30 minutes)
              </p>
            </div>
          )}

          {/* Upload Progress */}
          {status === 'uploading' && (
            <div className="py-12">
              <div className="text-center mb-4">
                {progress < 100 ? (
                  <>
                    <p className="text-lg font-medium text-gray-700">
                      Uploading video...
                    </p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                      {progress}%
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-center mb-3">
                      <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-700">
                      Processing video...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Almost done
                    </p>
                  </>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${progress >= 100 ? 'bg-blue-600 animate-pulse' : 'bg-blue-600'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
              <button
                onClick={handleReset}
                className="text-red-600 underline mt-2 text-sm"
              >
                Try again
              </button>
            </div>
          )}

          {/* Video Player - shown after upload */}
          {video && status === 'success' && (
            <div>
              {/* Video Element */}
              <div className="bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  src={video.url}
                  controls
                  className="w-full max-h-[500px]"
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Video Info */}
              <div className="flex items-center justify-between text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-4">
                  <span className="font-medium text-gray-900">
                    {video.filename}
                  </span>
                  <span>{formatFileSize(video.size)}</span>
                  {video.duration && (
                    <span>{formatDuration(video.duration)}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Upload Another
                </button>

                {/* Phase 2: Transcribe Button */}
                {!transcript && transcribeStatus !== 'transcribing' && (
                  <button
                    onClick={handleTranscribe}
                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Transcribe Video
                  </button>
                )}

                {/* Transcribing State */}
                {transcribeStatus === 'transcribing' && (
                  <button
                    disabled
                    className="px-4 py-2 text-white bg-blue-400 rounded-lg flex items-center gap-2 cursor-not-allowed"
                  >
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Transcribing...
                  </button>
                )}
              </div>

              {/* Transcription Error */}
              {transcribeError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700">{transcribeError}</p>
                  <button
                    onClick={() => {
                      setTranscribeError(null);
                      setTranscribeStatus('idle');
                    }}
                    className="text-red-600 underline mt-2 text-sm"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Phase 2: Transcript Display */}
              {transcript && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Transcript
                  </h3>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                    {transcript.segments.length > 0 ? (
                      <div className="divide-y divide-gray-200">
                        {transcript.segments.map((segment, index) => (
                          <div
                            key={index}
                            className="p-3 hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-xs font-mono text-blue-600 mr-3">
                              {formatTimestamp(segment.start)}
                            </span>
                            <span className="text-gray-700">{segment.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-gray-500">
                        {transcript.fullText || 'No transcript available'}
                      </div>
                    )}
                  </div>

                  {/* Phase 3: Analyze Button */}
                  {suggestions.length === 0 && analyzeStatus !== 'analyzing' && (
                    <button
                      onClick={handleAnalyze}
                      className="mt-4 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      Find Ad Moments
                    </button>
                  )}

                  {/* Analyzing State */}
                  {analyzeStatus === 'analyzing' && (
                    <button
                      disabled
                      className="mt-4 px-4 py-2 text-white bg-green-400 rounded-lg flex items-center gap-2 cursor-not-allowed"
                    >
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </button>
                  )}

                  {/* Analysis Error */}
                  {analyzeError && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700">{analyzeError}</p>
                      <button
                        onClick={() => {
                          setAnalyzeError(null);
                          setAnalyzeStatus('idle');
                        }}
                        className="text-red-600 underline mt-2 text-sm"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Phase 3: Clip Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Suggested Clips ({suggestions.length})
                  </h3>
                  <div className="space-y-4">
                    {suggestions.map((suggestion, index) => {
                      const isGenerating = clipGenerating.has(index);
                      const generatedClip = generatedClips.get(index);
                      const clipError = clipErrors.get(index);

                      return (
                        <div
                          key={index}
                          className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-gray-900">
                                #{index + 1}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(suggestion.type)}`}>
                                {suggestion.type}
                              </span>
                              <span className="text-sm text-gray-500">
                                {formatTimestamp(suggestion.startTime)} - {formatTimestamp(suggestion.endTime)}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({Math.round(suggestion.endTime - suggestion.startTime)}s)
                              </span>
                            </div>

                            {/* Phase 4: Generate Clip Button */}
                            {!generatedClip && !isGenerating && (
                              <button
                                onClick={() => handleGenerateClip(index, suggestion)}
                                className="px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                              >
                                Generate Clip
                              </button>
                            )}

                            {/* Generating State */}
                            {isGenerating && (
                              <button
                                disabled
                                className="px-3 py-1.5 text-sm text-white bg-indigo-400 rounded-lg flex items-center gap-2 cursor-not-allowed"
                              >
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                              </button>
                            )}
                          </div>

                          <p className="text-gray-700 text-sm mb-2">
                            {suggestion.reason}
                          </p>

                          {suggestion.transcript && (
                            <p className="text-gray-500 text-xs italic border-l-2 border-gray-200 pl-3 mb-3">
                              "{suggestion.transcript}"
                            </p>
                          )}

                          {/* Clip Error */}
                          {clipError && (
                            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-red-700 text-sm">{clipError}</p>
                              <button
                                onClick={() => handleGenerateClip(index, suggestion)}
                                className="text-red-600 underline text-xs mt-1"
                              >
                                Try again
                              </button>
                            </div>
                          )}

                          {/* Generated Clip Player */}
                          {generatedClip && (
                            <div className="mt-3 bg-gray-50 rounded-lg p-3">
                              <video
                                src={generatedClip.url}
                                controls
                                className="w-full rounded-lg max-h-[300px]"
                              />
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500">
                                  Duration: {Math.round(generatedClip.duration)}s
                                </span>
                                <a
                                  href={generatedClip.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={`clip-${index + 1}-${suggestion.type}.mp4`}
                                  className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 border border-indigo-600 hover:border-indigo-700 rounded-lg transition-colors"
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Phase 5: Save Job Section */}
              {generatedClips.size > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Save This Job</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {currentJobId
                          ? 'This job is already saved'
                          : `Save ${generatedClips.size} generated clip${generatedClips.size !== 1 ? 's' : ''} for later`}
                      </p>
                    </div>
                    {!currentJobId && (
                      <button
                        onClick={handleSaveJob}
                        disabled={saveJobStatus === 'saving'}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          saveJobStatus === 'saving'
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {saveJobStatus === 'saving' && (
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {saveJobStatus === 'saving' ? 'Saving...' : 'Save Job'}
                      </button>
                    )}
                    {currentJobId && (
                      <span className="text-green-600 flex items-center gap-1">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved
                      </span>
                    )}
                  </div>

                  {saveJobStatus === 'success' && !currentJobId && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-green-700 text-sm">Job saved successfully!</p>
                    </div>
                  )}

                  {saveJobError && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-700 text-sm">{saveJobError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Debug Info (development only) */}
        {process.env.NODE_ENV === 'development' && video && !showJobHistory && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg text-xs font-mono">
            <p className="font-bold mb-2">Debug Info:</p>
            <p>URL: {video.url}</p>
            <p>Size: {video.size} bytes</p>
            <p>Duration: {video.duration} seconds</p>
            <p>Current Job ID: {currentJobId || 'none'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
