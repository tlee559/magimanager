import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { normalizeCid, syncSingleAccount } from '@/lib/google-ads-api';

/**
 * POST /api/oauth/google-ads/link-account
 *
 * Links a selected Google Ads CID to a MagiManager account after OAuth.
 *
 * Body:
 *   - accountId: MagiManager ad account ID
 *   - connectionId: Google Ads connection ID
 *   - selectedCid: The CID selected by user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, connectionId, selectedCid } = body;

    if (!accountId || !connectionId || !selectedCid) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, connectionId, selectedCid' },
        { status: 400 }
      );
    }

    // Verify the connection exists
    const connection = await prisma.googleAdsConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found or expired' },
        { status: 404 }
      );
    }

    // Verify the account exists
    const account = await prisma.adAccount.findUnique({
      where: { id: accountId },
      include: { identityProfile: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Normalize the CID
    const normalizedCid = normalizeCid(selectedCid);

    // Check if this CID is already linked to another account
    const existingWithCid = await prisma.adAccount.findFirst({
      where: {
        googleCid: normalizedCid,
        id: { not: accountId },
      },
      include: { identityProfile: true },
    });

    if (existingWithCid) {
      return NextResponse.json(
        {
          error: `CID ${selectedCid} is already linked to account #${existingWithCid.internalId}${existingWithCid.identityProfile ? ` (${existingWithCid.identityProfile.fullName})` : ''}`
        },
        { status: 400 }
      );
    }

    // Update the account with the connection and CID
    await prisma.adAccount.update({
      where: { id: accountId },
      data: {
        googleCid: normalizedCid,
        connectionId: connection.id,
        connectionType: 'oauth',
        googleCidVerified: true,
        syncStatus: 'synced',
        googleSyncError: null,
      },
    });

    // Log the activity
    await prisma.accountActivity.create({
      data: {
        adAccountId: accountId,
        action: 'OAUTH_CONNECTED',
        details: `Account connected via OAuth (${connection.googleEmail}) with CID ${normalizedCid}`,
      },
    });

    // Trigger initial sync immediately (don't wait for hourly cron)
    let syncError: string | null = null;
    try {
      const accessToken = decrypt(connection.accessToken);
      await syncSingleAccount(accessToken, accountId, normalizedCid, prisma);
      console.log(`[Link Account] Initial sync completed for ${normalizedCid}`);
    } catch (error) {
      console.error(`[Link Account] Initial sync failed for ${normalizedCid}:`, error);
      syncError = error instanceof Error ? error.message : 'Sync failed';
      // Don't fail the whole request - connection is still valid
    }

    return NextResponse.json({
      success: true,
      message: syncError
        ? `Account connected with CID ${normalizedCid} (initial sync failed: ${syncError})`
        : `Account connected with CID ${normalizedCid}`,
      cid: normalizedCid,
      synced: !syncError,
    });
  } catch (error) {
    console.error('Link account error:', error);
    return NextResponse.json(
      { error: 'Failed to link account' },
      { status: 500 }
    );
  }
}
