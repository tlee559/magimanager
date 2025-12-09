import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@magimanager/auth";
import { prisma } from "@magimanager/database";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const { websiteCompleted } = await request.json();

    const updated = await prisma.identityProfile.update({
      where: { id },
      data: { websiteCompleted: Boolean(websiteCompleted) },
      select: {
        id: true,
        websiteCompleted: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/identities/[id]/website-status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
