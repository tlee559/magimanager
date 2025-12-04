import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for captioning

// Video captioning model - auto-generates captions from audio and burns them in
const CAPTION_MODEL = 'fictions-ai/autocaption:18a45ff0d95feb4449d192bbdc06b4a6df168fa33def76dfc51b78ae224b599b';

interface CaptionStyle {
  fontSize?: 'small' | 'medium' | 'large';
  position?: 'bottom' | 'center' | 'top';
  fontColor?: string;
  backgroundColor?: string;
}

export async function POST(req: NextRequest) {
  console.log('========================================');
  console.log('[VideoClipper] Caption request received');
  console.log('========================================');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('[VideoClipper] ERROR: REPLICATE_API_TOKEN not configured');
    return NextResponse.json(
      { error: 'Captioning service not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    console.log('[VideoClipper] Caption request body:', JSON.stringify(body));

    const { clipUrl, transcript, startTime, endTime, style } = body as {
      clipUrl: string;
      transcript: string;
      startTime: number;
      endTime: number;
      style?: CaptionStyle;
    };

    if (!clipUrl) {
      console.error('[VideoClipper] ERROR: Clip URL is missing');
      return NextResponse.json(
        { error: 'Clip URL is required' },
        { status: 400 }
      );
    }

    // Note: transcript is optional - autocaption generates its own from audio
    const clipDuration = endTime - startTime;
    console.log('[VideoClipper] Clip duration:', clipDuration, 'seconds');
    console.log('[VideoClipper] Transcript provided:', transcript ? `${transcript.length} chars` : 'No (will auto-generate)');

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Map style options to model parameters
    const fontSizeMap = {
      small: 6,
      medium: 8,
      large: 10,
    };

    const highlightColor = style?.fontColor || '#FFE135'; // Yellow default

    // Prepare input for the autocaption model
    const modelInput = {
      video_file: clipUrl,
      font: 'Poppins/Poppins-ExtraBold.ttf',
      color: 'white',
      highlight_color: highlightColor,
      font_size: fontSizeMap[style?.fontSize || 'medium'],
      stroke_color: 'black',
      stroke_width: 2.6,
      right_to_left: false,
      subs_position: style?.position || 'bottom',
    };

    console.log('[VideoClipper] Model input:', JSON.stringify(modelInput, null, 2));
    console.log('[VideoClipper] Using model:', CAPTION_MODEL);

    // Create prediction
    console.log('[VideoClipper] Creating caption prediction...');

    let prediction;
    try {
      prediction = await replicate.predictions.create({
        version: '18a45ff0d95feb4449d192bbdc06b4a6df168fa33def76dfc51b78ae224b599b',
        input: modelInput,
      });
      console.log('[VideoClipper] Prediction created:', JSON.stringify(prediction, null, 2));
    } catch (createError) {
      console.error('[VideoClipper] ERROR creating prediction:', createError);
      return NextResponse.json(
        { error: `Failed to create caption prediction: ${createError instanceof Error ? createError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Wait for the prediction to complete
    console.log('[VideoClipper] Waiting for caption prediction to complete...');
    let finalPrediction = prediction;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
      attempts++;
      if (attempts > maxAttempts) {
        console.error('[VideoClipper] ERROR: Caption prediction timed out');
        return NextResponse.json(
          { error: 'Caption generation timed out' },
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
      console.error('[VideoClipper] ERROR: Caption prediction failed:', finalPrediction.error);
      return NextResponse.json(
        { error: `Caption generation failed: ${finalPrediction.error || 'Unknown error'}` },
        { status: 500 }
      );
    }

    if (finalPrediction.status === 'canceled') {
      console.error('[VideoClipper] ERROR: Caption prediction was canceled');
      return NextResponse.json(
        { error: 'Caption generation was canceled' },
        { status: 500 }
      );
    }

    const output = finalPrediction.output;
    console.log('[VideoClipper] Caption output:', output);

    // Get the captioned video URL
    let captionedUrl: string | null = null;

    if (typeof output === 'string') {
      captionedUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      captionedUrl = output[0];
    } else if (output && typeof output === 'object') {
      if ('output' in output) {
        captionedUrl = (output as { output: string }).output;
      } else if ('url' in output) {
        captionedUrl = (output as { url: string }).url;
      }
    }

    if (!captionedUrl) {
      console.error('[VideoClipper] ERROR: No captioned URL in response');
      return NextResponse.json(
        { error: `Failed to generate captions. Output: ${JSON.stringify(output)}` },
        { status: 500 }
      );
    }

    console.log('[VideoClipper] SUCCESS! Captioned URL:', captionedUrl);

    // Download and re-upload to Vercel Blob for persistence
    console.log('[VideoClipper] Downloading captioned video...');
    const captionedResponse = await fetch(captionedUrl);
    if (!captionedResponse.ok) {
      throw new Error(`Failed to download captioned video: ${captionedResponse.status}`);
    }

    const captionedBuffer = await captionedResponse.arrayBuffer();
    console.log('[VideoClipper] Downloaded captioned video size:', captionedBuffer.byteLength, 'bytes');

    const filename = `captioned-${Date.now()}.mp4`;

    console.log('[VideoClipper] Uploading to Vercel Blob as:', filename);
    const blob = await put(`video-clipper/captioned/${filename}`, captionedBuffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    console.log('[VideoClipper] Captioned video stored at:', blob.url);
    console.log('========================================');
    console.log('[VideoClipper] CAPTION GENERATION COMPLETE');
    console.log('========================================');

    return NextResponse.json({
      success: true,
      captionedClipUrl: blob.url,
    });
  } catch (error) {
    console.error('========================================');
    console.error('[VideoClipper] UNHANDLED CAPTION ERROR:', error);
    console.error('========================================');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Captioning failed' },
      { status: 500 }
    );
  }
}

// Generate SRT format from transcript text
function generateSRT(transcript: string, duration: number): string {
  const words = transcript.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';

  const wordsPerSegment = 8; // ~8 words per caption segment
  const segments: string[] = [];
  const segmentDuration = duration / Math.ceil(words.length / wordsPerSegment);

  let currentTime = 0;
  let segmentIndex = 1;

  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const segmentWords = words.slice(i, i + wordsPerSegment);
    const text = segmentWords.join(' ');

    const startTime = currentTime;
    const endTime = Math.min(currentTime + segmentDuration, duration);

    segments.push(
      `${segmentIndex}\n${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n${text}`
    );

    currentTime = endTime;
    segmentIndex++;
  }

  return segments.join('\n\n');
}

// Format time as HH:MM:SS,mmm for SRT
function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}
