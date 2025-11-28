import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireManager } from '@/lib/api-auth';
import { launchBrowserForOAuth } from '@/lib/gologin';

/**
 * POST /api/accounts/[id]/launch-oauth
 *
 * Launches the GoLogin browser profile associated with this account
 * and opens the OAuth authorization page for the account's CID.
 *
 * IMPORTANT: This only works on machines with Orbita browser installed
 * (local development or dedicated server, NOT serverless like Vercel)
 *
 * Returns:
 *   - success: boolean
 *   - message: string
 *   - wsEndpoint?: string (for advanced automation)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    // Get the account with its identity and GoLogin profile
    const account = await prisma.adAccount.findUnique({
      where: { id },
      include: {
        identityProfile: {
          include: {
            gologinProfile: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, message: 'Account not found' },
        { status: 404 }
      );
    }

    // Check for Google CID
    if (!account.googleCid) {
      return NextResponse.json(
        { success: false, message: 'Account has no Google CID to authorize' },
        { status: 400 }
      );
    }

    // Check for linked GoLogin profile
    const gologinProfile = account.identityProfile?.gologinProfile;
    if (!gologinProfile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Account has no linked GoLogin profile. Create an identity with a GoLogin profile first.',
        },
        { status: 400 }
      );
    }

    // Check if GoLogin profile is ready
    if (!gologinProfile.profileId) {
      return NextResponse.json(
        {
          success: false,
          message: 'GoLogin profile not yet provisioned. Wait for profile creation to complete.',
        },
        { status: 400 }
      );
    }

    // Launch the browser with OAuth URL
    const result = await launchBrowserForOAuth(
      gologinProfile.profileId,
      account.googleCid
    );

    if (result.success) {
      // Log the activity
      await prisma.accountActivity.create({
        data: {
          adAccountId: account.id,
          action: 'BROWSER_LAUNCHED',
          details: `GoLogin browser launched for OAuth authorization`,
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Launch OAuth error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to launch browser',
      },
      { status: 500 }
    );
  }
}
