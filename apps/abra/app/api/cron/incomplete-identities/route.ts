import { NextRequest, NextResponse } from "next/server";
import { isValidCronRequest } from "@magimanager/auth";
import { fireDailyIncompleteIdentityAlerts } from "@magimanager/core";

// GET /api/cron/incomplete-identities - Daily check for incomplete identity profiles
// Called by Vercel Cron at 9 AM PT daily (same time as daily report)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronRequest(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting incomplete identities check...");

    const result = await fireDailyIncompleteIdentityAlerts();

    console.log(`[Cron] Incomplete identities check complete: ${result.alertCount} alerts sent`);

    return NextResponse.json({
      success: true,
      alertCount: result.alertCount,
      identities: result.identities,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Incomplete identities cron error:", error);
    return NextResponse.json(
      { error: "Failed to check incomplete identities" },
      { status: 500 }
    );
  }
}
