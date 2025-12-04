import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for clipping

// Video trimming model - lucataco/trim-video
const TRIM_MODEL = 'lucataco/trim-video:a58ed80215326cba0a80c77a11dd0d0968c567388228891b3c5c67de2a8d10cb';

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

    // Calculate duration
    const clipDuration = endTime - startTime;

    // Ensure minimum clip duration of 5 seconds
    if (clipDuration < 5) {
      return NextResponse.json(
        { error: 'Clip must be at least 5 seconds long' },
        { status: 400 }
      );
    }

    // Format time as HH:MM:SS for the model
    const formatTimeForModel = (seconds: number): string => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formattedStart = formatTimeForModel(startTime);
    const formattedDuration = formatTimeForModel(clipDuration);

    console.log('[VideoClipper] Clipping video:', {
      videoUrl: videoUrl.slice(0, 50) + '...',
      startTime: formattedStart,
      duration: formattedDuration,
      durationSeconds: clipDuration,
    });

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Run trim-video model - use duration instead of end_time for better compatibility
    console.log('[VideoClipper] Calling trim-video model...');
    let output;
    try {
      output = await replicate.run(TRIM_MODEL, {
        input: {
          video: videoUrl,
          start_time: formattedStart,
          duration: formattedDuration,
          quality: 'medium',
          output_format: 'mp4',
        },
      });
    } catch (replicateError) {
      console.error('[VideoClipper] Replicate API error:', replicateError);
      const errorMessage = replicateError instanceof Error ? replicateError.message : 'Replicate API failed';
      return NextResponse.json(
        { error: `Clip generation failed: ${errorMessage}` },
        { status: 500 }
      );
    }

    console.log('[VideoClipper] Replicate response type:', typeof output);
    console.log('[VideoClipper] Replicate response:', JSON.stringify(output));

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
      console.error('[VideoClipper] No clip URL in response. Output was:', JSON.stringify(output));
      return NextResponse.json(
        { error: `Failed to generate clip. Unexpected response format: ${JSON.stringify(output)}` },
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
