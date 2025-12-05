import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * POST /api/accounts/[id]/sync
 *
 * Manually trigger a sync for a single account.
 * This endpoint proxies to ABRA's internal sync API - KADABRA no longer
 * handles OAuth tokens or Google Ads API calls directly.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get ABRA URL and inter-app secret from environment
    const abraUrl = process.env.NEXT_PUBLIC_ABRA_URL || 'https://abra.magimanager.com';
    const interAppSecret = process.env.INTER_APP_SECRET;

    if (!interAppSecret) {
      console.error('[KADABRA Sync] INTER_APP_SECRET not configured');
      return NextResponse.json(
        { error: 'Internal configuration error' },
        { status: 500 }
      );
    }

    console.log(`[KADABRA Sync] Proxying sync request to ABRA for account ${id}`);

    // Call ABRA's internal sync API
    const response = await fetch(`${abraUrl}/api/internal/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${interAppSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId: id,
        reason: 'manual_sync_from_kadabra',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[KADABRA Sync] ABRA sync failed:`, data);

      // Pass through the error from ABRA
      return NextResponse.json(
        {
          error: data.error || 'Sync failed',
          message: data.message,
          errorCode: data.errorCode,
          isRecoverable: data.isRecoverable,
        },
        { status: response.status }
      );
    }

    console.log(`[KADABRA Sync] Sync completed successfully for account ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      metrics: data.metrics,
      syncedAt: data.syncedAt,
    });
  } catch (error) {
    console.error('[KADABRA Sync] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
