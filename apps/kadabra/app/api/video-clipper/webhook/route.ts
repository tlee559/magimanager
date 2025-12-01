import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@magimanager/database";
import { put } from "@vercel/blob";
import { broadcastEvent, CHANNELS } from "@magimanager/realtime";

// Configure route for webhook processing
export const runtime = "nodejs";
export const maxDuration = 300;

// ============================================================================
// TYPES
// ============================================================================

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

// POST /api/video-clipper/webhook
// Called by Replicate when a prediction completes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[Video Clipper Webhook] Received:", JSON.stringify(body, null, 2));

    const { id, status, output, error, input } = body;

    // Validate webhook payload
    if (!id || !status) {
      console.error("[Video Clipper Webhook] Invalid payload - missing id or status");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Extract metadata from webhook_events_filter or input
    // We encode jobId and step in the webhook URL as query params
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");
    const step = url.searchParams.get("step"); // "transcribe" | "clip" | "thumbnail"
    const clipId = url.searchParams.get("clipId");

    if (!jobId) {
      console.error("[Video Clipper Webhook] Missing jobId in webhook URL");
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    console.log(`[Video Clipper Webhook] Job ${jobId}, Step: ${step}, Status: ${status}`);

    // Handle based on status
    if (status === "succeeded") {
      await handleSuccess(jobId, step, clipId, output);
    } else if (status === "failed" || status === "canceled") {
      await handleFailure(jobId, step, clipId, error);
    }
    // Ignore "starting" and "processing" status updates

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Video Clipper Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleSuccess(
  jobId: string,
  step: string | null,
  clipId: string | null,
  output: unknown
) {
  const job = await prisma.videoClipJob.findUnique({
    where: { id: jobId },
    include: { clips: true },
  });

  if (!job) {
    console.error(`[Video Clipper Webhook] Job ${jobId} not found`);
    return;
  }

  switch (step) {
    case "transcribe":
      await handleTranscriptionComplete(job, output);
      break;
    case "clip":
      if (clipId) {
        await handleClipComplete(job, clipId, output);
      }
      break;
    case "thumbnail":
      if (clipId) {
        await handleThumbnailComplete(job, clipId, output);
      }
      break;
    default:
      console.log(`[Video Clipper Webhook] Unknown step: ${step}`);
  }
}

async function handleFailure(
  jobId: string,
  step: string | null,
  clipId: string | null,
  error: string | null
) {
  const errorMessage = error || "Processing failed";

  if (step === "clip" && clipId) {
    await prisma.videoClip.update({
      where: { id: clipId },
      data: {
        status: "FAILED",
        processingError: errorMessage,
      },
    });
  } else {
    // For transcription failures, fail the whole job
    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        processingError: errorMessage,
      },
    });
  }
}

async function handleTranscriptionComplete(
  job: { id: string; userId: string; sourceUrl: string | null },
  output: unknown
) {
  console.log(`[Video Clipper Webhook] Transcription complete for job ${job.id}`);
  console.log(`[Video Clipper Webhook] Output type: ${typeof output}, sample: ${JSON.stringify(output).slice(0, 500)}`);

  // Get full job details
  const fullJob = await prisma.videoClipJob.findUnique({
    where: { id: job.id },
  });

  if (!fullJob) {
    console.error(`[Video Clipper Webhook] Job ${job.id} not found`);
    return;
  }

  // Parse SRT transcript from yt-whisper output
  let transcript: TranscriptSegment[] = [];

  if (typeof output === "string") {
    // Direct SRT string output
    transcript = parseSRT(output);
  } else if (output && typeof output === "object") {
    const data = output as Record<string, unknown>;
    // Check for various output formats
    if (typeof data.srt === "string") {
      transcript = parseSRT(data.srt);
    } else if (typeof data.text === "string") {
      // Plain text fallback - estimate timestamps
      transcript = parseTextToSegments(data.text);
    } else if (Array.isArray(data.segments)) {
      // Direct segments format
      transcript = (data.segments as Array<{ start: number; end: number; text: string }>).map(s => ({
        start: s.start || 0,
        end: s.end || s.start + 5,
        text: s.text || "",
      }));
    }
  }

  console.log(`[Video Clipper Webhook] Parsed ${transcript.length} transcript segments`);

  if (transcript.length === 0) {
    await prisma.videoClipJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        processingError: "Transcription returned empty or unparseable result",
      },
    });
    return;
  }

  // Update job to ANALYZING status
  await prisma.videoClipJob.update({
    where: { id: job.id },
    data: {
      status: "ANALYZING",
      progress: 40,
    },
  });

  // Get direct video URL for clipping via Cobalt
  let videoUrl: string | null = null;
  if (fullJob.sourceUrl) {
    try {
      console.log("[Video Clipper Webhook] Getting direct video URL for clipping...");
      const cobaltResult = await fetch("https://api.cobalt.tools/api/json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          url: fullJob.sourceUrl,
          vQuality: "720",
          filenamePattern: "basic",
        }),
      });

      if (cobaltResult.ok) {
        const cobaltData = await cobaltResult.json();
        if (cobaltData.url) {
          videoUrl = cobaltData.url;
          console.log("[Video Clipper Webhook] Got direct video URL from Cobalt");
        }
      } else {
        console.error("[Video Clipper Webhook] Cobalt failed:", await cobaltResult.text());
      }
    } catch (cobaltError) {
      console.error("[Video Clipper Webhook] Cobalt API error:", cobaltError);
    }
  }

  // Analyze transcript for marketing moments using Gemini
  console.log("[Video Clipper Webhook] Analyzing for marketing moments...");
  const analysisResult = await analyzeTranscriptWithGemini(transcript, fullJob);

  // Estimate video duration from transcript
  const videoDuration = transcript.length > 0
    ? Math.ceil(transcript[transcript.length - 1].end)
    : 600;

  await prisma.videoClipJob.update({
    where: { id: job.id },
    data: {
      status: "CLIPPING",
      progress: 60,
      videoDuration,
      analysisResults: JSON.stringify(analysisResult),
    },
  });

  // Create clip records
  const clips = analysisResult.moments.slice(0, fullJob.maxClips);
  console.log(`[Video Clipper Webhook] Creating ${clips.length} clip records`);

  const createdClips: Array<{ id: string; startTime: number; endTime: number }> = [];

  for (const moment of clips) {
    const clip = await prisma.videoClip.create({
      data: {
        jobId: job.id,
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
    });
  }

  // Start clip processing with webhooks if we have a video URL
  if (videoUrl) {
    console.log("[Video Clipper Webhook] Starting clip processing with video URL");

    for (const clipInfo of createdClips) {
      try {
        await triggerClipProcessing(
          job.id,
          clipInfo.id,
          videoUrl,
          clipInfo.startTime,
          clipInfo.endTime
        );

        await prisma.videoClip.update({
          where: { id: clipInfo.id },
          data: {
            status: "PROCESSING",
            processingProgress: 10,
          },
        });
      } catch (error) {
        console.error(`[Video Clipper Webhook] Failed to start clip ${clipInfo.id}:`, error);
        await prisma.videoClip.update({
          where: { id: clipInfo.id },
          data: {
            status: "FAILED",
            processingError: error instanceof Error ? error.message : "Failed to start clip processing",
          },
        });
      }
    }

    console.log(`[Video Clipper Webhook] Started ${createdClips.length} clip jobs`);

    // Update job progress
    await prisma.videoClipJob.update({
      where: { id: job.id },
      data: {
        status: "CLIPPING",
        progress: 65,
      },
    });
  } else {
    // No video URL available - complete clips with analysis only
    console.log("[Video Clipper Webhook] No video URL - completing with analysis only");

    for (const clipInfo of createdClips) {
      await prisma.videoClip.update({
        where: { id: clipInfo.id },
        data: {
          status: "COMPLETED",
          processingProgress: 100,
        },
      });
    }

    // Mark job as completed
    await completeJob(job.id, job.userId, fullJob.name || fullJob.videoTitle || "YouTube Video");
  }
}

async function handleClipComplete(
  job: { id: string; userId: string; clips: Array<{ id: string }> },
  clipId: string,
  output: unknown
) {
  console.log(`[Video Clipper Webhook] Clip ${clipId} processing complete`);

  const outputUrl = typeof output === "string" ? output : null;

  if (!outputUrl) {
    await prisma.videoClip.update({
      where: { id: clipId },
      data: {
        status: "FAILED",
        processingError: "Clip processing returned no output",
      },
    });
    return;
  }

  // Download and re-upload to Vercel Blob
  try {
    const response = await fetch(outputUrl);
    if (!response.ok) throw new Error(`Failed to download clip: ${response.status}`);
    const buffer = await response.arrayBuffer();

    const blob = await put(
      `video-clipper/${job.userId}/${clipId}/clip.mp4`,
      Buffer.from(buffer),
      { access: "public", addRandomSuffix: true }
    );

    await prisma.videoClip.update({
      where: { id: clipId },
      data: {
        clipUrl: blob.url,
        fileSize: buffer.byteLength,
        processingProgress: 80,
      },
    });

    // Trigger thumbnail generation
    await triggerThumbnailGeneration(job.id, clipId, blob.url, job.userId);
  } catch (error) {
    console.error(`[Video Clipper Webhook] Failed to save clip ${clipId}:`, error);
    await prisma.videoClip.update({
      where: { id: clipId },
      data: {
        status: "FAILED",
        processingError: error instanceof Error ? error.message : "Failed to save clip",
      },
    });
  }
}

async function handleThumbnailComplete(
  job: { id: string; userId: string; clips: Array<{ id: string }> },
  clipId: string,
  output: unknown
) {
  console.log(`[Video Clipper Webhook] Thumbnail ${clipId} complete`);

  const thumbnailUrl = typeof output === "string" ? output : null;

  if (thumbnailUrl) {
    try {
      const response = await fetch(thumbnailUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const blob = await put(
          `video-clipper/${job.userId}/${clipId}/thumbnail.jpg`,
          Buffer.from(buffer),
          { access: "public", addRandomSuffix: true }
        );

        await prisma.videoClip.update({
          where: { id: clipId },
          data: {
            thumbnailUrl: blob.url,
            status: "COMPLETED",
            processingProgress: 100,
          },
        });
      }
    } catch (error) {
      console.error(`[Video Clipper Webhook] Failed to save thumbnail ${clipId}:`, error);
    }
  }

  // Mark clip as completed even if thumbnail failed
  await prisma.videoClip.update({
    where: { id: clipId },
    data: {
      status: "COMPLETED",
      processingProgress: 100,
    },
  });

  // Check if all clips are done
  await checkJobCompletion(job.id);
}

async function checkJobCompletion(jobId: string) {
  const job = await prisma.videoClipJob.findUnique({
    where: { id: jobId },
    include: { clips: true },
  });

  if (!job) return;

  const allDone = job.clips.every(
    (clip) => clip.status === "COMPLETED" || clip.status === "FAILED"
  );

  if (allDone) {
    const successCount = job.clips.filter((c) => c.status === "COMPLETED").length;

    await prisma.videoClipJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        completedAt: new Date(),
      },
    });

    // Create notification
    const jobName = job.name || job.videoTitle || "your video";
    await prisma.notification.create({
      data: {
        userId: job.userId,
        type: "VIDEO_CLIP_COMPLETED",
        title: "Video clips ready!",
        message: `${successCount} clips have been generated from ${jobName}. Job ID: ${job.id}`,
      },
    });

    console.log(`[Video Clipper Webhook] Job ${jobId} completed with ${successCount} clips`);
  }
}

async function triggerThumbnailGeneration(
  jobId: string,
  clipId: string,
  videoUrl: string,
  userId: string
) {
  const webhookUrl = `${process.env.NEXTAUTH_URL}/api/video-clipper/webhook?jobId=${jobId}&step=thumbnail&clipId=${clipId}`;

  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "lucataco/frame-extractor:c02b3c1df64728476b1c21b0876235119e6ac08b0c9b8a99b82c5f0e0d42442d",
        input: {
          video: videoUrl,
          return_first_frame: true,
        },
        webhook: webhookUrl,
        webhook_events_filter: ["completed"],
      }),
    });

    if (!response.ok) {
      console.error(`[Video Clipper Webhook] Failed to trigger thumbnail: ${await response.text()}`);
    }
  } catch (error) {
    console.error(`[Video Clipper Webhook] Failed to trigger thumbnail:`, error);
  }
}

// ============================================================================
// SRT PARSING
// ============================================================================

function parseSRT(srtContent: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // Split into blocks (each SRT entry is separated by blank lines)
  const blocks = srtContent.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // Find the timestamp line (format: "00:00:00,000 --> 00:00:05,000")
    let timestampLine = "";
    let textLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timestampLine = lines[i];
        textLines = lines.slice(i + 1);
        break;
      }
    }

    if (!timestampLine) continue;

    // Parse timestamps
    const timeMatch = timestampLine.match(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/
    );

    if (timeMatch) {
      const start =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;

      const end =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;

      const text = textLines.join(" ").trim();

      if (text) {
        segments.push({ start, end, text });
      }
    }
  }

  return segments;
}

function parseTextToSegments(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const avgSentenceLength = 5; // seconds per sentence estimate
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

  return segments;
}

// ============================================================================
// CLIP PROCESSING TRIGGER
// ============================================================================

async function triggerClipProcessing(
  jobId: string,
  clipId: string,
  videoUrl: string,
  startTime: number,
  endTime: number
) {
  const webhookUrl = `${process.env.NEXTAUTH_URL}/api/video-clipper/webhook?jobId=${jobId}&step=clip&clipId=${clipId}`;

  // Format time for Replicate trim-video model (MM:SS)
  const formatTimeForReplicate = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "lucataco/trim-video:a58ed80215326cba0a80c77a11dd0d0968c567388228891b3c5c67de2a8d10cb",
      input: {
        video: videoUrl,
        start_time: formatTimeForReplicate(startTime),
        end_time: formatTimeForReplicate(endTime),
        output_format: "mp4",
        quality: "fast",
      },
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Replicate API error: ${await response.text()}`);
  }

  const prediction = await response.json();
  console.log(`[Video Clipper Webhook] Started clip processing: ${prediction.id}`);
  return prediction.id;
}

// ============================================================================
// JOB COMPLETION
// ============================================================================

async function completeJob(jobId: string, userId: string, jobName: string) {
  const job = await prisma.videoClipJob.findUnique({
    where: { id: jobId },
    include: { clips: true },
  });

  if (!job) return;

  const successCount = job.clips.filter((c) => c.status === "COMPLETED").length;

  await prisma.videoClipJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      progress: 100,
      completedAt: new Date(),
    },
  });

  // Create notification in database
  await prisma.notification.create({
    data: {
      userId,
      type: "VIDEO_CLIP_COMPLETED",
      title: "Video clips ready!",
      message: `${successCount} clip${successCount !== 1 ? "s" : ""} generated from "${jobName}"`,
      entityId: jobId,
      entityType: "video-clip-job",
      isRead: false,
    },
  });

  // Increment unread notification count
  await prisma.user.update({
    where: { id: userId },
    data: {
      unreadNotifications: { increment: 1 },
    },
  });

  // Broadcast real-time notification via Pusher
  await broadcastEvent(
    CHANNELS.NOTIFICATIONS(userId),
    "notification:new",
    {
      title: "Video clips ready!",
      message: `${successCount} clip${successCount !== 1 ? "s" : ""} generated from "${jobName}"`,
      type: "VIDEO_CLIP_COMPLETED",
      entityId: jobId,
      entityType: "video-clip-job",
    }
  );

  console.log(`[Video Clipper Webhook] Job ${jobId} completed with ${successCount} clips`);
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
      console.log("[Video Clipper Webhook] No GOOGLE_API_KEY, using fallback analysis");
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
    console.error("[Video Clipper Webhook] Gemini analysis error:", error);
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
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
