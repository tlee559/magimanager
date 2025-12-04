import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for clipping

// Video trimming model - lucataco/trim-video
const TRIM_MODEL = 'lucataco/trim-video:a58ed80215326cba0a80c77a11dd0d0968c567388228891b3c5c67de2a8d10cb';

export async function POST(req: NextRequest) {
  console.log('========================================');
  console.log('[VideoClipper] Clip request received');
  console.log('========================================');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('[VideoClipper] ERROR: REPLICATE_API_TOKEN not configured');
    return NextResponse.json(
      { error: 'Clipping service not configured' },
      { status: 500 }
    );
  }

  console.log('[VideoClipper] REPLICATE_API_TOKEN is set');

  try {
    const body = await req.json();
    console.log('[VideoClipper] Request body:', JSON.stringify(body));

    const { videoUrl, startTime, endTime } = body as {
      videoUrl: string;
      startTime: number;
      endTime: number;
    };

    console.log('[VideoClipper] Parsed params:', {
      videoUrl: videoUrl ? videoUrl.substring(0, 80) + '...' : 'MISSING',
      startTime,
      endTime,
    });

    if (!videoUrl) {
      console.error('[VideoClipper] ERROR: Video URL is missing');
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    if (startTime === undefined || endTime === undefined) {
      console.error('[VideoClipper] ERROR: Start/end times missing');
      return NextResponse.json(
        { error: 'Start and end times are required' },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      console.error('[VideoClipper] ERROR: End time must be greater than start time');
      return NextResponse.json(
        { error: 'End time must be greater than start time' },
        { status: 400 }
      );
    }

    // Calculate duration
    const clipDuration = endTime - startTime;
    console.log('[VideoClipper] Clip duration:', clipDuration, 'seconds');

    // Ensure minimum clip duration of 5 seconds
    if (clipDuration < 5) {
      console.error('[VideoClipper] ERROR: Clip duration too short:', clipDuration);
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

    console.log('[VideoClipper] Formatted times:', {
      start: formattedStart,
      duration: formattedDuration,
    });

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Prepare input for the model
    const modelInput = {
      video: videoUrl,
      start_time: formattedStart,
      duration: formattedDuration,
      quality: 'fast',
      output_format: 'mp4',
    };

    console.log('[VideoClipper] Model input:', JSON.stringify(modelInput, null, 2));
    console.log('[VideoClipper] Using model:', TRIM_MODEL);

    // Use predictions API for more detailed response
    console.log('[VideoClipper] Creating prediction...');

    let prediction;
    try {
      prediction = await replicate.predictions.create({
        version: 'a58ed80215326cba0a80c77a11dd0d0968c567388228891b3c5c67de2a8d10cb',
        input: modelInput,
      });
      console.log('[VideoClipper] Prediction created:', JSON.stringify(prediction, null, 2));
    } catch (createError) {
      console.error('[VideoClipper] ERROR creating prediction:', createError);
      return NextResponse.json(
        { error: `Failed to create prediction: ${createError instanceof Error ? createError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Wait for the prediction to complete
    console.log('[VideoClipper] Waiting for prediction to complete...');
    let finalPrediction = prediction;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)

    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
      attempts++;
      if (attempts > maxAttempts) {
        console.error('[VideoClipper] ERROR: Prediction timed out after', maxAttempts * 5, 'seconds');
        return NextResponse.json(
          { error: 'Clip generation timed out' },
          { status: 500 }
        );
      }

      console.log(`[VideoClipper] Poll attempt ${attempts}, status: ${finalPrediction.status}`);

      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        finalPrediction = await replicate.predictions.get(prediction.id);
        console.log(`[VideoClipper] Prediction status: ${finalPrediction.status}`);
        if (finalPrediction.logs) {
          console.log('[VideoClipper] Prediction logs:', finalPrediction.logs);
        }
      } catch (pollError) {
        console.error('[VideoClipper] ERROR polling prediction:', pollError);
      }
    }

    console.log('[VideoClipper] Final prediction:', JSON.stringify(finalPrediction, null, 2));

    if (finalPrediction.status === 'failed') {
      console.error('[VideoClipper] ERROR: Prediction failed:', finalPrediction.error);
      return NextResponse.json(
        { error: `Clip generation failed: ${finalPrediction.error || 'Unknown error'}` },
        { status: 500 }
      );
    }

    if (finalPrediction.status === 'canceled') {
      console.error('[VideoClipper] ERROR: Prediction was canceled');
      return NextResponse.json(
        { error: 'Clip generation was canceled' },
        { status: 500 }
      );
    }

    const output = finalPrediction.output;
    console.log('[VideoClipper] Prediction output:', output);
    console.log('[VideoClipper] Output type:', typeof output);

    // The model returns a URL to the clipped video
    let clipUrl: string | null = null;

    if (typeof output === 'string') {
      clipUrl = output;
      console.log('[VideoClipper] Output is string URL');
    } else if (Array.isArray(output) && output.length > 0) {
      clipUrl = output[0];
      console.log('[VideoClipper] Output is array, using first element');
    } else if (output && typeof output === 'object') {
      console.log('[VideoClipper] Output is object with keys:', Object.keys(output));
      if ('output' in output) {
        clipUrl = (output as { output: string }).output;
      } else if ('url' in output) {
        clipUrl = (output as { url: string }).url;
      }
    }

    if (!clipUrl) {
      console.error('[VideoClipper] ERROR: No clip URL in response');
      console.error('[VideoClipper] Full output:', JSON.stringify(output));
      return NextResponse.json(
        { error: `Failed to generate clip. Output: ${JSON.stringify(output)}` },
        { status: 500 }
      );
    }

    console.log('[VideoClipper] SUCCESS! Clip URL:', clipUrl);

    // Download the clip and re-upload to Vercel Blob for persistence
    console.log('[VideoClipper] Downloading clip from Replicate...');
    const clipResponse = await fetch(clipUrl);
    if (!clipResponse.ok) {
      console.error('[VideoClipper] ERROR downloading clip:', clipResponse.status, clipResponse.statusText);
      throw new Error(`Failed to download generated clip: ${clipResponse.status}`);
    }

    const clipBuffer = await clipResponse.arrayBuffer();
    console.log('[VideoClipper] Downloaded clip size:', clipBuffer.byteLength, 'bytes');

    const filename = `clip-${Date.now()}-${Math.round(startTime)}-${Math.round(endTime)}.mp4`;

    console.log('[VideoClipper] Uploading to Vercel Blob as:', filename);
    const blob = await put(`video-clipper/clips/${filename}`, clipBuffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    console.log('[VideoClipper] Clip stored at:', blob.url);
    console.log('========================================');
    console.log('[VideoClipper] CLIP GENERATION COMPLETE');
    console.log('========================================');

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
    console.error('========================================');
    console.error('[VideoClipper] UNHANDLED ERROR:', error);
    console.error('========================================');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Clipping failed' },
      { status: 500 }
    );
  }
}
