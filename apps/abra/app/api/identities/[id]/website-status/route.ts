import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@magimanager/auth";
import { prisma } from "@magimanager/database";
import { fireIdentityProgressAlert } from "@magimanager/core/services";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const { websiteCompleted } = await request.json();
    const newValue = Boolean(websiteCompleted);

    // Get current identity to check if status changed
    const identity = await prisma.identityProfile.findUnique({
      where: { id },
      select: { fullName: true, website: true, websiteCompleted: true },
    });

    if (!identity) {
      return NextResponse.json({ error: "Identity not found" }, { status: 404 });
    }

    // Only update if value actually changed
    if (identity.websiteCompleted === newValue) {
      return NextResponse.json({ id, websiteCompleted: newValue });
    }

    const updated = await prisma.identityProfile.update({
      where: { id },
      data: { websiteCompleted: newValue },
      select: {
        id: true,
        websiteCompleted: true,
      },
    });

    // Fire notification if website was marked completed (not when un-marking)
    if (newValue === true) {
      await fireIdentityProgressAlert({
        identityId: id,
        identityName: identity.fullName,
        progressType: "website_completed",
        details: identity.website || undefined,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/identities/[id]/website-status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
