/**
 * AI Video Clipper Agent
 *
 * This agent specializes in identifying high-converting moments in videos
 * for marketing and sales content. It uses Gemini for analysis and
 * Replicate for transcription and video processing.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// TYPES
// ============================================================================

export interface VideoAnalysisJob {
  id: string;
  sourceType: "youtube" | "upload";
  sourceUrl: string | null;
  uploadedVideoUrl: string | null;
  videoDuration: number | null;
  industry: string | null;
  productContext: string | null;
  targetAudience: string | null;
  targetDuration: number;
  maxClips: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface MarketingMoment {
  startTime: number;
  endTime: number;
  type: MomentType;
  marketingScore: number;
  conversionPotential: number;
  hookStrength: number;
  emotionalImpact: number;
  whySelected: string;
  suggestedCaption: string;
  transcript: string;
  keyPhrases: string[];
}

export type MomentType =
  | "hook"
  | "testimonial"
  | "benefit"
  | "cta"
  | "social_proof"
  | "urgency"
  | "problem_agitation"
  | "solution_reveal"
  | "objection_handler"
  | "emotional_peak";

export interface AnalysisResult {
  transcript: TranscriptSegment[];
  moments: MarketingMoment[];
  totalMomentsFound: number;
  videoAnalysis: {
    overallMarketingScore: number;
    recommendedClipCount: number;
    dominantTone: string;
    primaryContentType: string;
    targetAudienceMatch: number | null;
    keyThemes: string[];
  };
}

// ============================================================================
// MARKETING MOMENT DETECTION PROMPT
// ============================================================================

const MARKETING_AGENT_PROMPT = `You are an elite marketing AI that specializes in identifying HIGH-CONVERTING video moments.

Your expertise:
- Direct response marketing
- Social media advertising (Reels, TikTok, YouTube Shorts)
- Conversion psychology
- Emotional triggers in sales content
- Pattern interrupts and hooks

MOMENT TYPES TO IDENTIFY:

1. HOOK (Score highly if within first 5-15 seconds)
   - Pattern interrupts ("Wait, what?")
   - Bold claims or controversies
   - Questions that create curiosity
   - Unexpected statements
   - "I was wrong about X"

2. TESTIMONIAL
   - Customer success stories
   - Before/after moments
   - Specific results with numbers
   - Emotional transformation stories
   - User-generated content feel

3. BENEFIT
   - Clear value proposition
   - "You get X" statements
   - Feature-to-benefit translations
   - Lifestyle benefits shown
   - Time/money savings highlighted

4. CALL TO ACTION (CTA)
   - Clear next steps
   - Urgency elements
   - Scarcity messaging
   - Easy-to-follow instructions
   - "Click/swipe/link" prompts

5. SOCIAL PROOF
   - Numbers (users, sales, reviews)
   - Authority mentions
   - Celebrity/influencer endorsements
   - "Join X others" messaging
   - Trust signals

6. URGENCY
   - Time-limited offers
   - Scarcity messaging
   - FOMO triggers
   - "Before it's too late"
   - Countdown/deadline mentions

7. PROBLEM AGITATION
   - Pain point identification
   - "Are you struggling with X?"
   - Empathy statements
   - Common frustrations voiced
   - "I know how it feels"

8. SOLUTION REVEAL
   - "Here's the secret"
   - Aha moments
   - Method/system reveals
   - "This is what changed everything"
   - Breakthrough moments

9. OBJECTION HANDLER
   - "But you might be thinking..."
   - Common concerns addressed
   - Risk reversal
   - Guarantee mentions
   - "Even if you're not X"

10. EMOTIONAL PEAK
    - High emotion moments
    - Inspiring statements
    - Victory/celebration
    - Vulnerability/authenticity
    - "This is why I do what I do"

SCORING CRITERIA (1-100):

Marketing Score:
- How well does this segment sell?
- Is the message clear and compelling?
- Would this work as a standalone ad?

Conversion Potential:
- Does it drive action?
- Is there a clear value proposition?
- Does it overcome objections?

Hook Strength:
- First 3 seconds grab attention?
- Pattern interrupt present?
- Curiosity created?

Emotional Impact:
- Does it evoke feeling?
- Is it relatable?
- Does it create connection?

OUTPUT FORMAT (JSON):
{
  "moments": [
    {
      "startTime": 15,
      "endTime": 45,
      "type": "hook",
      "marketingScore": 92,
      "conversionPotential": 88,
      "hookStrength": 95,
      "emotionalImpact": 85,
      "whySelected": "Detailed explanation of why this is a high-converting moment",
      "suggestedCaption": "Short, punchy caption for social media",
      "transcript": "The exact words spoken in this segment",
      "keyPhrases": ["key phrase 1", "key phrase 2"]
    }
  ],
  "videoAnalysis": {
    "overallMarketingScore": 85,
    "recommendedClipCount": 5,
    "dominantTone": "educational",
    "primaryContentType": "sales_video",
    "keyThemes": ["transformation", "results", "simplicity"]
  }
}

RULES:
1. Only select moments that could work as STANDALONE clips
2. Each moment should be {targetDuration}± 15 seconds
3. Prioritize moments with strong HOOKS - the first 3 seconds matter most
4. Consider the clip's performance on muted playback (visuals matter)
5. Prefer diverse moment types over multiple of the same
6. Score honestly - not every video has 90+ moments
7. Think like a media buyer who needs to hit ROAS targets`;

// ============================================================================
// REPLICATE API INTEGRATION
// ============================================================================

const REPLICATE_API_URL = "https://api.replicate.com/v1";

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error?: string;
}

async function callReplicate(
  model: string,
  input: Record<string, unknown>
): Promise<ReplicatePrediction> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  // Start the prediction
  const createResponse = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: model,
      input,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await createResponse.json();

  // Poll for completion
  let result = prediction;
  while (result.status === "starting" || result.status === "processing") {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await fetch(
      `${REPLICATE_API_URL}/predictions/${prediction.id}`,
      {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      }
    );

    result = await statusResponse.json();
  }

  if (result.status === "failed") {
    throw new Error(`Replicate prediction failed: ${result.error}`);
  }

  return result;
}

// ============================================================================
// TRANSCRIPTION
// ============================================================================

export async function transcribeVideo(
  videoUrl: string
): Promise<TranscriptSegment[]> {
  console.log("[Video Clipper] Transcribing video with Whisper...");

  try {
    // Use Whisper large-v3 via Replicate
    const result = await callReplicate(
      "openai/whisper:4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2",
      {
        audio: videoUrl,
        model: "large-v3",
        transcription: "srt",
        translate: false,
        language: "en",
        temperature: 0,
        suppress_tokens: "-1",
        logprob_threshold: -1,
        no_speech_threshold: 0.6,
        condition_on_previous_text: true,
        compression_ratio_threshold: 2.4,
        word_timestamps: true,
      }
    );

    // Parse SRT output into segments
    const segments = parseSRT(result.output as string);
    return segments;
  } catch (error) {
    console.error("[Video Clipper] Transcription error:", error);
    throw error;
  }
}

function parseSRT(srt: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const blocks = srt.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const timeLine = lines[1];
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );

    if (!timeMatch) continue;

    const start =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000;

    const end =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000;

    const text = lines.slice(2).join(" ").trim();

    segments.push({
      start,
      end,
      text,
      confidence: 1.0,
    });
  }

  return segments;
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

export async function analyzeTranscriptForMarketingMoments(
  transcript: TranscriptSegment[],
  job: VideoAnalysisJob
): Promise<MarketingMoment[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  // Format transcript for analysis
  const formattedTranscript = transcript
    .map((seg) => `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.text}`)
    .join("\n");

  const contextInfo = `
CONTEXT:
- Industry: ${job.industry || "General"}
- Product/Service: ${job.productContext || "Not specified"}
- Target Audience: ${job.targetAudience || "General audience"}
- Target Clip Duration: ${job.targetDuration} seconds
- Max Clips Needed: ${job.maxClips}
- Video Duration: ${job.videoDuration ? formatTime(job.videoDuration) : "Unknown"}
`;

  const prompt = `${MARKETING_AGENT_PROMPT}

${contextInfo}

TRANSCRIPT:
${formattedTranscript}

Analyze this transcript and identify the ${job.maxClips} BEST marketing moments.
Return ONLY valid JSON matching the output format specified above.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.moments || [];
  } catch (error) {
    console.error("[Video Clipper] AI analysis error:", error);
    throw error;
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================================
// YOUTUBE DOWNLOAD
// ============================================================================

export async function downloadYouTubeAudio(youtubeUrl: string): Promise<string> {
  console.log("[Video Clipper] Downloading YouTube audio...");

  // In production, you'd use yt-dlp or a service like RapidAPI's YouTube Download
  // For now, we'll use a placeholder that assumes the URL is directly accessible

  // Extract video ID
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  // In production: Use yt-dlp or cloud function to get audio URL
  // For demo: Return placeholder
  console.log(`[Video Clipper] YouTube video ID: ${videoId}`);

  // Placeholder - in production this would return actual audio URL
  return `https://placeholder.youtube.audio/${videoId}.mp3`;
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// ============================================================================
// VIDEO CLIPPING
// ============================================================================

export async function createVideoClip(
  sourceUrl: string,
  startTime: number,
  endTime: number,
  format: "vertical" | "square" | "horizontal"
): Promise<string> {
  console.log(`[Video Clipper] Creating clip from ${startTime}s to ${endTime}s`);

  // In production, use FFmpeg via Replicate or a cloud function
  // Model: lucataco/ffmpeg or similar

  const aspectRatio = {
    vertical: "9:16",
    square: "1:1",
    horizontal: "16:9",
  }[format];

  // Placeholder for actual FFmpeg processing
  // In production:
  // 1. Download source video segment
  // 2. Crop to target aspect ratio
  // 3. Scale to target resolution
  // 4. Upload to Vercel Blob
  // 5. Return URL

  return `https://placeholder.clips/${Date.now()}_${format}.mp4`;
}

// ============================================================================
// CAPTION GENERATION
// ============================================================================

export async function addCaptionsToClip(
  clipUrl: string,
  transcript: string,
  style: "minimal" | "modern" | "bold" | "branded"
): Promise<string> {
  console.log(`[Video Clipper] Adding ${style} captions to clip`);

  // In production, use a captioning service or FFmpeg with ASS/SRT subtitles
  // Options:
  // 1. Replicate model for adding captions
  // 2. FFmpeg with custom subtitle styling
  // 3. Cloud function with canvas rendering

  const styleConfig = {
    minimal: {
      fontFamily: "Arial",
      fontSize: 24,
      fontColor: "#FFFFFF",
      backgroundColor: "transparent",
      position: "bottom",
    },
    modern: {
      fontFamily: "Montserrat",
      fontSize: 32,
      fontColor: "#FFFFFF",
      backgroundColor: "#000000CC",
      position: "center",
      animation: "word-by-word",
    },
    bold: {
      fontFamily: "Impact",
      fontSize: 48,
      fontColor: "#FFFF00",
      backgroundColor: "#000000",
      position: "center",
      strokeColor: "#000000",
      strokeWidth: 4,
    },
    branded: {
      fontFamily: "Custom",
      fontSize: 36,
      fontColor: "#8B5CF6", // Violet
      backgroundColor: "#000000DD",
      position: "center",
    },
  };

  console.log(`[Video Clipper] Style config:`, styleConfig[style]);

  // Placeholder for actual captioned clip URL
  return `https://placeholder.clips/${Date.now()}_captioned.mp4`;
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

export async function processVideoForClips(
  job: VideoAnalysisJob
): Promise<AnalysisResult> {
  console.log(`[Video Clipper] Starting processing for job ${job.id}`);

  // Step 1: Get video audio URL
  let audioUrl: string;
  if (job.sourceType === "youtube" && job.sourceUrl) {
    audioUrl = await downloadYouTubeAudio(job.sourceUrl);
  } else if (job.uploadedVideoUrl) {
    audioUrl = job.uploadedVideoUrl;
  } else {
    throw new Error("No video source provided");
  }

  // Step 2: Transcribe
  const transcript = await transcribeVideo(audioUrl);
  console.log(`[Video Clipper] Got ${transcript.length} transcript segments`);

  // Step 3: Analyze with AI
  const moments = await analyzeTranscriptForMarketingMoments(transcript, job);
  console.log(`[Video Clipper] Found ${moments.length} marketing moments`);

  // Calculate overall score
  const avgScore =
    moments.length > 0
      ? moments.reduce((sum, m) => sum + m.marketingScore, 0) / moments.length
      : 0;

  return {
    transcript,
    moments,
    totalMomentsFound: moments.length,
    videoAnalysis: {
      overallMarketingScore: Math.round(avgScore),
      recommendedClipCount: Math.min(moments.length, job.maxClips),
      dominantTone: detectDominantTone(moments),
      primaryContentType: detectContentType(moments),
      targetAudienceMatch: job.targetAudience ? 0.85 : null,
      keyThemes: extractKeyThemes(moments),
    },
  };
}

function detectDominantTone(moments: MarketingMoment[]): string {
  const emotionalAvg =
    moments.reduce((sum, m) => sum + m.emotionalImpact, 0) / moments.length;

  if (emotionalAvg > 80) return "inspirational";
  if (emotionalAvg > 60) return "engaging";
  if (emotionalAvg > 40) return "educational";
  return "informative";
}

function detectContentType(moments: MarketingMoment[]): string {
  const typeCounts: Record<string, number> = {};
  for (const moment of moments) {
    typeCounts[moment.type] = (typeCounts[moment.type] || 0) + 1;
  }

  const hasTestimonial = typeCounts["testimonial"] > 0;
  const hasCta = typeCounts["cta"] > 0;
  const hasProof = typeCounts["social_proof"] > 0;

  if (hasTestimonial && hasCta) return "sales_video";
  if (hasProof && hasCta) return "promotional";
  if (typeCounts["benefit"] > 2) return "product_demo";
  return "general_content";
}

function extractKeyThemes(moments: MarketingMoment[]): string[] {
  const allPhrases = moments.flatMap((m) => m.keyPhrases || []);
  const uniquePhrases = [...new Set(allPhrases)];
  return uniquePhrases.slice(0, 5);
}
