import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for clipping

// FFmpeg-based video trimming model
const TRIM_MODEL = 'fofr/video-splitter:e06fe0d7d7f14c14e36d84a11c68c67fa6b2e819e8a6d7168824d97c5d7c6d0c';

export async function POST(req: NextRequest) {
  console.log('[VideoClipper] Clip request received');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('[VideoClipper] REPLICATE_API_TOKEN not configured');
    return NextResponse.json(
      { error: 'Clipping service not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { videoUrl, startTime, endTime } = body as {
      videoUrl: string;
      startTime: number;
      endTime: number;
    };

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    if (startTime === undefined || endTime === undefined) {
      return NextResponse.json(
        { error: 'Start and end times are required' },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: 'End time must be greater than start time' },
        { status: 400 }
      );
    }

    console.log('[VideoClipper] Clipping video:', {
      videoUrl: videoUrl.slice(0, 50) + '...',
      startTime,
      endTime,
      duration: endTime - startTime,
    });

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Run video splitter model
    console.log('[VideoClipper] Calling video-splitter model...');
    const output = await replicate.run(TRIM_MODEL, {
      input: {
        video: videoUrl,
        start_time: startTime,
        end_time: endTime,
      },
    });

    console.log('[VideoClipper] Replicate response:', output);

    // The model returns a URL to the clipped video
    let clipUrl: string | null = null;

    if (typeof output === 'string') {
      clipUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      clipUrl = output[0];
    } else if (output && typeof output === 'object' && 'output' in output) {
      clipUrl = (output as { output: string }).output;
    }

    if (!clipUrl) {
      console.error('[VideoClipper] No clip URL in response:', output);
      return NextResponse.json(
        { error: 'Failed to generate clip' },
        { status: 500 }
      );
    }

    console.log('[VideoClipper] Clip generated:', clipUrl);

    // Download the clip and re-upload to Vercel Blob for persistence
    console.log('[VideoClipper] Downloading clip for storage...');
    const clipResponse = await fetch(clipUrl);
    if (!clipResponse.ok) {
      throw new Error('Failed to download generated clip');
    }

    const clipBuffer = await clipResponse.arrayBuffer();
    const filename = `clip-${Date.now()}-${Math.round(startTime)}-${Math.round(endTime)}.mp4`;

    console.log('[VideoClipper] Uploading to Vercel Blob...');
    const blob = await put(`video-clipper/clips/${filename}`, clipBuffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    console.log('[VideoClipper] Clip stored:', blob.url);

    return NextResponse.json({
      success: true,
      clip: {
        url: blob.url,
        startTime,
        endTime,
        duration: endTime - startTime,
      },
    });
  } catch (error) {
    console.error('[VideoClipper] Clip error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Clipping failed' },
      { status: 500 }
    );
  }
}
