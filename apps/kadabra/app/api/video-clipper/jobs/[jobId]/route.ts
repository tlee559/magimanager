import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@magimanager/auth';
import { prisma } from '@magimanager/database';

export const runtime = 'nodejs';

// GET - Get a single job by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  console.log('[VideoClipper] GET /api/video-clipper/jobs/' + jobId);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await prisma.videoClipJob.findFirst({
      where: {
        id: jobId,
        userId: session.user.id,
      },
      include: {
        clips: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            duration: true,
            momentType: true,
            clipUrl: true,
            whySelected: true,
            transcript: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log('[VideoClipper] Found job:', job.id);

    return NextResponse.json({ job });
  } catch (error) {
    console.error('[VideoClipper] Error fetching job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a job and its clips
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  console.log('[VideoClipper] DELETE /api/video-clipper/jobs/' + jobId);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check that the job belongs to this user
    const job = await prisma.videoClipJob.findFirst({
      where: {
        id: jobId,
        userId: session.user.id,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Delete clips first (Prisma should handle this with cascade, but being explicit)
    await prisma.videoClip.deleteMany({
      where: { jobId },
    });

    // Delete the job
    await prisma.videoClipJob.delete({
      where: { id: jobId },
    });

    console.log('[VideoClipper] Job deleted:', jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[VideoClipper] Error deleting job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete job' },
      { status: 500 }
    );
  }
}
