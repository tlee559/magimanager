import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get account counts by status
    const [
      totalAccounts,
      activeAccounts,
      warmingUpAccounts,
      readyAccounts,
      totalIdentities,
      pendingRequests,
      recentActivity,
    ] = await Promise.all([
      // Total accounts (not archived)
      prisma.adAccount.count({
        where: { handoffStatus: { not: "archived" } },
      }),
      // Active accounts (handed off and being used)
      prisma.adAccount.count({
        where: {
          handoffStatus: "handed-off",
          accountHealth: "active",
        },
      }),
      // Warming up accounts
      prisma.adAccount.count({
        where: { status: "warming-up" },
      }),
      // Ready for handoff
      prisma.adAccount.count({
        where: { status: "ready" },
      }),
      // Total identity profiles
      prisma.identityProfile.count({
        where: { archived: false },
      }),
      // Pending account requests
      prisma.accountRequest.count({
        where: { status: "PENDING" },
      }),
      // Recent activity
      prisma.accountActivity.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      totalAccounts,
      activeAccounts,
      warmingUpAccounts,
      readyAccounts,
      totalIdentities,
      pendingRequests,
      recentActivity,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
