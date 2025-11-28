import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth-options";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mediaBuyerId?: string | null;
}

interface AuthResult {
  authorized: boolean;
  session: Awaited<ReturnType<typeof getServerSession>> | null;
  user: SessionUser | null;
  error?: NextResponse;
}

function extractSessionUser(session: Awaited<ReturnType<typeof getServerSession>>): SessionUser | null {
  const sessionAny = session as any;
  if (!sessionAny?.user) return null;

  return {
    id: sessionAny.user.id,
    email: sessionAny.user.email,
    name: sessionAny.user.name,
    role: sessionAny.user.role as UserRole,
    mediaBuyerId: sessionAny.user.mediaBuyerId,
  };
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authorized: false,
      session: null,
      user: null,
      error: NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    session,
    user: extractSessionUser(session),
  };
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authorized: false,
      session: null,
      user: null,
      error: NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      ),
    };
  }

  const user = extractSessionUser(session);

  if (!user?.role || !allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      session,
      user,
      error: NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, session, user };
}

export async function requireAdmin(): Promise<AuthResult> {
  return requireRole(["SUPER_ADMIN", "ADMIN"]);
}

export async function requireSuperAdmin(): Promise<AuthResult> {
  return requireRole(["SUPER_ADMIN"]);
}

export async function requireManager(): Promise<AuthResult> {
  return requireRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
}

// Super Admin implicit access - they can see all accounts without being explicitly assigned
export function canAccessAccount(user: SessionUser, accountMediaBuyerId: string | null): boolean {
  // SUPER_ADMIN and ADMIN have implicit access to ALL accounts
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
    return true;
  }

  // MANAGER has implicit read access to all accounts
  if (user.role === "MANAGER") {
    return true;
  }

  // MEDIA_BUYER only sees accounts explicitly assigned to them
  if (user.role === "MEDIA_BUYER" && user.mediaBuyerId) {
    return accountMediaBuyerId === user.mediaBuyerId;
  }

  return false;
}

// Get Prisma filter for accounts based on user role
export function getAccountFilter(user: SessionUser): Record<string, any> {
  // SUPER_ADMIN, ADMIN, MANAGER see all accounts
  if (["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.role)) {
    return {};
  }

  // MEDIA_BUYER only sees their assigned, handed-off accounts
  if (user.role === "MEDIA_BUYER" && user.mediaBuyerId) {
    return {
      mediaBuyerId: user.mediaBuyerId,
      handoffStatus: "handed-off",
    };
  }

  // ASSISTANT - no access
  return { id: "never-match" };
}
