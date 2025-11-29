import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getTextVerifiedClientFromSettings,
  GOOGLE_SERVICE_ID,
  formatPhoneNumber,
  extractCodeFromSms,
} from '@magimanager/core';

/**
 * POST /api/identities/[id]/phone-verification
 * Start a new phone verification - get a number from TextVerified
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check if identity exists
    const identity = await prisma.identityProfile.findUnique({
      where: { id },
    });

    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    // Check if there's already an active verification
    if (
      identity.verificationStatus === 'pending' &&
      identity.verificationExpiresAt &&
      new Date(identity.verificationExpiresAt) > new Date()
    ) {
      return NextResponse.json(
        {
          error: 'Verification already in progress',
          phone: identity.verificationPhone,
          status: identity.verificationStatus,
          expiresAt: identity.verificationExpiresAt,
        },
        { status: 400 }
      );
    }

    // Get TextVerified client
    const client = await getTextVerifiedClientFromSettings();

    // Check balance first
    const balance = await client.getBalance();
    if (balance.balance < 2) {
      return NextResponse.json(
        {
          error: `Insufficient TextVerified balance: $${balance.balance.toFixed(2)}. Minimum $2 required.`,
        },
        { status: 402 }
      );
    }

    // Start verification
    const verification = await client.startVerification(GOOGLE_SERVICE_ID);

    // Calculate expiration (TextVerified numbers typically last 15-20 minutes)
    const expiresAt = verification.expiresAt
      ? new Date(verification.expiresAt)
      : new Date(Date.now() + 15 * 60 * 1000); // Default 15 minutes

    // Update identity with verification info
    await prisma.identityProfile.update({
      where: { id },
      data: {
        verificationPhone: verification.phone,
        verificationPhoneId: verification.id,
        verificationStatus: 'pending',
        verificationCode: null,
        verificationExpiresAt: expiresAt,
      },
    });

    // Log activity
    await prisma.identityActivity.create({
      data: {
        identityProfileId: id,
        action: 'PHONE_VERIFICATION_STARTED',
        details: `Phone verification started. Number: ${formatPhoneNumber(verification.phone)}`,
      },
    });

    return NextResponse.json({
      success: true,
      phone: verification.phone,
      phoneFormatted: formatPhoneNumber(verification.phone),
      verificationId: verification.id,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      cost: verification.cost,
      balance: balance.balance - (verification.cost || 0),
    });
  } catch (error) {
    console.error(`POST /api/identities/${id}/phone-verification error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to start verification';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/identities/[id]/phone-verification
 * Check verification status and get SMS code if received
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get identity with verification info
    const identity = await prisma.identityProfile.findUnique({
      where: { id },
    });

    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    // Check if there's an active verification
    if (!identity.verificationPhoneId) {
      return NextResponse.json(
        {
          error: 'No active verification',
          status: 'none',
        },
        { status: 404 }
      );
    }

    // Check if already completed
    if (identity.verificationStatus === 'received' && identity.verificationCode) {
      return NextResponse.json({
        status: 'received',
        phone: identity.verificationPhone,
        phoneFormatted: formatPhoneNumber(identity.verificationPhone || ''),
        code: identity.verificationCode,
        expiresAt: identity.verificationExpiresAt?.toISOString(),
      });
    }

    // Check if expired
    if (
      identity.verificationExpiresAt &&
      new Date(identity.verificationExpiresAt) < new Date()
    ) {
      // Update status to expired
      await prisma.identityProfile.update({
        where: { id },
        data: {
          verificationStatus: 'expired',
        },
      });

      return NextResponse.json({
        status: 'expired',
        phone: identity.verificationPhone,
        message: 'Verification expired. Please start a new verification.',
      });
    }

    // Get TextVerified client and check status
    const client = await getTextVerifiedClientFromSettings();
    const verification = await client.checkVerification(identity.verificationPhoneId);

    // If code received, update identity and log
    if (verification.code || verification.sms) {
      const code = verification.code || extractCodeFromSms(verification.sms || '');

      if (code) {
        await prisma.identityProfile.update({
          where: { id },
          data: {
            verificationStatus: 'received',
            verificationCode: code,
          },
        });

        // Log activity
        await prisma.identityActivity.create({
          data: {
            identityProfileId: id,
            action: 'PHONE_VERIFICATION_CODE_RECEIVED',
            details: `Verification code received: ${code}`,
          },
        });

        return NextResponse.json({
          status: 'received',
          phone: identity.verificationPhone,
          phoneFormatted: formatPhoneNumber(identity.verificationPhone || ''),
          code: code,
          sms: verification.sms,
          expiresAt: identity.verificationExpiresAt?.toISOString(),
        });
      }
    }

    // Still waiting
    return NextResponse.json({
      status: 'pending',
      phone: identity.verificationPhone,
      phoneFormatted: formatPhoneNumber(identity.verificationPhone || ''),
      message: 'Waiting for SMS code...',
      expiresAt: identity.verificationExpiresAt?.toISOString(),
    });
  } catch (error) {
    console.error(`GET /api/identities/${id}/phone-verification error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to check verification';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/identities/[id]/phone-verification
 * Cancel an active verification
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get identity
    const identity = await prisma.identityProfile.findUnique({
      where: { id },
    });

    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    if (!identity.verificationPhoneId) {
      return NextResponse.json({ error: 'No active verification to cancel' }, { status: 400 });
    }

    // Try to cancel with TextVerified (might fail if already expired/completed)
    try {
      const client = await getTextVerifiedClientFromSettings();
      await client.cancelVerification(identity.verificationPhoneId);
    } catch (cancelError) {
      console.log('Could not cancel with TextVerified (may already be expired):', cancelError);
    }

    // Clear verification data
    await prisma.identityProfile.update({
      where: { id },
      data: {
        verificationPhone: null,
        verificationPhoneId: null,
        verificationStatus: 'cancelled',
        verificationCode: null,
        verificationExpiresAt: null,
      },
    });

    // Log activity
    await prisma.identityActivity.create({
      data: {
        identityProfileId: id,
        action: 'PHONE_VERIFICATION_CANCELLED',
        details: 'Phone verification cancelled',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Verification cancelled',
    });
  } catch (error) {
    console.error(`DELETE /api/identities/${id}/phone-verification error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to cancel verification';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
