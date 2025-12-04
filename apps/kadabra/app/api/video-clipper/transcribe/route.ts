import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for transcription

const WHISPER_MODEL = 'vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperOutput {
  text: string;
  chunks?: Array<{
    timestamp: [number, number];
    text: string;
  }>;
}

export async function POST(req: NextRequest) {
  console.log('[VideoClipper] Transcribe request received');

  // Check for Replicate API token
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('[VideoClipper] REPLICATE_API_TOKEN not configured');
    return NextResponse.json(
      { error: 'Transcription service not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { videoUrl } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    console.log('[VideoClipper] Starting transcription for:', videoUrl);

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Run Whisper model
    console.log('[VideoClipper] Calling Whisper model...');
    const output = await replicate.run(WHISPER_MODEL, {
      input: {
        audio: videoUrl,
        task: 'transcribe',
        language: 'english',
        timestamp: 'chunk',
        batch_size: 64,
      },
    }) as WhisperOutput;

    console.log('[VideoClipper] Whisper response received');

    // Parse the output into segments
    const segments: TranscriptSegment[] = [];

    if (output.chunks && Array.isArray(output.chunks)) {
      for (const chunk of output.chunks) {
        if (chunk.timestamp && chunk.text) {
          segments.push({
            start: chunk.timestamp[0],
            end: chunk.timestamp[1],
            text: chunk.text.trim(),
          });
        }
      }
    }

    console.log('[VideoClipper] Parsed segments:', segments.length);

    return NextResponse.json({
      success: true,
      transcript: {
        fullText: output.text || '',
        segments,
      },
    });
  } catch (error) {
    console.error('[VideoClipper] Transcription error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}
