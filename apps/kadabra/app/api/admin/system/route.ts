import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/system
 * Super Admin endpoint - returns system-wide data for the admin dashboard
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN can access this endpoint
    const userRole = session.user.role;
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    // Fetch all data in parallel for performance
    const [
      oauthConnections,
      userCount,
      accountStats,
      identityStats,
      goLoginStats,
      recentActivity,
      appSettings,
    ] = await Promise.all([
      // OAuth Connections with linked accounts count
      prisma.googleAdsConnection.findMany({
        include: {
          _count: {
            select: { adAccounts: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // User counts by role
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),

      // Account stats
      prisma.adAccount.aggregate({
        _count: { id: true },
        _sum: { currentSpendTotal: true, todaySpend: true },
      }),

      // Identity stats
      prisma.identityProfile.aggregate({
        _count: { id: true },
      }),

      // GoLogin profile stats
      prisma.goLoginProfile.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // Recent account activity (last 24 hours)
      prisma.accountActivity.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        include: {
          adAccount: {
            include: {
              identityProfile: { select: { fullName: true } },
            },
          },
          createdByUser: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),

      // App settings
      prisma.appSettings.findFirst(),
    ]);

    // Format OAuth connections
    const formattedConnections = oauthConnections.map((conn) => ({
      id: conn.id,
      googleEmail: conn.googleEmail,
      status: conn.status,
      linkedAccounts: conn._count.adAccounts,
      lastSyncAt: conn.lastSyncAt,
      lastSyncError: conn.lastSyncError,
      createdAt: conn.createdAt,
      tokenExpiresAt: conn.tokenExpiresAt,
    }));

    // Format user counts
    const usersByRole = userCount.reduce((acc, u) => {
      acc[u.role] = u._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Format GoLogin stats
    const goLoginByStatus = goLoginStats.reduce((acc, g) => {
      acc[g.status] = g._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Format activity
    const formattedActivity = recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details,
      accountName: a.adAccount?.identityProfile?.fullName || a.adAccount?.googleCid || "Unknown",
      createdBy: a.createdByUser?.name || "System",
      createdAt: a.createdAt,
    }));

    // Check integrations from env vars and DB settings
    const telegramConfigured = !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
    const goLoginConfigured = !!appSettings?.gologinApiKey;
    const googleAdsConfigured = !!appSettings?.googleAdsApiKey || !!process.env.GOOGLE_CLIENT_ID;

    // Check system health
    const systemHealth = {
      oauthHealthy: formattedConnections.length === 0 || formattedConnections.every((c) => c.status === "active"),
      hasExpiredTokens: formattedConnections.some(
        (c) => new Date(c.tokenExpiresAt) < new Date()
      ),
      goLoginConfigured,
      telegramConfigured,
    };

    return NextResponse.json({
      oauthConnections: formattedConnections,
      users: {
        total: Object.values(usersByRole).reduce((a, b) => a + b, 0),
        byRole: usersByRole,
      },
      accounts: {
        total: accountStats._count.id,
        totalSpend: accountStats._sum.currentSpendTotal || 0,
        todaySpend: accountStats._sum.todaySpend || 0,
      },
      identities: {
        total: identityStats._count.id,
      },
      goLogin: {
        total: Object.values(goLoginByStatus).reduce((a, b) => a + b, 0),
        byStatus: goLoginByStatus,
      },
      recentActivity: formattedActivity,
      systemHealth,
      settings: {
        goLoginConfigured,
        telegramConfigured,
        googleAdsConfigured,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/system error:", error);
    return NextResponse.json(
      { error: "Failed to fetch system data" },
      { status: 500 }
    );
  }
}
