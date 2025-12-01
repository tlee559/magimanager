import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { put } from "@vercel/blob";
import { broadcastEvent, CHANNELS } from "@magimanager/realtime";
import {
  validateVideoClipperConfig,
  VIDEO_CLIPPER_ERRORS,
} from "@/lib/video-clipper-config";
import {
  runReplicateWithPolling,
  downloadWithRetry,
  REPLICATE_MODELS,
} from "@/lib/replicate-polling";

// Configure route for long-running video processing
// Note: Vercel Pro allows up to 300s (5 min), Enterprise up to 900s (15 min)
export const runtime = "nodejs";
export const maxDuration = 300; // Maximum allowed on Vercel Pro

// GET /api/video-clipper/jobs - List all jobs for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status.toUpperCase();
    }

    const [jobs, total] = await Promise.all([
      prisma.videoClipJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          clips: {
            select: {
              id: true,
              status: true,
              marketingScore: true,
              momentType: true,
              duration: true,
              thumbnailUrl: true,
            },
          },
        },
      }),
      prisma.videoClipJob.count({ where }),
    ]);

    return NextResponse.json({ jobs, total, limit, offset });
  } catch (error) {
    console.error("[Video Clipper] Error fetching jobs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

// POST /api/video-clipper/jobs - Create a new video clip job
export async function POST(req: NextRequest) {
  try {
    // Validate environment configuration first (fail fast)
    const configResult = validateVideoClipperConfig();
    if (!configResult.valid) {
      console.error("[Video Clipper] Configuration errors:", configResult.errors);
      return NextResponse.json(
        {
          error: VIDEO_CLIPPER_ERRORS.CONFIG_INVALID,
          details: configResult.errors,
        },
        { status: 503 }
      );
    }
    if (configResult.warnings.length > 0) {
      console.warn("[Video Clipper] Configuration warnings:", configResult.warnings);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();

    const {
      sourceType,
      sourceUrl,
      uploadedVideoUrl,
      name,
      targetFormat,
      targetDuration,
      maxClips,
      addCaptions,
      captionStyle,
      industry,
      productContext,
      targetAudience,
    } = body;

    // Validate required fields - upload only (YouTube support removed)
    if (sourceType !== "upload") {
      return NextResponse.json(
        { error: "Source type must be 'upload'. YouTube URL support has been removed." },
        { status: 400 }
      );
    }

    if (!uploadedVideoUrl) {
      return NextResponse.json(
        { error: "Uploaded video URL is required" },
        { status: 400 }
      );
    }

    // Create the job
    const job = await prisma.videoClipJob.create({
      data: {
        userId,
        name: name || null,
        sourceType,
        sourceUrl: sourceUrl || null,
        uploadedVideoUrl: uploadedVideoUrl || null,
        targetFormat: targetFormat || "vertical",
        targetDuration: targetDuration || 60,
        maxClips: maxClips || 5,
        addCaptions: addCaptions !== false,
        captionStyle: captionStyle || "modern",
        industry: industry || null,
        productContext: productContext || null,
        targetAudience: targetAudience || null,
        status: "PENDING",
        progress: 0,
      },
      include: {
        clips: true,
      },
    });

    // Trigger processing asynchronously
    processVideoJob(job.id).catch((err) => {
      console.error("[Video Clipper] Background processing error:", err);
    });

    return NextResponse.json({ job });
  } catch (error) {
    console.error("[Video Clipper] Error creating job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create job" },
      { status: 500 }
    );
  }
}

// ============================================================================
// REPLICATE API HELPERS
// ============================================================================

const REPLICATE_API_URL = "https://api.replicate.com/v1";

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error?: string;
}

// Start a Replicate prediction with webhook callback (non-blocking)
async function startReplicateWithWebhook(
  modelVersion: string,
  input: Record<string, unknown>,
  webhookParams: { jobId: string; step: string; clipId?: string }
): Promise<string> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL;
  const webhookUrl = new URL("/api/video-clipper/webhook", baseUrl);
  webhookUrl.searchParams.set("jobId", webhookParams.jobId);
  webhookUrl.searchParams.set("step", webhookParams.step);
  if (webhookParams.clipId) {
    webhookUrl.searchParams.set("clipId", webhookParams.clipId);
  }

  console.log(`[Video Clipper] Starting Replicate with webhook: ${webhookUrl.toString()}`);

  const createResponse = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: modelVersion,
      input,
      webhook: webhookUrl.toString(),
      webhook_events_filter: ["completed"], // Only notify on completion
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await createResponse.json();
  console.log("[Video Clipper] Prediction started (webhook mode):", prediction.id);
  return prediction.id;
}

// Original polling-based function (for short operations or when webhooks aren't suitable)
async function callReplicate(
  modelVersion: string,
  input: Record<string, unknown>,
  options?: {
    maxTimeoutMinutes?: number;
    onProgress?: (pollCount: number, maxPolls: number) => Promise<void>;
  }
): Promise<ReplicatePrediction> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  console.log("[Video Clipper] Starting Replicate prediction...");

  // Start the prediction
  const createResponse = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: modelVersion,
      input,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await createResponse.json();
  console.log("[Video Clipper] Prediction created:", prediction.id);

  // Poll for completion - use shorter timeout for quick operations
  const timeoutMinutes = options?.maxTimeoutMinutes || 5;
  const pollIntervalMs = 3000; // Poll every 3 seconds
  const maxPolls = Math.ceil((timeoutMinutes * 60 * 1000) / pollIntervalMs);

  let result = prediction;
  let pollCount = 0;

  while (
    (result.status === "starting" || result.status === "processing") &&
    pollCount < maxPolls
  ) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    pollCount++;

    const statusResponse = await fetch(
      `${REPLICATE_API_URL}/predictions/${prediction.id}`,
      {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      }
    );

    result = await statusResponse.json();

    // Log every 10 polls to reduce noise
    if (pollCount % 10 === 0) {
      console.log(`[Video Clipper] Poll ${pollCount}/${maxPolls}: ${result.status}`);
    }

    // Call progress callback if provided
    if (options?.onProgress) {
      await options.onProgress(pollCount, maxPolls);
    }
  }

  if (result.status === "failed") {
    throw new Error(`Replicate prediction failed: ${result.error}`);
  }

  if (result.status !== "succeeded") {
    throw new Error(`Replicate prediction timed out after ${Math.round(pollCount * pollIntervalMs / 60000)} minutes`);
  }

  return result;
}

// ============================================================================
// VIDEO PROCESSING (POLLING-BASED - NO WEBHOOKS)
// ============================================================================

async function processVideoJob(jobId: string) {
  const LOG_PREFIX = `[VideoClipper:${jobId.slice(0, 8)}]`;

  console.log(`${LOG_PREFIX} ========== STARTING JOB ==========`);
  console.log(`${LOG_PREFIX} Job ID: ${jobId}`);
  console.log(`${LOG_PREFIX} Timestamp: ${new Date().toISOString()}`);

  try {
    // Update status to downloading
    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        status: "DOWNLOADING",
        progress: 5,
        startedAt: new Date(),
      },
    });
    console.log(`${LOG_PREFIX} Status updated to DOWNLOADING`);

    const job = await prisma.videoClipJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      console.error(`${LOG_PREFIX} ERROR: Job not found in database!`);
      return;
    }

    console.log(`${LOG_PREFIX} Job loaded from DB:`);
    console.log(`${LOG_PREFIX}   - sourceType: ${job.sourceType}`);
    console.log(`${LOG_PREFIX}   - uploadedVideoUrl: ${job.uploadedVideoUrl?.substring(0, 80) || 'null'}`);
    console.log(`${LOG_PREFIX}   - maxClips: ${job.maxClips}`);
    console.log(`${LOG_PREFIX}   - targetDuration: ${job.targetDuration}`);

    let videoUrl: string | null = null;
    let videoTitle = job.name || "Video";
    let transcript: TranscriptSegment[] = [];

    // Handle uploaded video (YouTube support removed)
    if (job.sourceType === "upload" && job.uploadedVideoUrl) {
      console.log(`${LOG_PREFIX} ========== UPLOAD MODE ==========`);
      videoUrl = job.uploadedVideoUrl;
      videoTitle = job.name || "Uploaded Video";
      console.log(`${LOG_PREFIX} Uploaded video URL: ${videoUrl}`);
    } else {
      console.error(`${LOG_PREFIX} ERROR: Invalid source - sourceType: ${job.sourceType}, uploadedVideoUrl: ${job.uploadedVideoUrl}`);
      throw new Error(VIDEO_CLIPPER_ERRORS.INVALID_VIDEO_URL);
    }

    // Update progress
    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        status: "ANALYZING",
        progress: 40,
        videoTitle,
      },
    });

    // Step 2: Transcribe video using Whisper
    console.log(`${LOG_PREFIX} ========== TRANSCRIPTION ==========`);
    if (videoUrl) {
      console.log(`${LOG_PREFIX} Step 2: Transcribing with incredibly-fast-whisper...`);
      console.log(`${LOG_PREFIX} Video URL: ${videoUrl.substring(0, 100)}...`);
      console.log(`${LOG_PREFIX} Model: ${REPLICATE_MODELS.INCREDIBLY_FAST_WHISPER}`);
      try {
        const whisperOutput = await runReplicateWithPolling(
          REPLICATE_MODELS.INCREDIBLY_FAST_WHISPER.split(":")[1],
          {
            audio: videoUrl,
            task: "transcribe",
            language: "english",
            batch_size: 64,
            timestamp: "word",
          },
          {
            maxWaitMs: 15 * 60 * 1000, // 15 minutes for long videos
            pollIntervalMs: 3000,
          }
        );

        console.log(`${LOG_PREFIX} Whisper completed!`);
        console.log(`${LOG_PREFIX} Output type: ${typeof whisperOutput}`);
        console.log(`${LOG_PREFIX} Output preview: ${JSON.stringify(whisperOutput).slice(0, 500)}`);
        transcript = parseWhisperOutput(whisperOutput);
        console.log(`${LOG_PREFIX} Parsed ${transcript.length} transcript segments`);
        if (transcript.length > 0) {
          console.log(`${LOG_PREFIX} First segment: ${JSON.stringify(transcript[0])}`);
          console.log(`${LOG_PREFIX} Last segment: ${JSON.stringify(transcript[transcript.length - 1])}`);
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} ERROR in Whisper transcription:`, error);
        throw new Error(VIDEO_CLIPPER_ERRORS.TRANSCRIPTION_FAILED);
      }
    } else {
      console.error(`${LOG_PREFIX} ERROR: No video URL available for transcription!`);
      throw new Error(VIDEO_CLIPPER_ERRORS.TRANSCRIPTION_FAILED);
    }

    // If still no transcript, fail explicitly (no more mock fallback)
    if (transcript.length === 0) {
      console.error(`${LOG_PREFIX} FATAL: No transcript segments parsed!`);
      throw new Error(VIDEO_CLIPPER_ERRORS.TRANSCRIPTION_FAILED);
    }

    console.log(`${LOG_PREFIX} ========== TRANSCRIPT READY ==========`);
    console.log(`${LOG_PREFIX} Total segments: ${transcript.length}`);

    // Estimate video duration from transcript
    const videoDuration = transcript.length > 0
      ? Math.ceil(transcript[transcript.length - 1].end)
      : 600;

    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        progress: 50,
        videoDuration,
      },
    });

    // Analyze transcript for marketing moments using Gemini
    console.log(`${LOG_PREFIX} ========== GEMINI ANALYSIS ==========`);
    console.log(`${LOG_PREFIX} Analyzing ${transcript.length} segments for marketing moments...`);
    console.log(`${LOG_PREFIX} GOOGLE_API_KEY present: ${!!process.env.GOOGLE_API_KEY}`);

    const analysisResult = await analyzeTranscriptWithGemini(transcript, job);

    console.log(`${LOG_PREFIX} Analysis complete!`);
    console.log(`${LOG_PREFIX} Moments found: ${analysisResult.moments?.length || 0}`);

    if (!analysisResult.moments || analysisResult.moments.length === 0) {
      console.error(`${LOG_PREFIX} FATAL: No marketing moments found in video!`);
      throw new Error(VIDEO_CLIPPER_ERRORS.NO_MOMENTS_FOUND);
    }

    // Log all found moments
    analysisResult.moments.forEach((m, i) => {
      console.log(`${LOG_PREFIX} Moment ${i + 1}: ${m.startTime}s-${m.endTime}s (${m.type}, score: ${m.marketingScore})`);
    });

    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        status: "CLIPPING",
        progress: 60,
        analysisResults: JSON.stringify(analysisResult),
      },
    });

    // Create clip records first (as PENDING)
    const clips = analysisResult.moments.slice(0, job.maxClips);
    console.log(`${LOG_PREFIX} ========== CLIP CREATION ==========`);
    console.log(`${LOG_PREFIX} Creating ${clips.length} clip records (max: ${job.maxClips})`);

    const createdClips: Array<{ id: string; startTime: number; endTime: number; transcript: string; suggestedCaption: string }> = [];

    for (const moment of clips) {
      const clip = await prisma.videoClip.create({
        data: {
          jobId,
          startTime: moment.startTime,
          endTime: moment.endTime,
          duration: moment.endTime - moment.startTime,
          momentType: moment.type,
          marketingScore: moment.marketingScore,
          conversionPotential: moment.conversionPotential,
          hookStrength: moment.hookStrength,
          emotionalImpact: moment.emotionalImpact,
          whySelected: moment.whySelected,
          suggestedCaption: moment.suggestedCaption,
          transcript: moment.transcript,
          status: "PENDING",
          processingProgress: 0,
        },
      });
      createdClips.push({
        id: clip.id,
        startTime: moment.startTime,
        endTime: moment.endTime,
        transcript: moment.transcript,
        suggestedCaption: moment.suggestedCaption,
      });
    }

    // Process each clip SEQUENTIALLY with polling (not webhooks)
    // This ensures we complete within timeout and don't lose results
    const sourceVideoUrl = videoUrl || job.uploadedVideoUrl;

    console.log(`${LOG_PREFIX} ========== CLIP PROCESSING ==========`);
    console.log(`${LOG_PREFIX} Source video URL: ${sourceVideoUrl ? sourceVideoUrl.substring(0, 100) + '...' : 'NULL!'}`);

    if (sourceVideoUrl) {
      let completedClips = 0;
      const totalClips = createdClips.length;
      console.log(`${LOG_PREFIX} Processing ${totalClips} clips sequentially with polling...`);

      for (const clipInfo of createdClips) {
        const clipNum = completedClips + 1;
        console.log(`${LOG_PREFIX} ---------- CLIP ${clipNum}/${totalClips} ----------`);
        console.log(`${LOG_PREFIX} Clip ID: ${clipInfo.id}`);
        console.log(`${LOG_PREFIX} Time range: ${clipInfo.startTime}s - ${clipInfo.endTime}s`);

        try {
          // Update clip to processing
          await prisma.videoClip.update({
            where: { id: clipInfo.id },
            data: { status: "PROCESSING", processingProgress: 10 },
          });

          // Trim video using polling (not webhooks!)
          console.log(`${LOG_PREFIX} Running trim-video model...`);
          console.log(`${LOG_PREFIX} Model: ${REPLICATE_MODELS.TRIM_VIDEO}`);
          console.log(`${LOG_PREFIX} Input: video=${sourceVideoUrl.substring(0, 50)}..., start=${formatTimeForReplicate(clipInfo.startTime)}, end=${formatTimeForReplicate(clipInfo.endTime)}`);

          const trimOutput = await runReplicateWithPolling<string>(
            REPLICATE_MODELS.TRIM_VIDEO.split(":")[1],
            {
              video: sourceVideoUrl,
              start_time: formatTimeForReplicate(clipInfo.startTime),
              end_time: formatTimeForReplicate(clipInfo.endTime),
              output_format: "mp4",
              quality: "fast",
            },
            {
              maxWaitMs: 5 * 60 * 1000, // 5 minutes per clip
              pollIntervalMs: 3000,
            }
          );

          console.log(`${LOG_PREFIX} Trim output: ${trimOutput ? trimOutput.substring(0, 100) + '...' : 'NULL!'}`);

          // IMMEDIATELY download and store (Replicate deletes after 1 hour)
          if (trimOutput) {
            console.log(`${LOG_PREFIX} Downloading trimmed clip to buffer...`);
            const clipBuffer = await downloadWithRetry(trimOutput, 3);
            console.log(`${LOG_PREFIX} Downloaded ${clipBuffer.length} bytes`);

            // Upload to Vercel Blob
            console.log(`${LOG_PREFIX} Uploading to Vercel Blob...`);
            const clipBlob = await put(
              `video-clipper/${job.userId}/${clipInfo.id}/clip.mp4`,
              clipBuffer,
              { access: "public", addRandomSuffix: true }
            );
            console.log(`${LOG_PREFIX} Clip uploaded to: ${clipBlob.url}`);

            // Generate thumbnail
            let thumbnailUrl = "";
            try {
              console.log(`${LOG_PREFIX} Generating thumbnail...`);
              const thumbnailOutput = await runReplicateWithPolling<string>(
                REPLICATE_MODELS.FRAME_EXTRACTOR.split(":")[1],
                {
                  video: clipBlob.url,
                  return_first_frame: true,
                },
                { maxWaitMs: 2 * 60 * 1000, pollIntervalMs: 2000 }
              );

              if (thumbnailOutput) {
                const thumbnailBuffer = await downloadWithRetry(thumbnailOutput, 2);
                const thumbnailBlob = await put(
                  `video-clipper/${job.userId}/${clipInfo.id}/thumbnail.jpg`,
                  thumbnailBuffer,
                  { access: "public", addRandomSuffix: true }
                );
                thumbnailUrl = thumbnailBlob.url;
                console.log(`${LOG_PREFIX} Thumbnail: ${thumbnailUrl}`);
              }
            } catch (thumbError) {
              console.warn(`${LOG_PREFIX} Thumbnail failed (non-fatal):`, thumbError);
            }

            // Update clip as completed
            await prisma.videoClip.update({
              where: { id: clipInfo.id },
              data: {
                status: "COMPLETED",
                processingProgress: 100,
                clipUrl: clipBlob.url,
                thumbnailUrl,
                fileSize: clipBuffer.length,
              },
            });

            completedClips++;
            console.log(`${LOG_PREFIX} ✅ Clip ${clipNum} COMPLETED`);
          } else {
            console.error(`${LOG_PREFIX} ❌ Clip ${clipNum} - trim returned null output!`);
          }
        } catch (clipError) {
          console.error(`${LOG_PREFIX} ❌ Clip ${clipNum} FAILED:`, clipError);
          await prisma.videoClip.update({
            where: { id: clipInfo.id },
            data: {
              status: "FAILED",
              processingError: clipError instanceof Error ? clipError.message : "Clip processing failed",
            },
          });
        }

        // Update job progress
        const clipProgress = 60 + Math.floor((completedClips / totalClips) * 35);
        await prisma.videoClipJob.update({
          where: { id: jobId },
          data: { progress: clipProgress },
        });
      }

      console.log(`${LOG_PREFIX} ========== CLIP PROCESSING DONE ==========`);
      console.log(`${LOG_PREFIX} Completed: ${completedClips}/${totalClips} clips`);
    } else {
      // No direct video URL available - fail with clear error
      console.error(`${LOG_PREFIX} FATAL: No source video URL available for clipping!`);
      throw new Error(VIDEO_CLIPPER_ERRORS.INVALID_VIDEO_URL);
    }

    // Mark job as completed
    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        completedAt: new Date(),
      },
    });

    // Send notification
    await sendJobCompletionNotification(jobId);

    console.log(`${LOG_PREFIX} ========================================`);
    console.log(`${LOG_PREFIX} ✅ JOB COMPLETED SUCCESSFULLY!`);
    console.log(`${LOG_PREFIX} ========================================`);
  } catch (error) {
    console.error(`${LOG_PREFIX} ========================================`);
    console.error(`${LOG_PREFIX} ❌ JOB FAILED!`);
    console.error(`${LOG_PREFIX} Error:`, error);
    console.error(`${LOG_PREFIX} ========================================`);

    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        processingError: error instanceof Error ? error.message : "Processing failed",
      },
    });
  }
}

// ============================================================================
// JOB COMPLETION NOTIFICATION
// ============================================================================

async function sendJobCompletionNotification(jobId: string) {
  try {
    const completedJob = await prisma.videoClipJob.findUnique({
      where: { id: jobId },
      include: { clips: true },
    });

    if (!completedJob) return;

    const jobName = completedJob.name || completedJob.videoTitle || "your video";
    const clipCount = completedJob.clips.filter(c => c.status === "COMPLETED").length;

    // Create notification in database
    await prisma.notification.create({
      data: {
        userId: completedJob.userId,
        type: "VIDEO_CLIP_COMPLETED",
        title: "Video clips ready!",
        message: `${clipCount} clip${clipCount !== 1 ? "s" : ""} generated from "${jobName}"`,
        entityId: jobId,
        entityType: "video-clip-job",
        isRead: false,
      },
    });

    // Increment unread notification count
    await prisma.user.update({
      where: { id: completedJob.userId },
      data: {
        unreadNotifications: { increment: 1 },
      },
    });

    // Broadcast real-time notification via Pusher
    await broadcastEvent(
      CHANNELS.NOTIFICATIONS(completedJob.userId),
      "notification:new",
      {
        title: "Video clips ready!",
        message: `${clipCount} clip${clipCount !== 1 ? "s" : ""} generated from "${jobName}"`,
        type: "VIDEO_CLIP_COMPLETED",
        entityId: jobId,
        entityType: "video-clip-job",
      }
    );

    console.log("[Video Clipper] Notification sent for job:", jobId);
  } catch (error) {
    console.error("[Video Clipper] Failed to send notification:", error);
  }
}

// ============================================================================
// VIDEO CLIP PROCESSING
// ============================================================================

// Helper to convert seconds to "MM:SS" format for Replicate trim-video model
function formatTimeForReplicate(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface ClipProcessingResult {
  clipUrl: string;
  clipWithCaptionsUrl: string | null;
  thumbnailUrl: string;
  fileSize: number | null;
  resolution: string;
}

async function processVideoClip(
  sourceUrl: string,
  startTime: number,
  endTime: number,
  targetFormat: string,
  userId: string,
  clipId: string
): Promise<ClipProcessingResult> {
  // Determine output resolution based on format
  const resolutions: Record<string, { width: number; height: number }> = {
    vertical: { width: 1080, height: 1920 },
    square: { width: 1080, height: 1080 },
    horizontal: { width: 1920, height: 1080 },
  };
  const res = resolutions[targetFormat] || resolutions.vertical;
  const resolution = `${res.width}x${res.height}`;

  console.log(`[Video Clipper] Processing clip: ${startTime}s - ${endTime}s from ${sourceUrl}`);

  // Use Replicate's trim-video model (verified working)
  // Model: lucataco/trim-video - trims video to specified timestamps
  try {
    const clipResult = await callReplicate(
      "lucataco/trim-video:a58ed80215326cba0a80c77a11dd0d0968c567388228891b3c5c67de2a8d10cb",
      {
        video: sourceUrl,
        start_time: formatTimeForReplicate(startTime),
        end_time: formatTimeForReplicate(endTime),
        output_format: "mp4",
        quality: "fast",
      },
      { maxTimeoutMinutes: 3 } // Short clips should process quickly
    );

    const outputVideoUrl = clipResult.output as string;
    if (outputVideoUrl) {
      // Download and re-upload to Vercel Blob
      const clipBlob = await downloadAndUploadToBlob(
        outputVideoUrl,
        `video-clipper/${userId}/${clipId}/clip.mp4`
      );

      // Generate thumbnail only - captions are added on-demand via separate API
      const thumbnailUrl = await generateVideoThumbnail(clipBlob.url, userId, clipId);

      return {
        clipUrl: clipBlob.url,
        clipWithCaptionsUrl: null,  // Captions generated on-demand
        thumbnailUrl,
        fileSize: clipBlob.size,
        resolution,
      };
    }
  } catch (replicateError) {
    console.error("[Video Clipper] Replicate processing failed:", replicateError);
  }

  // Fallback: If Replicate processing fails, store reference to source with timestamps
  // The UI will show the video player at the correct timestamp
  console.log("[Video Clipper] Using source video reference mode");
  return {
    clipUrl: sourceUrl, // Use source URL - UI will handle seeking
    clipWithCaptionsUrl: null,
    thumbnailUrl: "",
    fileSize: null,
    resolution,
  };
}

async function generateVideoThumbnail(
  videoUrl: string,
  userId: string,
  clipId: string
): Promise<string> {
  // Generate thumbnail using frame-extractor model (verified working)
  // Model: lucataco/frame-extractor - extracts first or last frame from video
  try {
    const thumbnailResult = await callReplicate(
      "lucataco/frame-extractor:c02b3c1df64728476b1c21b0876235119e6ac08b0c9b8a99b82c5f0e0d42442d",
      {
        video: videoUrl,
        return_first_frame: true, // Get first frame for thumbnail
      },
      { maxTimeoutMinutes: 2 } // Frame extraction is fast
    );

    const thumbnailUrl = thumbnailResult.output as string;
    if (thumbnailUrl) {
      const thumbnailBlob = await downloadAndUploadToBlob(
        thumbnailUrl,
        `video-clipper/${userId}/${clipId}/thumbnail.jpg`
      );
      return thumbnailBlob.url;
    }
  } catch (e) {
    console.error("[Video Clipper] Thumbnail generation failed:", e);
  }

  return "";
}

async function generateCaptionedVideo(
  videoUrl: string,
  transcript: string,
  captionStyle: string,
  userId: string,
  clipId: string
): Promise<string | null> {
  // Caption style configurations for fictions-ai/autocaption model
  const styleConfigs: Record<string, {
    font: string;
    caption_color: string;
    highlight_color: string;
    stroke_color: string;
    stroke_width: number;
    font_size: number;
  }> = {
    minimal: {
      font: "Poppins-Regular",
      caption_color: "white",
      highlight_color: "white",
      stroke_color: "black",
      stroke_width: 1.5,
      font_size: 5,
    },
    modern: {
      font: "Poppins-ExtraBold",
      caption_color: "white",
      highlight_color: "yellow",
      stroke_color: "black",
      stroke_width: 2.6,
      font_size: 4,
    },
    bold: {
      font: "Poppins-Black",
      caption_color: "yellow",
      highlight_color: "white",
      stroke_color: "black",
      stroke_width: 4,
      font_size: 5,
    },
    branded: {
      font: "Poppins-Bold",
      caption_color: "#8B5CF6",
      highlight_color: "#EC4899",
      stroke_color: "black",
      stroke_width: 3,
      font_size: 4,
    },
  };

  const config = styleConfigs[captionStyle] || styleConfigs.modern;

  console.log(`[Video Clipper] Adding ${captionStyle} captions to video`);

  // Use fictions-ai/autocaption model (verified working)
  try {
    const captionResult = await callReplicate(
      "fictions-ai/autocaption:18a45ff0d95feb4449d192bbdc06b4a6df168fa33def76dfc51b78ae224b599b",
      {
        video_file_input: videoUrl,
        font: config.font,
        caption_color: config.caption_color,
        highlight_color: config.highlight_color,
        stroke_color: config.stroke_color,
        stroke_width: config.stroke_width,
        font_size: config.font_size,
        max_characters: 10, // Good for vertical/short-form video
        subs_position: "bottom75",
        output_video: true,
        output_transcript: false,
      }
    );

    // autocaption returns an array: [video_url, transcript_url] or just the video URL
    const output = captionResult.output;
    let captionedUrl: string | null = null;

    if (Array.isArray(output) && output.length > 0) {
      captionedUrl = output[0];
    } else if (typeof output === "string") {
      captionedUrl = output;
    }

    if (captionedUrl) {
      const captionedBlob = await downloadAndUploadToBlob(
        captionedUrl,
        `video-clipper/${userId}/${clipId}/clip_captioned.mp4`
      );
      return captionedBlob.url;
    }
  } catch (e) {
    console.error("[Video Clipper] Caption generation failed:", e);
  }

  return null;
}

async function downloadAndUploadToBlob(
  sourceUrl: string,
  filename: string
): Promise<{ url: string; size: number }> {
  console.log("[Video Clipper] Downloading from:", sourceUrl.substring(0, 100));

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  console.log(`[Video Clipper] Downloaded ${buffer.byteLength} bytes, uploading to Blob...`);

  const blob = await put(filename, Buffer.from(buffer), {
    access: "public",
    addRandomSuffix: true,
  });

  console.log("[Video Clipper] Uploaded to:", blob.url);
  return {
    url: blob.url,
    size: buffer.byteLength,
  };
}

// ============================================================================
// TRANSCRIPT TYPES AND PARSING (WHISPER)
// ============================================================================

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

function parseWhisperOutput(output: unknown): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  try {
    // Handle different Whisper output formats
    if (typeof output === "object" && output !== null) {
      const data = output as Record<string, unknown>;

      // Format 1: { chunks: [...] }
      if (Array.isArray(data.chunks)) {
        for (const chunk of data.chunks) {
          if (chunk.timestamp && Array.isArray(chunk.timestamp)) {
            segments.push({
              start: chunk.timestamp[0] || 0,
              end: chunk.timestamp[1] || chunk.timestamp[0] + 5,
              text: chunk.text || "",
            });
          }
        }
      }

      // Format 2: { segments: [...] }
      if (Array.isArray(data.segments)) {
        for (const seg of data.segments) {
          segments.push({
            start: seg.start || 0,
            end: seg.end || seg.start + 5,
            text: seg.text || "",
          });
        }
      }

      // Format 3: Direct text with word timestamps
      if (data.text && Array.isArray(data.words)) {
        // Group words into ~10 second chunks
        let currentSegment: TranscriptSegment | null = null;
        for (const word of data.words as Array<{ word: string; start: number; end: number }>) {
          if (!currentSegment || word.start - currentSegment.start > 10) {
            if (currentSegment) segments.push(currentSegment);
            currentSegment = {
              start: word.start,
              end: word.end,
              text: word.word,
            };
          } else {
            currentSegment.end = word.end;
            currentSegment.text += " " + word.word;
          }
        }
        if (currentSegment) segments.push(currentSegment);
      }
    }

    // If we still have no segments but have text, create a single segment
    if (segments.length === 0 && typeof output === "object" && output !== null) {
      const data = output as Record<string, unknown>;
      if (typeof data.text === "string" && data.text.length > 0) {
        segments.push({
          start: 0,
          end: 300, // Assume 5 minutes
          text: data.text,
        });
      }
    }
  } catch (error) {
    console.error("[Video Clipper] Error parsing Whisper output:", error);
  }

  return segments;
}

// Parse yt-whisper output (slightly different format)
function parseYtWhisperOutput(output: unknown): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  try {
    // yt-whisper can output in different formats
    if (typeof output === "string") {
      // Plain text output - split into sentences and estimate timestamps
      const sentences = output.match(/[^.!?]+[.!?]+/g) || [output];
      const avgSentenceLength = 5; // seconds per sentence estimate
      let currentTime = 0;

      for (const sentence of sentences) {
        const text = sentence.trim();
        if (text.length > 5) {
          segments.push({
            start: currentTime,
            end: currentTime + avgSentenceLength,
            text,
          });
          currentTime += avgSentenceLength;
        }
      }
    } else if (typeof output === "object" && output !== null) {
      const data = output as Record<string, unknown>;

      // Check for segments array
      if (Array.isArray(data.segments)) {
        for (const seg of data.segments) {
          segments.push({
            start: seg.start || 0,
            end: seg.end || seg.start + 5,
            text: seg.text || "",
          });
        }
      } else if (typeof data.text === "string") {
        // Just text, split into estimated segments
        const text = data.text as string;
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const avgSentenceLength = 5;
        let currentTime = 0;

        for (const sentence of sentences) {
          const sentenceText = sentence.trim();
          if (sentenceText.length > 5) {
            segments.push({
              start: currentTime,
              end: currentTime + avgSentenceLength,
              text: sentenceText,
            });
            currentTime += avgSentenceLength;
          }
        }
      }

      // Handle SRT format output
      if (typeof data.srt === "string") {
        const srtLines = (data.srt as string).split("\n\n");
        for (const block of srtLines) {
          const lines = block.split("\n");
          if (lines.length >= 3) {
            const timeLine = lines[1];
            const textLine = lines.slice(2).join(" ");
            const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
            if (timeMatch) {
              const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
              const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
              segments.push({ start, end, text: textLine.trim() });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[Video Clipper] Error parsing yt-whisper output:", error);
  }

  return segments;
}

function getMockTranscript(): TranscriptSegment[] {
  return [
    { start: 0, end: 15, text: "Hey everyone, welcome back to the channel. Today I'm going to show you something that completely changed my business." },
    { start: 15, end: 35, text: "You know that feeling when nothing seems to work? When you've tried everything but still can't get results? I was there too." },
    { start: 35, end: 55, text: "But then I discovered this one simple strategy that transformed everything. Let me show you exactly what I mean." },
    { start: 55, end: 80, text: "The first thing you need to understand is that most people are doing this completely wrong. They focus on the wrong metrics." },
    { start: 80, end: 110, text: "I had a client, Sarah, who was struggling for months. She came to me frustrated, ready to give up on her business entirely." },
    { start: 110, end: 140, text: "Within just 30 days of implementing this strategy, she went from zero sales to consistently making $10,000 per month." },
    { start: 140, end: 170, text: "The secret is focusing on what I call the conversion trifecta - attention, trust, and action. Let me break each one down." },
    { start: 170, end: 200, text: "Attention is about pattern interrupts. You have 3 seconds to grab someone's attention or they're gone. Use bold statements." },
    { start: 200, end: 230, text: "Trust comes from social proof. Show testimonials, case studies, numbers. People need to see that others have succeeded." },
    { start: 230, end: 260, text: "Action requires urgency. Without a reason to act now, people will procrastinate forever. Give them a deadline." },
    { start: 260, end: 290, text: "Now here's the best part - I've put together a complete guide that walks you through this step by step." },
    { start: 290, end: 320, text: "Over 10,000 people have already downloaded it and the results speak for themselves. The average user sees a 3x improvement." },
    { start: 320, end: 350, text: "But here's the thing - this free guide is only available for the next 48 hours. After that, it goes into our paid course." },
    { start: 350, end: 380, text: "So if you want to transform your business like Sarah did, click the link in the description right now." },
    { start: 380, end: 400, text: "Don't wait. Take action today. I'll see you in the guide!" },
  ];
}

// ============================================================================
// GEMINI ANALYSIS
// ============================================================================

async function analyzeTranscriptWithGemini(
  transcript: TranscriptSegment[],
  job: {
    industry: string | null;
    productContext: string | null;
    targetAudience: string | null;
    targetDuration: number;
    maxClips: number;
  }
): Promise<{
  moments: Array<{
    startTime: number;
    endTime: number;
    type: string;
    marketingScore: number;
    conversionPotential: number;
    hookStrength: number;
    emotionalImpact: number;
    whySelected: string;
    suggestedCaption: string;
    transcript: string;
  }>;
}> {
  const apiKey = process.env.GOOGLE_API_KEY;

  // Format transcript for analysis
  const formattedTranscript = transcript
    .map((seg) => `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.text}`)
    .join("\n");

  const prompt = `You are an expert marketing analyst specializing in identifying HIGH-CONVERTING video moments for social media ads.

CONTEXT:
- Industry: ${job.industry || "General"}
- Product/Service: ${job.productContext || "Not specified"}
- Target Audience: ${job.targetAudience || "General audience"}
- Target Clip Duration: ~${job.targetDuration} seconds
- Number of Clips Needed: ${job.maxClips}

TRANSCRIPT:
${formattedTranscript}

TASK:
Analyze this transcript and identify the ${job.maxClips} BEST moments for creating short-form video ads (Reels/TikTok).

MOMENT TYPES TO LOOK FOR:
- hook: Strong opening that grabs attention (pattern interrupts, bold claims)
- testimonial: Customer success stories with specific results
- benefit: Clear value proposition or feature explanation
- cta: Call-to-action with urgency
- social_proof: Numbers, testimonials, authority mentions
- urgency: Time-sensitive offers, scarcity messaging

SCORING (1-100):
- marketingScore: How well does this sell?
- conversionPotential: Will it drive action?
- hookStrength: Does it grab attention in first 3 seconds?
- emotionalImpact: Does it create emotional connection?

Return ONLY a valid JSON object in this exact format:
{
  "moments": [
    {
      "startTime": 15,
      "endTime": 45,
      "type": "hook",
      "marketingScore": 92,
      "conversionPotential": 88,
      "hookStrength": 95,
      "emotionalImpact": 85,
      "whySelected": "Detailed explanation of why this moment would convert well",
      "suggestedCaption": "Short punchy caption for social media",
      "transcript": "The exact words from this segment"
    }
  ]
}`;

  try {
    if (!apiKey) {
      console.log("[Video Clipper] No GOOGLE_API_KEY, using smart fallback analysis");
      return analyzeWithFallback(transcript, job);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }

    throw new Error("No valid JSON in Gemini response");
  } catch (error) {
    console.error("[Video Clipper] Gemini analysis error:", error);
    return analyzeWithFallback(transcript, job);
  }
}

// Fallback analysis when Gemini is not available
function analyzeWithFallback(
  transcript: TranscriptSegment[],
  job: { targetDuration: number; maxClips: number }
): {
  moments: Array<{
    startTime: number;
    endTime: number;
    type: string;
    marketingScore: number;
    conversionPotential: number;
    hookStrength: number;
    emotionalImpact: number;
    whySelected: string;
    suggestedCaption: string;
    transcript: string;
  }>;
} {
  const moments: Array<{
    startTime: number;
    endTime: number;
    type: string;
    marketingScore: number;
    conversionPotential: number;
    hookStrength: number;
    emotionalImpact: number;
    whySelected: string;
    suggestedCaption: string;
    transcript: string;
  }> = [];

  // Keywords that indicate high-converting moments
  const hookKeywords = ["discover", "secret", "changed", "transform", "wrong", "mistake", "actually"];
  const testimonialKeywords = ["client", "customer", "result", "success", "went from", "achieved"];
  const benefitKeywords = ["advantage", "benefit", "best part", "secret", "key"];
  const ctaKeywords = ["click", "link", "sign up", "download", "get", "join", "start"];
  const socialProofKeywords = ["10,000", "thousands", "everyone", "most people", "experts"];
  const urgencyKeywords = ["now", "today", "limited", "only", "hurry", "deadline", "48 hours"];

  for (const segment of transcript) {
    const text = segment.text.toLowerCase();
    let type = "benefit";
    let score = 70;
    let hookScore = 65;
    let emotionScore = 70;
    let conversionScore = 70;
    let reason = "Contains valuable content";

    // Detect moment type and adjust scores
    if (hookKeywords.some(k => text.includes(k)) && segment.start < 60) {
      type = "hook";
      score = 88;
      hookScore = 92;
      emotionScore = 80;
      conversionScore = 85;
      reason = "Strong hook with attention-grabbing language near the start";
    } else if (testimonialKeywords.some(k => text.includes(k))) {
      type = "testimonial";
      score = 85;
      hookScore = 72;
      emotionScore = 88;
      conversionScore = 90;
      reason = "Customer success story with social proof";
    } else if (ctaKeywords.some(k => text.includes(k))) {
      type = "cta";
      score = 87;
      hookScore = 75;
      emotionScore = 78;
      conversionScore = 94;
      reason = "Clear call-to-action driving viewer behavior";
    } else if (socialProofKeywords.some(k => text.includes(k))) {
      type = "social_proof";
      score = 82;
      hookScore = 70;
      emotionScore = 75;
      conversionScore = 85;
      reason = "Social proof with numbers and credibility";
    } else if (urgencyKeywords.some(k => text.includes(k))) {
      type = "urgency";
      score = 84;
      hookScore = 78;
      emotionScore = 80;
      conversionScore = 88;
      reason = "Creates urgency and FOMO";
    } else if (benefitKeywords.some(k => text.includes(k))) {
      type = "benefit";
      score = 80;
      hookScore = 68;
      emotionScore = 72;
      conversionScore = 78;
      reason = "Clear benefit explanation";
    } else {
      continue; // Skip segments without marketing indicators
    }

    // Calculate clip end time
    const clipDuration = Math.min(job.targetDuration, segment.end - segment.start + 15);
    const endTime = Math.min(segment.start + clipDuration, segment.end + 10);

    moments.push({
      startTime: Math.floor(segment.start),
      endTime: Math.floor(endTime),
      type,
      marketingScore: score + Math.floor(Math.random() * 5),
      conversionPotential: conversionScore + Math.floor(Math.random() * 5),
      hookStrength: hookScore + Math.floor(Math.random() * 5),
      emotionalImpact: emotionScore + Math.floor(Math.random() * 5),
      whySelected: reason,
      suggestedCaption: generateCaption(segment.text, type),
      transcript: segment.text,
    });
  }

  // Sort by marketing score and take top clips
  moments.sort((a, b) => b.marketingScore - a.marketingScore);
  return { moments: moments.slice(0, job.maxClips) };
}

function generateCaption(text: string, type: string): string {
  const words = text.split(" ").slice(0, 6).join(" ");

  const prefixes: Record<string, string[]> = {
    hook: ["Wait for it...", "This changed everything", "You need to hear this"],
    testimonial: ["Real results", "This is what happened", "True story"],
    benefit: ["The secret is...", "Here's why", "Game changer"],
    cta: ["Link in bio", "Don't miss this", "Act now"],
    social_proof: ["Join thousands", "See why everyone's talking", "The proof"],
    urgency: ["Limited time", "Don't wait", "Last chance"],
  };

  const options = prefixes[type] || prefixes.benefit;
  return options[Math.floor(Math.random() * options.length)];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
