import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@magimanager/auth';
import { prisma } from '@magimanager/database';

export const runtime = 'nodejs';

// GET - List all jobs for the current user
export async function GET(req: NextRequest) {
  console.log('[VideoClipper] GET /api/video-clipper/jobs');

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobs = await prisma.videoClipJob.findMany({
      where: { userId: session.user.id },
      include: {
        clips: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            duration: true,
            momentType: true,
            clipUrl: true,
            clipWithCaptionsUrl: true,
            whySelected: true,
            transcript: true,
            platformRecommendations: true, // Contains format variants
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse analysisResults for each job to include transcript data
    const jobsWithTranscript = jobs.map(job => {
      let analysisData = null;
      if (job.analysisResults) {
        try {
          analysisData = JSON.parse(job.analysisResults as string);
        } catch {
          console.warn('[VideoClipper] Failed to parse analysisResults for job:', job.id);
        }
      }
      return {
        ...job,
        transcript: analysisData?.transcript || null,
      };
    });

    console.log('[VideoClipper] Found', jobsWithTranscript.length, 'jobs');

    return NextResponse.json({ jobs: jobsWithTranscript });
  } catch (error) {
    console.error('[VideoClipper] Error fetching jobs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST - Create a new job
export async function POST(req: NextRequest) {
  console.log('[VideoClipper] POST /api/video-clipper/jobs');

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      sourceVideoUrl,
      videoDuration,
      transcript,
      suggestions,
      generatedClips,
    } = body;

    console.log('[VideoClipper] Creating job:', {
      name,
      sourceVideoUrl: sourceVideoUrl?.substring(0, 50) + '...',
      videoDuration,
      suggestionsCount: suggestions?.length,
      clipsCount: generatedClips?.length,
    });

    // Create the job
    const job = await prisma.videoClipJob.create({
      data: {
        userId: session.user.id,
        name: name || `Video Clip Job - ${new Date().toLocaleDateString()}`,
        sourceType: 'upload',
        uploadedVideoUrl: sourceVideoUrl,
        videoDuration: Math.round(videoDuration || 0),
        status: 'COMPLETED',
        progress: 100,
        analysisResults: JSON.stringify({
          transcript,
          suggestions,
        }),
        // Create clips
        clips: {
          create: (generatedClips || []).map((clip: {
            url: string;
            startTime: number;
            endTime: number;
            duration: number;
            type: string;
            reason: string;
            transcript: string;
            captionedUrl?: string | null;
            formatVariants?: Record<string, unknown> | null;
          }) => ({
            startTime: Math.round(clip.startTime),
            endTime: Math.round(clip.endTime),
            duration: Math.round(clip.duration),
            momentType: clip.type,
            marketingScore: 80,
            conversionPotential: 75,
            hookStrength: 70,
            emotionalImpact: 65,
            whySelected: clip.reason,
            transcript: clip.transcript,
            clipUrl: clip.url,
            clipWithCaptionsUrl: clip.captionedUrl || null,
            platformRecommendations: clip.formatVariants || null, // Store format variants as JSON
            status: 'COMPLETED',
          })),
        },
      },
      include: {
        clips: true,
      },
    });

    console.log('[VideoClipper] Job created:', job.id);

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('[VideoClipper] Error creating job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job' },
      { status: 500 }
    );
  }
}
