// ============================================================================
// AUTHENTICATORS API HANDLER - Shared Next.js route handlers for TOTP authenticators
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { authenticatorService } from "../services";
import { requireAuth, requireManager } from "@magimanager/auth";
import type { AuthenticatorCreateInput, AuthenticatorUpdateInput, AuthenticatorPlatform } from "@magimanager/shared";

/**
 * Handler for GET /api/authenticators
 * Returns all authenticators with identity info (for standalone view)
 */
export async function authenticatorsGetAllHandler(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || undefined;

    const result = await authenticatorService.getAllWithIdentity({ platform });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ authenticators: result.data });
  } catch (error) {
    console.error("GET /api/authenticators error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/identities/[id]/authenticators
 * Returns all authenticators for an identity
 */
export async function authenticatorsGetHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await authenticatorService.getByIdentityId(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ authenticators: result.data });
  } catch (error) {
    console.error("GET /api/identities/[id]/authenticators error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/identities/[id]/authenticators/with-codes
 * Returns all authenticators for an identity with current TOTP codes
 */
export async function authenticatorsWithCodesHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await authenticatorService.getByIdentityIdWithCodes(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ authenticators: result.data });
  } catch (error) {
    console.error("GET /api/identities/[id]/authenticators/with-codes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/identities/[id]/authenticators
 * Creates a new authenticator
 */
export async function authenticatorPostHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { id: identityProfileId } = await params;
    const body = await request.json() as {
      name: string;
      platform?: AuthenticatorPlatform | null;
      issuer?: string | null;
      accountName?: string | null;
      secret: string;
      algorithm?: string;
      digits?: number;
      period?: number;
      notes?: string | null;
    };

    const data: AuthenticatorCreateInput = {
      identityProfileId,
      name: body.name,
      platform: body.platform ?? null,
      issuer: body.issuer || null,
      accountName: body.accountName || null,
      secret: body.secret,
      algorithm: body.algorithm || "SHA1",
      digits: body.digits || 6,
      period: body.period || 30,
      notes: body.notes || null,
    };

    const result = await authenticatorService.create(data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("POST /api/identities/[id]/authenticators error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/identities/[id]/authenticators/[authId]
 * Gets a single authenticator
 */
export async function authenticatorGetByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; authId: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { authId } = await params;
    const result = await authenticatorService.getById(authId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/identities/[id]/authenticators/[authId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for PUT /api/identities/[id]/authenticators/[authId]
 * Updates an authenticator
 */
export async function authenticatorPutHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; authId: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { authId } = await params;
    const body = await request.json() as {
      name?: string;
      platform?: AuthenticatorPlatform | null;
      notes?: string | null;
    };

    const data: AuthenticatorUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.platform !== undefined) data.platform = body.platform;
    if (body.notes !== undefined) data.notes = body.notes;

    const result = await authenticatorService.update(authId, data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PUT /api/identities/[id]/authenticators/[authId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for DELETE /api/identities/[id]/authenticators/[authId]
 * Deletes an authenticator
 */
export async function authenticatorDeleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; authId: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const { authId } = await params;
    const result = await authenticatorService.delete(authId, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/identities/[id]/authenticators/[authId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/identities/[id]/authenticators/[authId]/code
 * Gets the current TOTP code for an authenticator
 */
export async function authenticatorCodeHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; authId: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { authId } = await params;
    const result = await authenticatorService.getCode(authId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/identities/[id]/authenticators/[authId]/code error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/authenticators/parse-uri
 * Parses an otpauth:// URI and returns the extracted data
 */
export async function parseOtpUriHandler(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json() as { uri?: string };
    const { uri } = body;

    if (!uri) {
      return NextResponse.json({ error: "URI is required" }, { status: 400 });
    }

    const parsed = authenticatorService.parseOtpAuthUri(uri);

    if (!parsed) {
      return NextResponse.json({ error: "Invalid otpauth:// URI" }, { status: 400 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("POST /api/authenticators/parse-uri error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
