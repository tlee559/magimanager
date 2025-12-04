import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { PLATFORM_FORMATS, type PlatformFormat } from '@/lib/video-clipper/constants';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for resizing

// Using luma/reframe-video for aspect ratio transformations
const REFRAME_MODEL = 'luma/reframe-video:7a27619ccb64e4f1942e9a53e503142be08d505587313afa1da037b631a6760e';

// Map our format names to luma's aspect ratio options
const ASPECT_RATIO_MAP: Record<PlatformFormat, string> = {
  vertical: '9:16',
  square: '1:1',
  horizontal: '16:9',
};

export async function POST(req: NextRequest) {
  console.log('========================================');
  console.log('[VideoClipper] Resize request received');
  console.log('========================================');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('[VideoClipper] ERROR: REPLICATE_API_TOKEN not configured');
    return NextResponse.json(
      { error: 'Resize service not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    console.log('[VideoClipper] Resize request body:', JSON.stringify(body));

    const { clipUrl, targetFormat } = body as {
      clipUrl: string;
      targetFormat: PlatformFormat;
    };

    if (!clipUrl) {
      console.error('[VideoClipper] ERROR: Clip URL is missing');
      return NextResponse.json(
        { error: 'Clip URL is required' },
        { status: 400 }
      );
    }

    if (!targetFormat || !PLATFORM_FORMATS[targetFormat]) {
      console.error('[VideoClipper] ERROR: Invalid target format:', targetFormat);
      return NextResponse.json(
        { error: `Invalid target format. Valid formats: ${Object.keys(PLATFORM_FORMATS).join(', ')}` },
        { status: 400 }
      );
    }

    const config = PLATFORM_FORMATS[targetFormat];
    const aspectRatio = ASPECT_RATIO_MAP[targetFormat];

    console.log('[VideoClipper] Target format:', {
      format: targetFormat,
      aspectRatio,
      width: config.width,
      height: config.height,
    });

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Create prediction using luma/reframe-video
    console.log('[VideoClipper] Creating reframe prediction...');

    let prediction;
    try {
      prediction = await replicate.predictions.create({
        version: '7a27619ccb64e4f1942e9a53e503142be08d505587313afa1da037b631a6760e',
        input: {
          video_url: clipUrl,
          aspect_ratio: aspectRatio,
        },
      });
      console.log('[VideoClipper] Prediction created:', JSON.stringify(prediction, null, 2));
    } catch (createError) {
      console.error('[VideoClipper] ERROR creating prediction:', createError);
      return NextResponse.json(
        { error: `Failed to create resize prediction: ${createError instanceof Error ? createError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Wait for the prediction to complete
    console.log('[VideoClipper] Waiting for resize prediction to complete...');
    let finalPrediction = prediction;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
      attempts++;
      if (attempts > maxAttempts) {
        console.error('[VideoClipper] ERROR: Resize prediction timed out');
        return NextResponse.json(
          { error: 'Resize generation timed out' },
          { status: 500 }
        );
      }

      console.log(`[VideoClipper] Poll attempt ${attempts}, status: ${finalPrediction.status}`);

      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        finalPrediction = await replicate.predictions.get(prediction.id);
        console.log(`[VideoClipper] Prediction status: ${finalPrediction.status}`);
        if (finalPrediction.logs) {
          console.log('[VideoClipper] Prediction logs:', finalPrediction.logs.slice(-500));
        }
      } catch (pollError) {
        console.error('[VideoClipper] ERROR polling prediction:', pollError);
      }
    }

    console.log('[VideoClipper] Final prediction:', JSON.stringify(finalPrediction, null, 2));

    if (finalPrediction.status === 'failed') {
      console.error('[VideoClipper] ERROR: Resize prediction failed:', finalPrediction.error);
      return NextResponse.json(
        { error: `Resize failed: ${finalPrediction.error || 'Unknown error'}` },
        { status: 500 }
      );
    }

    if (finalPrediction.status === 'canceled') {
      console.error('[VideoClipper] ERROR: Resize prediction was canceled');
      return NextResponse.json(
        { error: 'Resize was canceled' },
        { status: 500 }
      );
    }

    const output = finalPrediction.output;
    console.log('[VideoClipper] Resize output:', output);

    // Get the resized video URL
    let resizedUrl: string | null = null;

    if (typeof output === 'string') {
      resizedUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      resizedUrl = output[0];
    } else if (output && typeof output === 'object') {
      if ('video' in output) {
        resizedUrl = (output as { video: string }).video;
      } else if ('output' in output) {
        resizedUrl = (output as { output: string }).output;
      } else if ('url' in output) {
        resizedUrl = (output as { url: string }).url;
      }
    }

    if (!resizedUrl) {
      console.error('[VideoClipper] ERROR: No resized URL in response');
      return NextResponse.json(
        { error: `Failed to resize video. Output: ${JSON.stringify(output)}` },
        { status: 500 }
      );
    }

    console.log('[VideoClipper] SUCCESS! Resized URL:', resizedUrl);

    // Download and re-upload to Vercel Blob for persistence
    console.log('[VideoClipper] Downloading resized video...');
    const resizedResponse = await fetch(resizedUrl);
    if (!resizedResponse.ok) {
      throw new Error(`Failed to download resized video: ${resizedResponse.status}`);
    }

    const resizedBuffer = await resizedResponse.arrayBuffer();
    console.log('[VideoClipper] Downloaded resized video size:', resizedBuffer.byteLength, 'bytes');

    const filename = `${targetFormat}-${Date.now()}.mp4`;

    console.log('[VideoClipper] Uploading to Vercel Blob as:', filename);
    const blob = await put(`video-clipper/resized/${filename}`, resizedBuffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    console.log('[VideoClipper] Resized video stored at:', blob.url);
    console.log('========================================');
    console.log('[VideoClipper] RESIZE COMPLETE');
    console.log('========================================');

    return NextResponse.json({
      success: true,
      resizedUrl: blob.url,
      width: config.width,
      height: config.height,
      format: targetFormat,
    });
  } catch (error) {
    console.error('========================================');
    console.error('[VideoClipper] UNHANDLED RESIZE ERROR:', error);
    console.error('========================================');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Resize failed' },
      { status: 500 }
    );
  }
}
