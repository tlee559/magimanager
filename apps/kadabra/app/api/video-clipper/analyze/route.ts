import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface ClipSuggestion {
  startTime: number;
  endTime: number;
  type: 'hook' | 'testimonial' | 'benefit' | 'cta' | 'problem' | 'solution';
  reason: string;
  transcript: string;
}

export async function POST(req: NextRequest) {
  console.log('[VideoClipper] Analyze request received');

  if (!process.env.GOOGLE_API_KEY) {
    console.error('[VideoClipper] GOOGLE_API_KEY not configured');
    return NextResponse.json(
      { error: 'AI service not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { segments, videoDuration } = body as {
      segments: TranscriptSegment[];
      videoDuration: number;
    };

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'Transcript segments are required' },
        { status: 400 }
      );
    }

    console.log('[VideoClipper] Analyzing', segments.length, 'segments');

    // Format transcript for AI
    const formattedTranscript = segments
      .map(s => `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`)
      .join('\n');

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an expert video editor specializing in creating short-form ad content and viral social media clips. Analyze this video transcript and identify 3-5 compelling moments that would make great ad clips or viral content (15-60 seconds each).

VIDEO DURATION: ${Math.round(videoDuration)} seconds

TRANSCRIPT:
${formattedTranscript}

For each suggested clip, identify:
1. The exact start and end timestamps (must be within the video duration)
2. The type of moment:
   - "hook" - Attention-grabbing opening statement
   - "testimonial" - Customer story or endorsement
   - "benefit" - Clear product/service benefit
   - "cta" - Call to action or compelling close
   - "problem" - Pain point identification
   - "solution" - Problem resolution moment
   - "viral" - Highly shareable moment with emotional impact, humor, surprise, controversy, or relatability that could go viral on social media
3. Why this moment would work well as an ad clip or viral content

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "suggestions": [
    {
      "startTime": 0,
      "endTime": 15,
      "type": "hook",
      "reason": "Strong opening that grabs attention",
      "transcript": "The exact text from this segment"
    }
  ]
}`;

    console.log('[VideoClipper] Calling Gemini...');
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    console.log('[VideoClipper] Gemini response:', response.slice(0, 500));

    // Parse JSON response
    let suggestions: ClipSuggestion[] = [];
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanJson = response.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7);
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      suggestions = parsed.suggestions || [];

      // Validate and clamp timestamps
      suggestions = suggestions.map(s => ({
        ...s,
        startTime: Math.max(0, Math.min(s.startTime, videoDuration)),
        endTime: Math.max(0, Math.min(s.endTime, videoDuration)),
      })).filter(s => s.endTime > s.startTime);

    } catch (parseError) {
      console.error('[VideoClipper] Failed to parse Gemini response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    console.log('[VideoClipper] Found', suggestions.length, 'clip suggestions');

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('[VideoClipper] Analyze error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
