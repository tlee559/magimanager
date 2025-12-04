import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface MarketingContext {
  product: string;
  audience: string;
  goal: string;
  tone: 'professional' | 'casual' | 'energetic' | 'emotional' | 'educational';
}

interface ClipScores {
  hookStrength: number;
  emotionalImpact: number;
  conversionPotential: number;
  viralPotential: number;
  overallScore: number;
}

interface PlatformRecommendation {
  platform: string;
  suggestedCaption: string;
  hashtags: string[];
  whyThisPlatform: string;
}

interface ClipSuggestion {
  startTime: number;
  endTime: number;
  type: 'hook' | 'testimonial' | 'benefit' | 'cta' | 'problem' | 'solution' | 'viral';
  reason: string;
  transcript: string;
  scores: ClipScores;
  platformRecommendations: PlatformRecommendation[];
  psychologicalTrigger: string;
  suggestedCTA: string;
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
    const { segments, videoDuration, targetClipDuration = 30, marketingContext } = body as {
      segments: TranscriptSegment[];
      videoDuration: number;
      targetClipDuration?: number;
      marketingContext?: MarketingContext;
    };

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'Transcript segments are required' },
        { status: 400 }
      );
    }

    // Calculate clip duration range based on target
    const minDuration = Math.max(5, Math.floor(targetClipDuration * 0.7));
    const maxDuration = Math.ceil(targetClipDuration * 1.3);

    console.log('[VideoClipper] Analyzing', segments.length, 'segments, target duration:', targetClipDuration, 'seconds');
    console.log('[VideoClipper] Marketing context:', marketingContext);

    // Format transcript for AI
    const formattedTranscript = segments
      .map(s => `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`)
      .join('\n');

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build marketing context section if provided
    const marketingSection = marketingContext ? `
MARKETING CONTEXT:
- Product/Service: ${marketingContext.product || 'Not specified'}
- Target Audience: ${marketingContext.audience || 'Not specified'}
- Marketing Goal: ${marketingContext.goal || 'Not specified'}
- Desired Tone: ${marketingContext.tone || 'Not specified'}

Use this context to find moments that will resonate with the target audience and achieve the marketing goal.
` : '';

    const prompt = `You are an elite performance marketer and video content strategist who has generated billions in ad revenue. Your specialty is identifying psychological triggers and high-converting moments in video content.

${marketingSection}

CRITICAL DURATION REQUIREMENT:
- Target clip duration: approximately ${targetClipDuration} seconds
- Each clip MUST be between ${minDuration}-${maxDuration} seconds long
- DO NOT suggest clips outside this range

VIDEO DURATION: ${Math.round(videoDuration)} seconds

TRANSCRIPT:
${formattedTranscript}

ANALYSIS FRAMEWORK - For each moment, consider:

1. PSYCHOLOGICAL TRIGGERS (identify which apply):
   - FOMO: Fear of missing out
   - Social Proof: Others doing/endorsing it
   - Scarcity: Limited time/availability
   - Authority: Expert/credibility statements
   - Curiosity: Creates desire to know more
   - Pain Point: Identifies a problem viewers have
   - Transformation: Before/after or outcome
   - Urgency: Creates need to act now
   - Trust: Builds credibility

2. HOOK STRENGTH: How quickly does it grab attention? (1-10)
   - Great hooks: Controversy, bold claims, relatable problems, pattern interrupts

3. EMOTIONAL IMPACT: What emotion does it evoke? (1-10)
   - Fear, joy, curiosity, anger, surprise, nostalgia, desire

4. CONVERSION POTENTIAL: How likely to drive action? (1-10)
   - Clear benefit, solves real problem, has urgency

5. VIRAL POTENTIAL: How shareable is it? (1-10)
   - Relatable, surprising, emotional, controversial, educational

For each suggested clip, provide:
- Exact timestamps (${minDuration}-${maxDuration} seconds)
- Type: "hook", "testimonial", "benefit", "cta", "problem", "solution", or "viral"
- Scores for each criterion (1-10)
- The primary psychological trigger at play
- Platform-specific recommendations (TikTok, Instagram Reels, YouTube Shorts)
- A suggested CTA for this clip

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "suggestions": [
    {
      "startTime": 0,
      "endTime": ${targetClipDuration},
      "type": "hook",
      "reason": "This moment works because [specific marketing reason]",
      "transcript": "The exact text from this segment",
      "scores": {
        "hookStrength": 8,
        "emotionalImpact": 7,
        "conversionPotential": 9,
        "viralPotential": 6,
        "overallScore": 8
      },
      "psychologicalTrigger": "Pain Point",
      "suggestedCTA": "Link in bio for the free guide",
      "platformRecommendations": [
        {
          "platform": "TikTok",
          "suggestedCaption": "This changed everything...",
          "hashtags": ["#fyp", "#marketing", "#business"],
          "whyThisPlatform": "Fast-paced hook perfect for TikTok's attention economy"
        },
        {
          "platform": "Instagram Reels",
          "suggestedCaption": "Save this for later",
          "hashtags": ["#reels", "#marketingtips"],
          "whyThisPlatform": "Educational content performs well with saves"
        }
      ]
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

      // Validate and clamp timestamps, filter by duration range
      suggestions = suggestions.map(s => ({
        ...s,
        startTime: Math.max(0, Math.min(s.startTime, videoDuration)),
        endTime: Math.max(0, Math.min(s.endTime, videoDuration)),
      })).filter(s => {
        const duration = s.endTime - s.startTime;
        // Keep clips that are reasonably close to target (±50% tolerance for edge cases)
        return duration >= minDuration * 0.5 && duration <= maxDuration * 1.5 && s.endTime > s.startTime;
      });

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
