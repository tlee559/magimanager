// ============================================================================
// TEAM API HANDLER - Shared Next.js route handlers for team/users
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { userService } from "../services";
import { requireAuth, requireAdmin, requireSuperAdmin } from "@magimanager/auth";
import type { UserCreateInput, UserUpdateInput } from "@magimanager/shared";

/**
 * Handler for GET /api/team
 */
export async function teamGetHandler() {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const result = await userService.getAll({
      includeMediaBuyer: true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ users: result.data });
  } catch (error) {
    console.error("GET /api/team error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/team
 */
export async function teamPostHandler(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const data: UserCreateInput = await request.json();
    const result = await userService.create(data);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("POST /api/team error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/team/[id]
 */
export async function teamMemberGetHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await userService.getById(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/team/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for PATCH /api/team/[id]
 */
export async function teamMemberPatchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const data: UserUpdateInput = await request.json();
    const result = await userService.update(id, data);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PATCH /api/team/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for DELETE /api/team/[id]
 */
export async function teamMemberDeleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await userService.delete(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/team/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/team/[id]/reset-password
 */
export async function resetPasswordHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await userService.resetPassword(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("POST /api/team/[id]/reset-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/team/change-password
 */
export async function changePasswordHandler(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    const result = await userService.changePassword(userId, currentPassword, newPassword);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/team/change-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/profile - Get current user's profile
 */
export async function profileGetHandler() {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await userService.getById(userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    // Return user data without password
    const { password: _, ...userData } = result.data as unknown as Record<string, unknown>;
    return NextResponse.json(userData);
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for PATCH /api/profile - Update current user's profile
 */
export async function profilePatchHandler(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, email } = await request.json();

    // Only allow updating name and email
    const updateData: UserUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    const result = await userService.update(userId, updateData);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PATCH /api/profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
