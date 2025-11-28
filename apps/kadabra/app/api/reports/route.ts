import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

// GET /api/reports - Generate daily or weekly report
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "daily"; // "daily" | "weekly"
  const format = searchParams.get("format") || "json"; // "json" | "csv"

  try {
    // Calculate date range
    const now = new Date();
    const startDate = new Date();

    if (type === "weekly") {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setHours(0, 0, 0, 0); // Start of today
    }

    // Fetch all accounts with their recent check-ins
    const accounts = await prisma.adAccount.findMany({
      include: {
        identityProfile: {
          select: {
            id: true,
            fullName: true,
            geo: true,
            email: true,
            website: true,
          },
        },
        mediaBuyer: {
          select: {
            id: true,
            name: true,
          },
        },
        checkIns: {
          where: {
            checkedAt: {
              gte: startDate,
            },
          },
          orderBy: {
            checkedAt: "desc",
          },
        },
        activities: {
          where: {
            createdAt: {
              gte: startDate,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Build report data
    const reportData = accounts.map((account) => {
      const latestCheckIn = account.checkIns[0];
      const totalDailySpend = account.checkIns.reduce(
        (sum, ci) => sum + Number(ci.dailySpend),
        0
      );

      // Get issues from latest check-in
      const issues = latestCheckIn?.issues || null;

      // Get recent activity summary
      const recentActivities = account.activities
        .slice(0, 3)
        .map((a) => a.action)
        .join(", ");

      return {
        // Account Info
        accountId: account.id,
        googleCid: account.googleCid || "N/A",
        mccId: account.mccId || "N/A",

        // Identity Info
        identityName: account.identityProfile?.fullName || "Unlinked",
        geo: account.identityProfile?.geo || "N/A",
        email: account.identityProfile?.email || "N/A",
        website: account.identityProfile?.website || "N/A",

        // Status
        accountHealth: account.accountHealth,
        billingStatus: account.billingStatus,
        certStatus: account.certStatus || "N/A",
        handoffStatus: account.handoffStatus,

        // Media Buyer
        mediaBuyer: account.mediaBuyer?.name || "Unassigned",

        // Metrics
        currentSpendTotal: (account.currentSpendTotal / 100).toFixed(2),
        periodSpend: totalDailySpend.toFixed(2),
        adsCount: account.adsCount,
        campaignsCount: account.campaignsCount,

        // Check-in Info
        lastCheckIn: latestCheckIn?.checkedAt?.toISOString() || "Never",
        checkInsCount: account.checkIns.length,

        // Issues & Activity
        issues: issues || "None",
        recentActivity: recentActivities || "None",
      };
    });

    // Summary statistics
    const summary = {
      reportType: type,
      generatedAt: now.toISOString(),
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      totals: {
        accounts: accounts.length,
        activeAccounts: accounts.filter((a) => a.accountHealth === "active").length,
        limitedAccounts: accounts.filter((a) => a.accountHealth === "limited").length,
        suspendedAccounts: accounts.filter((a) => a.accountHealth === "suspended" || a.accountHealth === "banned").length,
        pendingBilling: accounts.filter((a) => a.billingStatus === "pending").length,
        totalSpend: accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0) / 100,
        periodCheckIns: accounts.reduce((sum, a) => sum + a.checkIns.length, 0),
      },
    };

    if (format === "csv") {
      // Generate CSV
      const headers = [
        "Google CID",
        "MCC ID",
        "Identity Name",
        "Geo",
        "Email",
        "Website",
        "Account Health",
        "Billing Status",
        "Cert Status",
        "Handoff Status",
        "Media Buyer",
        "Total Spend ($)",
        "Period Spend ($)",
        "Ads Count",
        "Campaigns",
        "Last Check-In",
        "Check-Ins",
        "Issues",
        "Recent Activity",
      ];

      const rows = reportData.map((row) => [
        row.googleCid,
        row.mccId,
        row.identityName,
        row.geo,
        row.email,
        row.website,
        row.accountHealth,
        row.billingStatus,
        row.certStatus,
        row.handoffStatus,
        row.mediaBuyer,
        row.currentSpendTotal,
        row.periodSpend,
        row.adsCount,
        row.campaignsCount,
        row.lastCheckIn,
        row.checkInsCount,
        `"${row.issues.replace(/"/g, '""')}"`,
        `"${row.recentActivity.replace(/"/g, '""')}"`,
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${type}-report-${now.toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Return JSON
    return NextResponse.json({
      summary,
      accounts: reportData,
    });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
