import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

// GET /api/websites/[id] - Get website details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    const website = await prisma.website.findUnique({
      where: { id },
      include: {
        identityProfile: {
          select: { id: true, fullName: true, geo: true },
        },
        activities: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ website });
  } catch (error) {
    console.error("Failed to fetch website:", error);
    return NextResponse.json(
      { error: "Failed to fetch website" },
      { status: 500 }
    );
  }
}

// DELETE /api/websites/[id] - Delete/archive website
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    // For now, hard delete. Could change to soft delete later.
    await prisma.website.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete website:", error);
    return NextResponse.json(
      { error: "Failed to delete website" },
      { status: 500 }
    );
  }
}

// PATCH /api/websites/[id] - Update website
// Supports identity assignment via identityProfileId field
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

    const website = await prisma.website.findUnique({
      where: { id },
      include: { identityProfile: true },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    // Handle identity assignment/unassignment
    let identityUpdateData: { identityProfileId?: string | null } = {};
    if (body.identityProfileId !== undefined) {
      const previousIdentityId = website.identityProfileId;

      // Validate identity exists if assigning
      if (body.identityProfileId !== null) {
        const identity = await prisma.identityProfile.findUnique({
          where: { id: body.identityProfileId },
          include: { linkedWebsite: true },
        });

        if (!identity) {
          return NextResponse.json(
            { error: "Identity not found" },
            { status: 404 }
          );
        }

        // Check if identity already has a linked website (1:1 constraint)
        if (identity.linkedWebsite && identity.linkedWebsite.id !== id) {
          return NextResponse.json(
            { error: "Identity already has a linked website" },
            { status: 400 }
          );
        }
      }

      // If unassigning, reset websiteCompleted on the previous identity
      if (body.identityProfileId === null && previousIdentityId) {
        await prisma.identityProfile.update({
          where: { id: previousIdentityId },
          data: { websiteCompleted: false },
        });
      }

      identityUpdateData = { identityProfileId: body.identityProfileId };
    }

    const updated = await prisma.website.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status }),
        ...(body.statusMessage !== undefined && { statusMessage: body.statusMessage }),
        ...(body.errorMessage !== undefined && { errorMessage: body.errorMessage }),
        ...identityUpdateData,
      },
      include: {
        identityProfile: {
          select: { id: true, fullName: true, geo: true },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({ website: updated });
  } catch (error) {
    console.error("Failed to update website:", error);
    return NextResponse.json(
      { error: "Failed to update website" },
      { status: 500 }
    );
  }
}
