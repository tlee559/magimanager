import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// PATCH /api/accounts/[id]/thread/messages/[msgId] - Edit message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;
    const { id: accountId, msgId: messageId } = await params;

    const body = await request.json();
    const { message, markAsRead } = body;

    // Get account to check permissions
    const account = await prisma.adAccount.findUnique({
      where: { id: accountId },
      include: {
        mediaBuyer: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Check permissions - user must have access to this account
    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN" &&
      account.mediaBuyer?.userId !== userId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the message to check ownership
    const existingMessage = await prisma.threadMessage.findUnique({
      where: { id: messageId },
    });

    if (!existingMessage) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // If just marking as read
    if (markAsRead && !message) {
      await prisma.threadMessage.update({
        where: { id: messageId },
        data: { isRead: true },
      });

      return NextResponse.json({
        success: true,
        message: "Message marked as read",
      });
    }

    // For editing, user must be the author OR an admin
    if (existingMessage.authorId !== userId && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "You can only edit your own messages" },
        { status: 403 }
      );
    }

    if (!message || message.trim() === "") {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    // Update the message
    const updatedMessage = await prisma.threadMessage.update({
      where: { id: messageId },
      data: {
        message: message.trim(),
        editedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: updatedMessage,
    });
  } catch (error) {
    console.error("Failed to update message:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

// DELETE /api/accounts/[id]/thread/messages/[msgId] - Delete message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;
    const { id: accountId, msgId: messageId } = await params;

    // Get account to check permissions
    const account = await prisma.adAccount.findUnique({
      where: { id: accountId },
      include: {
        mediaBuyer: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Check permissions - user must have access to this account
    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN" &&
      account.mediaBuyer?.userId !== userId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the message to check ownership
    const existingMessage = await prisma.threadMessage.findUnique({
      where: { id: messageId },
    });

    if (!existingMessage) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // User must be the author OR an admin to delete
    if (existingMessage.authorId !== userId && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "You can only delete your own messages" },
        { status: 403 }
      );
    }

    // Delete the message
    await prisma.threadMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({
      success: true,
      message: "Message deleted",
    });
  } catch (error) {
    console.error("Failed to delete message:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
