import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  const user = auth.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  try {
    // For media buyers, get accounts assigned to them
    // For super admins, get ALL accounts (full visibility)
    // For admins, get all handed-off accounts
    let whereClause: Record<string, unknown> = user.role === "MEDIA_BUYER" && user.mediaBuyerId
      ? { mediaBuyerId: user.mediaBuyerId, handoffStatus: "handed-off" }
      : user.role === "SUPER_ADMIN"
      ? {} // Super admins see ALL accounts
      : user.role === "ADMIN"
      ? { handoffStatus: "handed-off" }
      : { mediaBuyerId: "none" }; // Return no accounts for other roles

    // Exclude archived unless explicitly requested
    if (!includeArchived) {
      whereClause = { ...whereClause, handoffStatus: { not: "archived" } };
    }

    const accounts = await prisma.adAccount.findMany({
      where: whereClause,
      include: {
        identityProfile: {
          select: {
            id: true,
            fullName: true,
            geo: true,
          },
        },
      },
      orderBy: { handoffDate: "desc" },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Failed to fetch my accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
