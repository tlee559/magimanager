import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// POST /api/accounts/[id]/thread/messages - Add message to thread
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const userName = session.user.name || "Unknown";
    const { id: accountId } = await params;

    const body = await request.json();
    const { message } = body;

    if (!message || message.trim() === "") {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

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

    // Check permissions
    // ADMIN and SUPER_ADMIN can post to all threads
    // MEDIA_BUYER can only post to threads for their assigned accounts
    if (
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN" &&
      account.mediaBuyer?.userId !== userId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get or create thread
    let thread = await prisma.accountThread.findUnique({
      where: { adAccountId: accountId },
    });

    if (!thread) {
      thread = await prisma.accountThread.create({
        data: {
          adAccountId: accountId,
        },
      });
    }

    // Create message
    const newMessage = await prisma.threadMessage.create({
      data: {
        threadId: thread.id,
        authorId: userId,
        authorName: userName,
        authorRole: userRole,
        message: message.trim(),
        isRead: false,
      },
    });

    // Create notifications for other participants
    // If admin/super_admin posts, notify the media buyer (if assigned)
    // If media buyer posts, notify all admins
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
      // Notify media buyer if account is assigned
      if (account.mediaBuyer?.userId) {
        await prisma.notification.create({
          data: {
            userId: account.mediaBuyer.userId,
            type: "NEW_MESSAGE",
            title: "New message on account",
            message: `${userName} sent a message on account ${account.googleCid || accountId}`,
            entityId: accountId,
            entityType: "account",
            isRead: false,
          },
        });

        // Increment unread notifications count
        await prisma.user.update({
          where: { id: account.mediaBuyer.userId },
          data: {
            unreadNotifications: {
              increment: 1,
            },
          },
        });
      }
    } else if (userRole === "MEDIA_BUYER") {
      // Notify all admins and super admins
      const admins = await prisma.user.findMany({
        where: {
          OR: [{ role: "ADMIN" }, { role: "SUPER_ADMIN" }],
          status: "ACTIVE",
        },
        select: { id: true },
      });

      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: "NEW_MESSAGE",
            title: "New message from media buyer",
            message: `${userName} sent a message on account ${account.googleCid || accountId}`,
            entityId: accountId,
            entityType: "account",
            isRead: false,
          },
        });

        // Increment unread notifications count
        await prisma.user.update({
          where: { id: admin.id },
          data: {
            unreadNotifications: {
              increment: 1,
            },
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
    });
  } catch (error) {
    console.error("Failed to create message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
