'use client';

import { useState, useRef, useCallback } from 'react';
import { upload } from '@vercel/blob/client';
import { UploadedVideo, UploadStatus, Transcript, TranscribeStatus } from './types';
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Reset to upload another
  const handleReset = () => {
    setVideo(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
    // Reset transcription state too
    setTranscript(null);
    setTranscribeStatus('idle');
    setTranscribeError(null);
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
          <h1 className="text-2xl font-bold text-gray-900">Video Clipper</h1>
          <p className="text-gray-600 mt-1">
            Upload a video to get started
          </p>
        </div>

        {/* Main Content */}
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
                  {/* Placeholder for Phase 3 - Analyze button will go here */}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Debug Info (development only) */}
        {process.env.NODE_ENV === 'development' && video && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg text-xs font-mono">
            <p className="font-bold mb-2">Debug Info:</p>
            <p>URL: {video.url}</p>
            <p>Size: {video.size} bytes</p>
            <p>Duration: {video.duration} seconds</p>
          </div>
        )}
      </div>
    </div>
  );
}
