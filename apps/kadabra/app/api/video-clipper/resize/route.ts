import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { PLATFORM_FORMATS, type PlatformFormat } from '@/lib/video-clipper/constants';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for resizing

// Using magpai-app/cog-ffmpeg for video transformations
const FFMPEG_MODEL = 'magpai-app/cog-ffmpeg:efd0b79b577bcd58ae7d035bce9de5c4659a59e09faafac4d426d61c04249251';

type CropMode = 'pad' | 'crop';

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

    const { clipUrl, targetFormat, cropMode = 'pad' } = body as {
      clipUrl: string;
      targetFormat: PlatformFormat;
      cropMode?: CropMode;
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
    console.log('[VideoClipper] Target format:', {
      format: targetFormat,
      width: config.width,
      height: config.height,
      aspectRatio: config.aspectRatio,
      cropMode,
    });

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Build FFmpeg command based on crop mode
    let vfCommand: string;
    if (cropMode === 'crop') {
      // Crop mode: scale up and center crop to fit exactly
      vfCommand = `scale=${config.width}:${config.height}:force_original_aspect_ratio=increase,crop=${config.width}:${config.height}`;
    } else {
      // Pad mode (default): scale down and add black bars
      vfCommand = `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2:black`;
    }

    // FFmpeg command for the magpai-app/cog-ffmpeg model
    // Note: this model uses 'file1' as input and expects full ffmpeg command with input/output references
    const ffmpegCommand = `ffmpeg -i /tmp/file1.mp4 -vf "${vfCommand}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k /tmp/output1.mp4`;

    console.log('[VideoClipper] FFmpeg command:', ffmpegCommand);

    // Create prediction
    console.log('[VideoClipper] Creating resize prediction...');

    let prediction;
    try {
      prediction = await replicate.predictions.create({
        version: 'efd0b79b577bcd58ae7d035bce9de5c4659a59e09faafac4d426d61c04249251',
        input: {
          file1: clipUrl,
          command: ffmpegCommand,
          output1: 'resized.mp4',
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

    // Get the resized video URL - magpai-app/cog-ffmpeg returns { files: [url1, url2, ...] }
    let resizedUrl: string | null = null;

    if (typeof output === 'string') {
      resizedUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      resizedUrl = output[0];
    } else if (output && typeof output === 'object') {
      // Handle { files: [...] } format from magpai-app/cog-ffmpeg
      if ('files' in output && Array.isArray((output as { files: string[] }).files)) {
        const files = (output as { files: string[] }).files;
        if (files.length > 0) {
          resizedUrl = files[0];
        }
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

    const filename = `${targetFormat}-${cropMode}-${Date.now()}.mp4`;

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
      cropMode,
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
