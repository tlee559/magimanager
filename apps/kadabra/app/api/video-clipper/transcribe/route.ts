import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for transcription

// Use openai/whisper which handles video files directly
const WHISPER_MODEL = 'openai/whisper:4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperOutput {
  transcription: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
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

    // Run Whisper model (openai/whisper handles video files)
    console.log('[VideoClipper] Calling Whisper model...');
    const output = await replicate.run(WHISPER_MODEL, {
      input: {
        audio: videoUrl,
        model: 'large-v3',
        language: 'en',
        translate: false,
        transcription: 'srt',
      },
    }) as WhisperOutput;

    console.log('[VideoClipper] Whisper response received:', JSON.stringify(output).slice(0, 500));

    // Parse the output into segments
    const segments: TranscriptSegment[] = [];
    let fullText = '';

    // Handle different output formats
    if (typeof output === 'object' && output !== null) {
      // If segments array exists, use it
      if (output.segments && Array.isArray(output.segments)) {
        for (const seg of output.segments) {
          segments.push({
            start: seg.start,
            end: seg.end,
            text: seg.text.trim(),
          });
        }
        fullText = output.transcription || segments.map(s => s.text).join(' ');
      }
      // If transcription is a string (SRT format), parse it
      else if (output.transcription && typeof output.transcription === 'string') {
        fullText = output.transcription;
        // Parse SRT format: "1\n00:00:00,000 --> 00:00:02,000\nText here\n\n2\n..."
        const srtBlocks = output.transcription.split(/\n\n+/);
        for (const block of srtBlocks) {
          const lines = block.trim().split('\n');
          if (lines.length >= 3) {
            // Parse timestamp line: "00:00:00,000 --> 00:00:02,000"
            const timeLine = lines[1];
            const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
            if (timeMatch) {
              const startSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
              const endSec = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
              const text = lines.slice(2).join(' ').trim();
              if (text) {
                segments.push({ start: startSec, end: endSec, text });
              }
            }
          }
        }
      }
    }

    console.log('[VideoClipper] Parsed segments:', segments.length);

    return NextResponse.json({
      success: true,
      transcript: {
        fullText,
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
