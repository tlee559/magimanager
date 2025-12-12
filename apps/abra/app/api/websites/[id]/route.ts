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
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.website.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status }),
        ...(body.statusMessage !== undefined && { statusMessage: body.statusMessage }),
        ...(body.errorMessage !== undefined && { errorMessage: body.errorMessage }),
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
