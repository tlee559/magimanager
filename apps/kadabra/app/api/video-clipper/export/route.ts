import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@magimanager/auth';
import { prisma } from '@magimanager/database';
import Replicate from 'replicate';
import { PLATFORM_FORMATS, type PlatformFormat } from '@/lib/video-clipper/constants';
import type { ExportKey, ClipExports } from '@/lib/video-clipper/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Models
const REFRAME_MODEL_VERSION = '7a27619ccb64e4f1942e9a53e503142be08d505587313afa1da037b631a6760e';
const CAPTION_MODEL_VERSION = '18a45ff0d95feb4449d192bbdc06b4a6df168fa33def76dfc51b78ae224b599b';

const ASPECT_RATIO_MAP: Record<PlatformFormat, string> = {
  vertical: '9:16',
  square: '1:1',
  horizontal: '16:9',
};

interface ExportProcessingState {
  status: 'processing' | 'completed' | 'failed';
  predictionId?: string;
  step?: 'resize' | 'caption';
  error?: string;
  result?: {
    url: string;
    width: number;
    height: number;
  };
}

// Extended ClipExports with processing states
interface ClipExportsWithProcessing extends ClipExports {
  _processing?: {
    [key in ExportKey]?: ExportProcessingState;
  };
}

/**
 * POST - Start async export generation
 * This saves the processing state to DB and returns immediately
 * Frontend polls GET /api/video-clipper/clips/[clipId] to check status
 */
export async function POST(req: NextRequest) {
  console.log('[VideoClipper] Async export request received');

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: 'Export service not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { clipId, exportKey, sourceClipUrl, transcript, startTime, endTime } = body as {
      clipId: string;
      exportKey: ExportKey;
      sourceClipUrl: string;
      transcript?: string;
      startTime?: number;
      endTime?: number;
    };

    if (!clipId || !exportKey || !sourceClipUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify clip belongs to user
    const clip = await prisma.videoClip.findFirst({
      where: { id: clipId },
      include: { job: { select: { userId: true } } },
    });

    if (!clip || clip.job.userId !== session.user.id) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    // Parse export key to get format and caption requirement
    const withCaptions = exportKey.endsWith('Captioned');
    const format = (withCaptions ? exportKey.replace('Captioned', '') : exportKey) as PlatformFormat;

    if (!PLATFORM_FORMATS[format]) {
      return NextResponse.json({ error: 'Invalid export format' }, { status: 400 });
    }

    // Get current exports state
    let currentExports: ClipExportsWithProcessing = {};
    if (clip.platformRecommendations) {
      currentExports = clip.platformRecommendations as unknown as ClipExportsWithProcessing;
    }

    // Initialize processing state
    const processing = currentExports._processing || {};
    processing[exportKey] = {
      status: 'processing',
      step: 'resize',
    };

    // Save processing state to DB
    await prisma.videoClip.update({
      where: { id: clipId },
      data: {
        platformRecommendations: JSON.parse(JSON.stringify({
          ...currentExports,
          _processing: processing,
        })),
      },
    });

    console.log('[VideoClipper] Export processing started:', { clipId, exportKey, format, withCaptions });

    // Start the async processing
    // This runs in the same request but we've already saved the "processing" state
    // so the frontend can poll for status
    processExportAsync(clipId, exportKey, format, withCaptions, sourceClipUrl, transcript, startTime, endTime).catch(err => {
      console.error('[VideoClipper] Background processing error:', err);
    });

    return NextResponse.json({
      success: true,
      clipId,
      exportKey,
      status: 'processing',
    });
  } catch (error) {
    console.error('[VideoClipper] Export start error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start export' },
      { status: 500 }
    );
  }
}

/**
 * Process export asynchronously
 * This function runs after we've returned the response to the client
 */
async function processExportAsync(
  clipId: string,
  exportKey: ExportKey,
  format: PlatformFormat,
  withCaptions: boolean,
  sourceClipUrl: string,
  transcript?: string,
  startTime?: number,
  endTime?: number
) {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const config = PLATFORM_FORMATS[format];
  const aspectRatio = ASPECT_RATIO_MAP[format];

  try {
    // Step 1: Resize the video
    console.log('[VideoClipper] Starting resize for:', { clipId, exportKey });

    const resizePrediction = await replicate.predictions.create({
      version: REFRAME_MODEL_VERSION,
      input: {
        video_url: sourceClipUrl,
        aspect_ratio: aspectRatio,
      },
    });

    // Update DB with prediction ID
    await updateProcessingState(clipId, exportKey, {
      status: 'processing',
      step: 'resize',
      predictionId: resizePrediction.id,
    });

    // Poll for resize completion
    let resizeResult = resizePrediction;
    while (resizeResult.status !== 'succeeded' && resizeResult.status !== 'failed' && resizeResult.status !== 'canceled') {
      await new Promise(resolve => setTimeout(resolve, 3000));
      resizeResult = await replicate.predictions.get(resizePrediction.id);
      console.log('[VideoClipper] Resize status:', resizeResult.status);
    }

    if (resizeResult.status !== 'succeeded') {
      throw new Error(`Resize failed: ${resizeResult.error || 'Unknown error'}`);
    }

    // Get resized URL
    const resizedUrl = extractOutputUrl(resizeResult.output);
    if (!resizedUrl) {
      throw new Error('No resized URL in output');
    }

    // Download and upload to Vercel Blob
    const { put } = await import('@vercel/blob');
    const resizedResponse = await fetch(resizedUrl);
    const resizedBuffer = await resizedResponse.arrayBuffer();
    const resizedBlob = await put(`video-clipper/resized/${format}-${Date.now()}.mp4`, resizedBuffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    console.log('[VideoClipper] Resize complete:', resizedBlob.url);

    // If no captions needed, we're done
    if (!withCaptions) {
      await updateProcessingState(clipId, exportKey, {
        status: 'completed',
        result: {
          url: resizedBlob.url,
          width: config.width,
          height: config.height,
        },
      });

      // Also save the export result directly
      await saveExportResult(clipId, exportKey, {
        url: resizedBlob.url,
        width: config.width,
        height: config.height,
      });

      console.log('[VideoClipper] Export complete (no captions):', exportKey);
      return;
    }

    // Step 2: Add captions
    console.log('[VideoClipper] Starting caption for:', { clipId, exportKey });

    await updateProcessingState(clipId, exportKey, {
      status: 'processing',
      step: 'caption',
    });

    const captionPrediction = await replicate.predictions.create({
      version: CAPTION_MODEL_VERSION,
      input: {
        video_file_input: resizedBlob.url,
        output_video: true,
        font: 'Poppins/Poppins-ExtraBold.ttf',
        color: 'white',
        highlight_color: 'yellow',
        fontsize: 7,
        stroke_color: 'black',
        stroke_width: 2.6,
        right_to_left: false,
        subs_position: 'bottom75',
        MaxChars: 15,
        opacity: 0,
      },
    });

    await updateProcessingState(clipId, exportKey, {
      status: 'processing',
      step: 'caption',
      predictionId: captionPrediction.id,
    });

    // Poll for caption completion
    let captionResult = captionPrediction;
    while (captionResult.status !== 'succeeded' && captionResult.status !== 'failed' && captionResult.status !== 'canceled') {
      await new Promise(resolve => setTimeout(resolve, 3000));
      captionResult = await replicate.predictions.get(captionPrediction.id);
      console.log('[VideoClipper] Caption status:', captionResult.status);
    }

    if (captionResult.status !== 'succeeded') {
      throw new Error(`Caption failed: ${captionResult.error || 'Unknown error'}`);
    }

    // Get captioned URL
    const captionedUrl = extractOutputUrl(captionResult.output);
    if (!captionedUrl) {
      throw new Error('No captioned URL in output');
    }

    // Download and upload to Vercel Blob
    const captionedResponse = await fetch(captionedUrl);
    const captionedBuffer = await captionedResponse.arrayBuffer();
    const captionedBlob = await put(`video-clipper/captioned/${format}-${Date.now()}.mp4`, captionedBuffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    console.log('[VideoClipper] Caption complete:', captionedBlob.url);

    // Save final result
    await updateProcessingState(clipId, exportKey, {
      status: 'completed',
      result: {
        url: captionedBlob.url,
        width: config.width,
        height: config.height,
      },
    });

    await saveExportResult(clipId, exportKey, {
      url: captionedBlob.url,
      width: config.width,
      height: config.height,
    });

    console.log('[VideoClipper] Export complete (with captions):', exportKey);
  } catch (error) {
    console.error('[VideoClipper] Export processing error:', error);

    await updateProcessingState(clipId, exportKey, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function updateProcessingState(clipId: string, exportKey: ExportKey, state: ExportProcessingState) {
  const clip = await prisma.videoClip.findUnique({ where: { id: clipId } });
  if (!clip) return;

  const currentExports: ClipExportsWithProcessing = (clip.platformRecommendations as unknown as ClipExportsWithProcessing) || {};
  const processing = currentExports._processing || {};
  processing[exportKey] = state;

  await prisma.videoClip.update({
    where: { id: clipId },
    data: {
      platformRecommendations: JSON.parse(JSON.stringify({
        ...currentExports,
        _processing: processing,
      })),
    },
  });
}

async function saveExportResult(clipId: string, exportKey: ExportKey, result: { url: string; width: number; height: number }) {
  const clip = await prisma.videoClip.findUnique({ where: { id: clipId } });
  if (!clip) return;

  const currentExports: ClipExportsWithProcessing = (clip.platformRecommendations as unknown as ClipExportsWithProcessing) || {};

  // Add the export result
  const updatedExports = {
    ...currentExports,
    [exportKey]: result,
  };

  await prisma.videoClip.update({
    where: { id: clipId },
    data: {
      platformRecommendations: JSON.parse(JSON.stringify(updatedExports)),
    },
  });
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') {
    return output;
  }
  if (Array.isArray(output) && output.length > 0) {
    return output[0];
  }
  if (output && typeof output === 'object') {
    if ('video' in output) return (output as { video: string }).video;
    if ('output' in output) return (output as { output: string }).output;
    if ('url' in output) return (output as { url: string }).url;
  }
  return null;
}
