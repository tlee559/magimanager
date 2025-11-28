// ============================================================================
// ACCOUNTS API HANDLER - Shared Next.js route handlers for accounts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { accountService } from "../services";
import { broadcastEvent, CHANNELS } from "@magimanager/realtime";
import { requireAuth, requireManager, requireAdmin } from "@magimanager/auth";
import type { AdAccountCreateInput, AdAccountUpdateInput, AlertType } from "@magimanager/shared";

/**
 * Handler for GET /api/accounts
 */
export async function accountsGetHandler(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const unassignedOnly = searchParams.get("unassigned") === "true";

    const result = await accountService.getAll({
      unassignedOnly,
      includeIdentity: true,
      includeMediaBuyer: true,
      includeConnection: true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Return in format expected by modals
    if (unassignedOnly) {
      return NextResponse.json({ accounts: result.data });
    }

    return NextResponse.json({ accounts: result.data });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/accounts
 */
export async function accountsPostHandler(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const data: AdAccountCreateInput = await request.json();
    const result = await accountService.create(data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Broadcast real-time event
    await broadcastEvent(CHANNELS.ACCOUNTS, "account:created", {
      id: result.data!.id,
      internalId: result.data!.internalId,
    });

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/accounts/[id]
 */
export async function accountGetByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await accountService.getById(id, {
      includeIdentity: true,
      includeMediaBuyer: true,
      includeConnection: true,
      includeCheckIns: true,
      includeActivities: true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/accounts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for PATCH /api/accounts/[id]
 */
export async function accountPatchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { id } = await params;
    const data: AdAccountUpdateInput = await request.json();

    const result = await accountService.update(id, data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Broadcast real-time event
    await broadcastEvent(CHANNELS.ACCOUNTS, "account:updated", {
      id,
      changes: data,
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PATCH /api/accounts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for DELETE /api/accounts/[id]
 */
export async function accountDeleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const forceDelete = url.searchParams.get("force") === "true";

    const result = await accountService.delete(id, userId, forceDelete);

    if (!result.success) {
      // Check for conflict response (blockers)
      if (result.error?.includes("related data")) {
        return NextResponse.json(
          { error: result.error, canForceDelete: true },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Broadcast real-time event
    await broadcastEvent(CHANNELS.ACCOUNTS, "account:deleted", { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/accounts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/accounts/[id]/check-in
 */
export async function accountCheckInHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { id } = await params;
    const data = await request.json();

    const result = await accountService.addCheckIn(id, data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("POST /api/accounts/[id]/check-in error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/accounts/[id]/assign
 */
export async function accountAssignHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { id } = await params;
    const { mediaBuyerId, notes } = await request.json();

    const result = await accountService.assignToMediaBuyer(id, mediaBuyerId, notes, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Broadcast real-time event
    await broadcastEvent(CHANNELS.ACCOUNTS, "account:handed-off", {
      id,
      mediaBuyerId,
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("POST /api/accounts/[id]/assign error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/accounts/needs-attention
 */
export async function needsAttentionHandler() {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const result = await accountService.getNeedsAttention();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/accounts/needs-attention error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/accounts/alerts/dismiss
 */
export async function dismissAlertHandler(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { accountId, alertType }: { accountId: string; alertType: AlertType } = await request.json();

    const result = await accountService.dismissAlert(accountId, alertType, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/accounts/alerts/dismiss error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
