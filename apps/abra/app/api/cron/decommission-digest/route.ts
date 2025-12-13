// ============================================================================
// DECOMMISSION DIGEST CRON - Send daily summary of decommission status
// Schedule: Daily at 9:00 AM PT (16:00 UTC)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { decommissionService, appealTrackingService } from "@magimanager/core/services";

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

  console.log("[Cron] Running decommission digest...");

  try {
    // Send daily digest
    await decommissionService.sendDailyDigest();

    // Also send appeal deadline reminders
    await appealTrackingService.sendDeadlineReminders();

    console.log("[Cron] Sent decommission digest and appeal reminders");

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Decommission digest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
