import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * GET /api/accounts/cids
 *
 * Returns all Google CIDs currently in the system.
 * Used by the Add Account modal's OAuth picker to detect duplicates.
 */
export async function GET() {
  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accounts = await prisma.adAccount.findMany({
    select: { googleCid: true, internalId: true },
    where: { googleCid: { not: null } },
  });

  // Return as object with CID as key, internalId as value for easy lookup
  const cidMap: Record<string, number> = {};
  for (const account of accounts) {
    if (account.googleCid) {
      // Normalize CID (remove dashes) for consistent comparison
      const normalizedCid = account.googleCid.replace(/-/g, '');
      cidMap[normalizedCid] = account.internalId;
    }
  }

  return NextResponse.json(cidMap);
}
