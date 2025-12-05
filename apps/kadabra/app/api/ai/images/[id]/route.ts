import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { prisma } from "@magimanager/database";
import { Prisma } from "@prisma/client";

// PATCH - Update image (favorite, text layers)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Verify ownership
    const image = await prisma.generatedImage.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Build update data - only include fields that are provided
    const updateData: Prisma.GeneratedImageUpdateInput = {};

    if (body.isFavorite !== undefined) {
      updateData.isFavorite = body.isFavorite;
    }

    // Allow updating text layers (for editing text after save)
    if (body.textLayers !== undefined) {
      updateData.textLayers = body.textLayers && body.textLayers.length > 0
        ? body.textLayers
        : Prisma.DbNull;
    }

    const updated = await prisma.generatedImage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, image: updated });
  } catch (error) {
    console.error("Error updating image:", error);
    return NextResponse.json(
      { error: "Failed to update image" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an image
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const image = await prisma.generatedImage.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    await prisma.generatedImage.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
