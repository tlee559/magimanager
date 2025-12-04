import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@magimanager/auth';
import { prisma } from '@magimanager/database';
import type { ClipExports, ExportKey } from '@/lib/video-clipper/types';

export const runtime = 'nodejs';

// PATCH - Update a clip's exports (add a new export variant)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  const { clipId } = await params;
  console.log('[VideoClipper] PATCH /api/video-clipper/clips/' + clipId);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { exportKey, exportData } = body as {
      exportKey: ExportKey;
      exportData: { url: string; width: number; height: number };
    };

    console.log('[VideoClipper] Updating clip export:', { clipId, exportKey });

    // Get the clip and verify ownership through the job
    const clip = await prisma.videoClip.findFirst({
      where: { id: clipId },
      include: {
        job: {
          select: { userId: true },
        },
      },
    });

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    if (clip.job.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse existing exports (stored in platformRecommendations JSON field)
    let currentExports: ClipExports = {};
    if (clip.platformRecommendations) {
      try {
        currentExports = clip.platformRecommendations as unknown as ClipExports;
      } catch {
        console.warn('[VideoClipper] Failed to parse existing exports');
      }
    }

    // Add the new export variant
    const updatedExports: ClipExports = {
      ...currentExports,
      [exportKey]: exportData,
    };

    console.log('[VideoClipper] Updated exports:', Object.keys(updatedExports));

    // Update the clip
    const updatedClip = await prisma.videoClip.update({
      where: { id: clipId },
      data: {
        platformRecommendations: JSON.parse(JSON.stringify(updatedExports)),
      },
    });

    console.log('[VideoClipper] Clip updated successfully:', clipId);

    return NextResponse.json({
      success: true,
      clip: {
        id: updatedClip.id,
        exports: updatedExports,
      },
    });
  } catch (error) {
    console.error('[VideoClipper] Error updating clip:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update clip' },
      { status: 500 }
    );
  }
}

// GET - Get a clip's exports
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  const { clipId } = await params;
  console.log('[VideoClipper] GET /api/video-clipper/clips/' + clipId);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clip = await prisma.videoClip.findFirst({
      where: { id: clipId },
      include: {
        job: {
          select: { userId: true },
        },
      },
    });

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    if (clip.job.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse exports
    let exports: ClipExports = {};
    if (clip.platformRecommendations) {
      try {
        exports = clip.platformRecommendations as unknown as ClipExports;
      } catch {
        console.warn('[VideoClipper] Failed to parse exports');
      }
    }

    return NextResponse.json({
      clip: {
        id: clip.id,
        clipUrl: clip.clipUrl,
        clipWithCaptionsUrl: clip.clipWithCaptionsUrl,
        exports,
      },
    });
  } catch (error) {
    console.error('[VideoClipper] Error fetching clip:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch clip' },
      { status: 500 }
    );
  }
}
