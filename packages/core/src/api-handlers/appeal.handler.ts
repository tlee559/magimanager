// ============================================================================
// APPEAL API HANDLER - Shared Next.js route handlers for appeal tracking
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { appealTrackingService } from "../services";
import { requireAuth, requireManager } from "@magimanager/auth";
import type { AppealMethod, AppealResolution } from "@magimanager/shared";

/**
 * Handler for GET /api/accounts/[id]/appeal
 * Get appeal tracking for an account
 */
export async function appealGetHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await appealTrackingService.getByAccountId(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ appealTracking: result.data });
  } catch (error) {
    console.error("GET /api/accounts/[id]/appeal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/accounts/[id]/appeal
 * Start or update appeal tracking
 */
export async function appealPostHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if tracking exists
    const existingResult = await appealTrackingService.getByAccountId(id);

    if (!existingResult.success) {
      return NextResponse.json({ error: existingResult.error }, { status: 500 });
    }

    let result;

    if (!existingResult.data) {
      // Create new tracking
      result = await appealTrackingService.startAppealTracking(id);
    } else {
      // Update existing tracking
      result = await appealTrackingService.updateAppeal(id, {
        appealNotes: body.appealNotes,
        appealDeadline: body.appealDeadline ? new Date(body.appealDeadline) : undefined,
      });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ appealTracking: result.data });
  } catch (error) {
    console.error("POST /api/accounts/[id]/appeal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for PATCH /api/accounts/[id]/appeal
 * Update appeal tracking details
 */
export async function appealPatchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

    const result = await appealTrackingService.updateAppeal(id, {
      appealNotes: body.appealNotes,
      appealDeadline: body.appealDeadline !== undefined
        ? (body.appealDeadline ? new Date(body.appealDeadline) : null)
        : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ appealTracking: result.data });
  } catch (error) {
    console.error("PATCH /api/accounts/[id]/appeal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/accounts/[id]/appeal/attempt
 * Log a new appeal attempt
 */
export async function appealAttemptHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { method } = body as { method: AppealMethod };

    if (!method) {
      return NextResponse.json({ error: "method is required" }, { status: 400 });
    }

    const validMethods: AppealMethod[] = ["form", "email", "phone", "chat"];
    if (!validMethods.includes(method)) {
      return NextResponse.json({ error: "Invalid method. Must be one of: form, email, phone, chat" }, { status: 400 });
    }

    const result = await appealTrackingService.logAppealAttempt(id, method);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ appealTracking: result.data });
  } catch (error) {
    console.error("POST /api/accounts/[id]/appeal/attempt error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/accounts/[id]/appeal/resolve
 * Resolve an appeal
 */
export async function appealResolveHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { resolution } = body as { resolution: AppealResolution };

    if (!resolution) {
      return NextResponse.json({ error: "resolution is required" }, { status: 400 });
    }

    const validResolutions: AppealResolution[] = ["reinstated", "banned", "abandoned"];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json({ error: "Invalid resolution. Must be one of: reinstated, banned, abandoned" }, { status: 400 });
    }

    const result = await appealTrackingService.resolveAppeal(id, resolution);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ appealTracking: result.data });
  } catch (error) {
    console.error("POST /api/accounts/[id]/appeal/resolve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/appeals
 * Get all active appeals
 */
export async function appealsGetHandler(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const result = await appealTrackingService.getActiveAppeals();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ appeals: result.data });
  } catch (error) {
    console.error("GET /api/appeals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/appeals/deadlines
 * Get appeals with approaching deadlines
 */
export async function appealsDeadlinesHandler(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "3", 10);

    const result = await appealTrackingService.getApproachingDeadlines(days);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ appeals: result.data });
  } catch (error) {
    console.error("GET /api/appeals/deadlines error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
