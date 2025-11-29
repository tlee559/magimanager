import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { getTextVerifiedClientFromSettings, extractCodeFromSms } from "@magimanager/core";

// GET /api/verifications - Get all identities with verification data
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // pending, received, expired, all
  const search = searchParams.get("search");
  const includeBalance = searchParams.get("includeBalance") === "true";

  try {
    console.log("Verifications API: Starting query...");

    // Build where clause - Prisma requires specific typing for OR queries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereConditions: any[] = [];

    // Only get identities that have verification data
    if (status && status !== "all") {
      whereConditions.push({ verificationStatus: status });
    } else {
      // Get any identity with verification phone or status set
      whereConditions.push({
        OR: [
          { verificationPhone: { not: null } },
          { verificationStatus: { not: null } },
        ],
      });
    }

    // Search by name
    if (search) {
      whereConditions.push({
        fullName: { contains: search, mode: "insensitive" as const }
      });
    }

    // Combine conditions with AND
    const where = whereConditions.length > 0
      ? { AND: whereConditions }
      : {};

    // Fetch identities with verification data
    const identities = await prisma.identityProfile.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        verificationPhone: true,
        verificationPhoneId: true,
        verificationStatus: true,
        verificationCode: true,
        verificationExpiresAt: true,
        updatedAt: true,
        adAccounts: {
          select: {
            id: true,
            internalId: true,
            googleCid: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate stats
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const stats = {
      activeCount: identities.filter(
        (i) => i.verificationStatus === "pending" &&
        i.verificationExpiresAt &&
        new Date(i.verificationExpiresAt) > now
      ).length,
      receivedCount: identities.filter(
        (i) => i.verificationStatus === "received"
      ).length,
      expiredCount: identities.filter(
        (i) => i.verificationStatus === "expired" ||
        (i.verificationStatus === "pending" &&
         i.verificationExpiresAt &&
         new Date(i.verificationExpiresAt) <= now)
      ).length,
      totalWithVerification: identities.length,
    };

    // Get TextVerified balance if requested
    let balance = null;
    if (includeBalance) {
      try {
        const client = await getTextVerifiedClientFromSettings();
        const balanceResult = await client.getBalance();
        balance = balanceResult.balance;
      } catch (e) {
        // Balance fetch failed - not critical
        console.error("Failed to fetch TextVerified balance:", e);
      }
    }

    return NextResponse.json({
      verifications: identities,
      stats,
      balance,
    });
  } catch (error) {
    console.error("GET /api/verifications error:", error);
    console.error("Error details:", error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: "Failed to fetch verifications", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/verifications/check-all - Check status of all pending verifications
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "check-all") {
      // Get all pending verifications
      const pendingIdentities = await prisma.identityProfile.findMany({
        where: {
          verificationStatus: "pending",
          verificationPhoneId: { not: null },
        },
        select: {
          id: true,
          verificationPhoneId: true,
          verificationExpiresAt: true,
        },
      });

      const client = await getTextVerifiedClientFromSettings();
      const results: { id: string; status: string; code?: string }[] = [];
      const now = new Date();

      for (const identity of pendingIdentities) {
        // Check if expired first
        if (identity.verificationExpiresAt && new Date(identity.verificationExpiresAt) <= now) {
          await prisma.identityProfile.update({
            where: { id: identity.id },
            data: { verificationStatus: "expired" },
          });
          results.push({ id: identity.id, status: "expired" });
          continue;
        }

        // Check with TextVerified
        try {
          const verification = await client.checkVerification(identity.verificationPhoneId!);

          if (verification.code || verification.sms) {
            const code = verification.code || extractCodeFromSms(verification.sms || "");
            if (code) {
              await prisma.identityProfile.update({
                where: { id: identity.id },
                data: {
                  verificationStatus: "received",
                  verificationCode: code,
                },
              });
              results.push({ id: identity.id, status: "received", code });
              continue;
            }
          }
          results.push({ id: identity.id, status: "pending" });
        } catch (e) {
          console.error(`Failed to check verification for ${identity.id}:`, e);
          results.push({ id: identity.id, status: "error" });
        }
      }

      return NextResponse.json({ results, checked: results.length });
    }

    if (action === "clear-expired") {
      // Clear verification data from expired entries
      const result = await prisma.identityProfile.updateMany({
        where: {
          OR: [
            { verificationStatus: "expired" },
            { verificationStatus: "cancelled" },
            {
              verificationStatus: "pending",
              verificationExpiresAt: { lt: new Date() },
            },
          ],
        },
        data: {
          verificationPhone: null,
          verificationPhoneId: null,
          verificationStatus: null,
          verificationCode: null,
          verificationExpiresAt: null,
        },
      });

      return NextResponse.json({ cleared: result.count });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/verifications error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}

