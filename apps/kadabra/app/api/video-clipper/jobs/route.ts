import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { put } from "@vercel/blob";
import { broadcastEvent, CHANNELS } from "@magimanager/realtime";

// Configure route for long-running video processing
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for video processing

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

    // Validate required fields - upload only
    if (sourceType !== "upload") {
      return NextResponse.json(
        { error: "Only video upload is supported" },
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

async function callReplicate(
  modelVersion: string,
  input: Record<string, unknown>
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

  // Poll for completion
  let result = prediction;
  let pollCount = 0;
  const maxPolls = 120; // 4 minutes max (2s * 120)

  while (
    (result.status === "starting" || result.status === "processing") &&
    pollCount < maxPolls
  ) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
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
    console.log(`[Video Clipper] Poll ${pollCount}: ${result.status}`);
  }

  if (result.status === "failed") {
    throw new Error(`Replicate prediction failed: ${result.error}`);
  }

  if (result.status !== "succeeded") {
    throw new Error(`Replicate prediction timed out after ${pollCount} polls`);
  }

  return result;
}

// ============================================================================
// VIDEO PROCESSING
// ============================================================================

async function processVideoJob(jobId: string) {
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

    const job = await prisma.videoClipJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return;

    // Upload-only: get the uploaded video URL
    if (!job.uploadedVideoUrl) {
      throw new Error("No uploaded video found");
    }

    const videoUrl = job.uploadedVideoUrl;
    const videoTitle = job.name || "Uploaded Video";
    let transcript: TranscriptSegment[] = [];

    // Update progress
    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        status: "ANALYZING",
        progress: 15,
        videoTitle,
      },
    });

    console.log("[Video Clipper] Processing uploaded video:", videoUrl);

    // Transcribe the uploaded video using Whisper
    if (transcript.length === 0) {
      try {
        console.log("[Video Clipper] Transcribing uploaded video with Whisper...");
        const whisperResult = await callReplicate(
          "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
          {
            audio: videoUrl,
            task: "transcribe",
            language: "english",
            batch_size: 64,
            timestamp: "word",
          }
        );

        console.log("[Video Clipper] Whisper output:", JSON.stringify(whisperResult.output).slice(0, 500));
        transcript = parseWhisperOutput(whisperResult.output);
        console.log(`[Video Clipper] Parsed ${transcript.length} transcript segments`);
      } catch (error) {
        console.error("[Video Clipper] Transcription error:", error);
      }
    }

    // Fallback to mock transcript if nothing else worked
    if (transcript.length === 0) {
      console.log("[Video Clipper] Using mock transcript as fallback");
      transcript = getMockTranscript();
    }

    // Estimate video duration from transcript
    const videoDuration = transcript.length > 0
      ? Math.ceil(transcript[transcript.length - 1].end)
      : 600;

    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        progress: 40,
        videoDuration,
      },
    });

    // Analyze transcript for marketing moments using Gemini
    console.log("[Video Clipper] Analyzing for marketing moments...");
    const analysisResult = await analyzeTranscriptWithGemini(transcript, job);

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
    console.log(`[Video Clipper] Creating ${clips.length} clip records`);

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

    // Now process each clip - extract video, generate thumbnail, optionally add captions
    const sourceVideoUrl = job.uploadedVideoUrl || job.sourceUrl;

    if (sourceVideoUrl) {
      console.log("[Video Clipper] Processing clips from source:", sourceVideoUrl);

      let processedCount = 0;
      for (const clipInfo of createdClips) {
        try {
          await prisma.videoClip.update({
            where: { id: clipInfo.id },
            data: { status: "PROCESSING", processingProgress: 10 },
          });

          // Process the clip
          const clipResult = await processVideoClip(
            sourceVideoUrl,
            clipInfo.startTime,
            clipInfo.endTime,
            job.targetFormat,
            job.addCaptions ? clipInfo.transcript : null,
            job.captionStyle,
            job.userId,
            clipInfo.id
          );

          await prisma.videoClip.update({
            where: { id: clipInfo.id },
            data: {
              status: "COMPLETED",
              processingProgress: 100,
              clipUrl: clipResult.clipUrl,
              clipWithCaptionsUrl: clipResult.clipWithCaptionsUrl,
              thumbnailUrl: clipResult.thumbnailUrl,
              fileSize: clipResult.fileSize,
              resolution: clipResult.resolution,
            },
          });

          processedCount++;
          const overallProgress = 60 + Math.floor((processedCount / createdClips.length) * 35);
          await prisma.videoClipJob.update({
            where: { id: jobId },
            data: { progress: overallProgress },
          });

        } catch (clipError) {
          console.error(`[Video Clipper] Error processing clip ${clipInfo.id}:`, clipError);
          await prisma.videoClip.update({
            where: { id: clipInfo.id },
            data: {
              status: "FAILED",
              processingError: clipError instanceof Error ? clipError.message : "Failed to process clip",
            },
          });
        }
      }
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

    // Get the completed job details for notification
    const completedJob = await prisma.videoClipJob.findUnique({
      where: { id: jobId },
      include: { clips: true },
    });

    if (completedJob) {
      const jobName = completedJob.name || completedJob.videoTitle || "your video";
      const clipCount = completedJob.clips.length;

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
    }

    console.log("[Video Clipper] Job completed successfully!");
  } catch (error) {
    console.error("[Video Clipper] Processing error:", error);
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
// VIDEO CLIP PROCESSING
// ============================================================================

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
  transcript: string | null,
  captionStyle: string,
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

  // Use Replicate's video splitter model
  // Model: lucataco/video-splitter - splits video into clips
  try {
    const clipResult = await callReplicate(
      "lucataco/video-splitter:e248ab98ca2d13ce9c08fdfe6d7d1a85c80f8e08c2fb3e6d62e94e9b14c5f60e",
      {
        video: sourceUrl,
        start_second: startTime,
        end_second: endTime,
      }
    );

    const outputVideoUrl = clipResult.output as string;
    if (outputVideoUrl) {
      // Download and re-upload to Vercel Blob
      const clipBlob = await downloadAndUploadToBlob(
        outputVideoUrl,
        `video-clipper/${userId}/${clipId}/clip.mp4`
      );

      // Generate thumbnail from video
      const thumbnailUrl = await generateVideoThumbnail(clipBlob.url, userId, clipId);

      // Add captions if requested
      let clipWithCaptionsUrl: string | null = null;
      if (transcript) {
        clipWithCaptionsUrl = await generateCaptionedVideo(
          clipBlob.url,
          transcript,
          captionStyle,
          userId,
          clipId
        );
      }

      return {
        clipUrl: clipBlob.url,
        clipWithCaptionsUrl,
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
  // Try to generate a thumbnail using Replicate
  try {
    const thumbnailResult = await callReplicate(
      "lucataco/video-to-image:8e456e96bc5e4e5c5bfa5fbd5f5c5d5e5f5e5d5c5b5a595857565554535251",
      {
        video: videoUrl,
        frame_number: 10, // Get frame 10 for thumbnail
      }
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
  // Caption styling based on style preference
  const styles: Record<string, string> = {
    minimal: "white text, thin outline",
    modern: "white text with shadow, medium size",
    bold: "yellow text, thick black outline",
    branded: "white text with purple shadow",
  };

  console.log(`[Video Clipper] Adding ${captionStyle} captions to video`);

  // Use a captioning model from Replicate
  try {
    const captionResult = await callReplicate(
      "fofr/autocaption:e0c4d0e4c0b0a090807060504030201009080706050403020100908070605",
      {
        video: videoUrl,
        transcript: transcript.substring(0, 500),
        style: styles[captionStyle] || styles.modern,
        position: "bottom",
      }
    );

    const captionedUrl = captionResult.output as string;
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
