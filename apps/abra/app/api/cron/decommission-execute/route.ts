// ============================================================================
// DECOMMISSION EXECUTE CRON - Execute scheduled decommission jobs
// Schedule: Daily at 10:00 AM PT (17:00 UTC) - 1 hour after check
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

  console.log("[Cron] Running decommission execute...");

  try {
    // Execute all scheduled jobs that are due
    const executeResult = await decommissionService.executeScheduledJobs();

    if (!executeResult.success) {
      console.error("[Cron] Failed to execute scheduled jobs:", executeResult.error);
      return NextResponse.json(
        { error: executeResult.error },
        { status: 500 }
      );
    }

    console.log(`[Cron] Executed ${executeResult.data} decommission jobs`);

    return NextResponse.json({
      success: true,
      executed: executeResult.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Decommission execute error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
