// ============================================================================
// DECOMMISSION CHECK CRON - Daily check for auto-decommission triggers
// Schedule: Daily at 9:00 AM PT (16:00 UTC)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { decommissionService } from "@magimanager/core/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret for Vercel
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development without secret
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("[Cron] Running decommission check...");

  try {
    // Schedule auto-decommissions based on settings
    const scheduleResult = await decommissionService.scheduleAutoDecommissions();

    if (!scheduleResult.success) {
      console.error("[Cron] Failed to schedule auto-decommissions:", scheduleResult.error);
      return NextResponse.json(
        { error: scheduleResult.error },
        { status: 500 }
      );
    }

    console.log(`[Cron] Scheduled ${scheduleResult.data} auto-decommission jobs`);

    return NextResponse.json({
      success: true,
      scheduled: scheduleResult.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Decommission check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
