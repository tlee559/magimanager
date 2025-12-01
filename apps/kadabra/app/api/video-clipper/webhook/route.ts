import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@magimanager/database";
import { put } from "@vercel/blob";

// Configure route for webhook processing
export const runtime = "nodejs";
export const maxDuration = 300;

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

  // Extract transcript from output
  let transcriptText = "";
  if (typeof output === "string") {
    transcriptText = output;
  } else if (output && typeof output === "object" && "text" in output) {
    transcriptText = (output as { text: string }).text;
  }

  if (!transcriptText) {
    await prisma.videoClipJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        processingError: "Transcription returned empty result",
      },
    });
    return;
  }

  // Update job with transcript and move to ANALYZING status
  await prisma.videoClipJob.update({
    where: { id: job.id },
    data: {
      status: "ANALYZING",
      progress: 40,
    },
  });

  // TODO: Trigger AI analysis step
  // For now, we'll need to handle this in the main job processing
  console.log(`[Video Clipper Webhook] Job ${job.id} ready for AI analysis`);
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
