import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/media-buyers/[id] - Fetch single media buyer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const mediaBuyer = await prisma.mediaBuyer.findUnique({
      where: { id },
      include: {
        adAccounts: {
          include: {
            identityProfile: {
              include: {
                gologinProfile: true,
              },
            },
          },
        },
      },
    });

    if (!mediaBuyer) {
      return NextResponse.json(
        { error: "Media buyer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(mediaBuyer);
  } catch (error) {
    console.error("Failed to fetch media buyer:", error);
    return NextResponse.json(
      { error: "Failed to fetch media buyer" },
      { status: 500 }
    );
  }
}

// PATCH /api/media-buyers/[id] - Update media buyer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, notes, isActive } = body;

    // Check if media buyer exists
    const existing = await prisma.mediaBuyer.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Media buyer not found" },
        { status: 404 }
      );
    }

    // If email is being changed, check it's not already taken
    if (email && email !== existing.email) {
      const emailExists = await prisma.mediaBuyer.findUnique({
        where: { email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "A media buyer with this email already exists" },
          { status: 409 }
        );
      }
    }

    const mediaBuyer = await prisma.mediaBuyer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(mediaBuyer);
  } catch (error) {
    console.error("Failed to update media buyer:", error);
    return NextResponse.json(
      { error: "Failed to update media buyer" },
      { status: 500 }
    );
  }
}

// DELETE /api/media-buyers/[id] - Delete media buyer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if media buyer has assigned accounts
    const mediaBuyer = await prisma.mediaBuyer.findUnique({
      where: { id },
      include: {
        adAccounts: true,
      },
    });

    if (!mediaBuyer) {
      return NextResponse.json(
        { error: "Media buyer not found" },
        { status: 404 }
      );
    }

    if (mediaBuyer.adAccounts.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete media buyer with assigned accounts. Unassign accounts first.",
        },
        { status: 400 }
      );
    }

    await prisma.mediaBuyer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete media buyer:", error);
    return NextResponse.json(
      { error: "Failed to delete media buyer" },
      { status: 500 }
    );
  }
}
