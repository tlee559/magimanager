// ============================================================================
// IDENTITIES API HANDLER - Shared Next.js route handlers for identities
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { identityService } from "../services";
import { broadcastEvent, CHANNELS } from "@magimanager/realtime";
import { requireAuth, requireManager, requireAdmin } from "@magimanager/auth";
import type { IdentityCreateInput, IdentityUpdateInput } from "@magimanager/shared";

/**
 * Normalize website URL - auto-add https:// if missing
 */
function normalizeWebsite(website: string | null | undefined): string | null {
  if (!website || typeof website !== 'string') return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Handler for GET /api/identities
 */
export async function identitiesGetHandler(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";
    const geo = searchParams.get("geo") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await identityService.getAll({
      includeArchived,
      geo,
      search,
      includeDocuments: true,
      includeGologin: true,
      includeAccounts: true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ identities: result.data });
  } catch (error) {
    console.error("GET /api/identities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/identities
 */
export async function identitiesPostHandler(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const contentType = request.headers.get("content-type") || "";
    let data: IdentityCreateInput;

    if (contentType.includes("multipart/form-data")) {
      // Handle form data with files
      const formData = await request.formData();
      data = {
        fullName: formData.get("fullName") as string,
        dob: formData.get("dob") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        zipcode: formData.get("zipcode") as string | undefined,
        geo: formData.get("geo") as string,
        website: formData.get("website") as string | null,
        websiteNotes: formData.get("websiteNotes") as string | null,
        notes: formData.get("notes") as string | null,
        email: formData.get("email") as string | null,
        emailPassword: formData.get("emailPassword") as string | null,
        phone: formData.get("phone") as string | null,
        backupCodes: formData.get("backupCodes") as string | null,
        ccNumber: formData.get("ccNumber") as string | null,
        ccExp: formData.get("ccExp") as string | null,
        ccCvv: formData.get("ccCvv") as string | null,
        ccName: formData.get("ccName") as string | null,
        billingZip: formData.get("billingZip") as string | null,
      };
    } else {
      data = await request.json();
    }

    // Normalize website URL
    if (data.website !== undefined) {
      data.website = normalizeWebsite(data.website);
    }

    const result = await identityService.create(data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Broadcast real-time event
    await broadcastEvent(CHANNELS.IDENTITIES, "identity:created", {
      id: result.data!.id,
      fullName: result.data!.fullName,
    });

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("POST /api/identities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/identities/[id]
 */
export async function identityGetByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await identityService.getById(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/identities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for PUT /api/identities/[id]
 */
export async function identityPutHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { id } = await params;
    const data: IdentityUpdateInput = await request.json();

    // Normalize website URL
    if (data.website !== undefined) {
      data.website = normalizeWebsite(data.website);
    }

    const result = await identityService.update(id, data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Broadcast real-time event
    await broadcastEvent(CHANNELS.IDENTITIES, "identity:updated", {
      id,
      changes: data,
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PUT /api/identities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for PATCH /api/identities/[id]
 */
export async function identityPatchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { id } = await params;
    const data: IdentityUpdateInput = await request.json();

    // Normalize website URL
    if (data.website !== undefined) {
      data.website = normalizeWebsite(data.website);
    }

    const result = await identityService.update(id, data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Broadcast real-time event
    await broadcastEvent(CHANNELS.IDENTITIES, "identity:updated", {
      id,
      changes: data,
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PATCH /api/identities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for DELETE /api/identities/[id]
 */
export async function identityDeleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { id } = await params;
    const result = await identityService.delete(id, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/identities/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/identities/geos
 */
export async function identityGeosHandler() {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const geos = await identityService.getUniqueGeos();
    return NextResponse.json({ geos });
  } catch (error) {
    console.error("GET /api/identities/geos error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
