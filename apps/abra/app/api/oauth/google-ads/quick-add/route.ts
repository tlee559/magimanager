import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeCid } from '@/lib/google-ads-api';

/**
 * POST /api/oauth/google-ads/quick-add
 *
 * Creates a new AdAccount with just the CID and links it to an OAuth connection.
 * Called when user clicks "Add Now" after connecting an account not in the system.
 *
 * Body:
 *   - cid: Google Ads customer ID
 *   - connectionId: ID of the GoogleAdsConnection to link
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cid, connectionId } = body;

    if (!cid || !connectionId) {
      return NextResponse.json(
        { error: 'Missing cid or connectionId' },
        { status: 400 }
      );
    }

    // Verify connection exists
    const connection = await prisma.googleAdsConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Check if account already exists (race condition protection)
    const normalizedCid = normalizeCid(cid);
    const existingAccount = await prisma.adAccount.findFirst({
      where: {
        googleCid: {
          in: [normalizedCid, cid],
        },
      },
    });

    if (existingAccount) {
      // Account was created between OAuth callback and quick-add
      // Just link it to the connection
      await prisma.adAccount.update({
        where: { id: existingAccount.id },
        data: {
          connectionId: connection.id,
          connectionType: 'oauth',
          googleCidVerified: true,
          syncStatus: 'synced',
          googleSyncError: null,
        },
      });

      return NextResponse.json({
        success: true,
        accountId: existingAccount.id,
        message: 'Account already existed and was linked',
      });
    }

    // Create new account with minimal info
    const newAccount = await prisma.adAccount.create({
      data: {
        googleCid: normalizedCid,
        origin: 'takeover', // Accounts added via OAuth are takeovers
        status: 'active',
        connectionId: connection.id,
        connectionType: 'oauth',
        googleCidVerified: true,
        syncStatus: 'synced',
        accountHealth: 'unknown', // Will be updated on first sync
        billingStatus: 'pending',
      },
    });

    // Log activity
    await prisma.accountActivity.create({
      data: {
        adAccountId: newAccount.id,
        action: 'OAUTH_CONNECTED',
        details: `Account created via OAuth connection from ${connection.googleEmail}`,
      },
    });

    return NextResponse.json({
      success: true,
      accountId: newAccount.id,
      internalId: newAccount.internalId,
      message: 'Account created and connected',
    });
  } catch (error) {
    console.error('Quick-add error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
