import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/debug/db-test - Test database connection
export async function GET() {
  const startTime = Date.now();

  try {
    // Simple count query
    const count = await prisma.adAccount.count();
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      accountCount: count,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("DB test error:", error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
