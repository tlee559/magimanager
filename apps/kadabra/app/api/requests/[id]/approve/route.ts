import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// PATCH /api/requests/[id]/approve - Approve account request (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    const reviewerId = session.user.id;

    // Only admins and managers can approve requests
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: requestId } = await params;

    // Get the request
    const accountRequest = await prisma.accountRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: {
          include: {
            mediaBuyer: true,
          },
        },
      },
    });

    if (!accountRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (accountRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Request has already been reviewed" },
        { status: 400 }
      );
    }

    // Update request status to APPROVED - admin will complete the pipeline
    const updatedRequest = await prisma.accountRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        userId: accountRequest.requesterId,
        type: "REQUEST_APPROVED",
        title: "Account request approved",
        message: "Your account request has been approved and is being processed",
        entityId: requestId,
        entityType: "request",
        isRead: false,
      },
    });

    await prisma.user.update({
      where: { id: accountRequest.requesterId },
      data: {
        unreadNotifications: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Request approved - proceed to create identity profile",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Failed to approve request:", error);
    return NextResponse.json(
      { error: "Failed to approve request" },
      { status: 500 }
    );
  }
}
