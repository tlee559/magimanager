import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// PATCH /api/requests/[id]/reject - Reject account request (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const reviewerId = (session.user as any).id;

    // Only admins and managers can reject requests
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: requestId } = await params;
    const body = await request.json();
    const { rejectionReason } = body;

    if (!rejectionReason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    // Get the request
    const accountRequest = await prisma.accountRequest.findUnique({
      where: { id: requestId },
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

    // Update request status
    await prisma.accountRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        rejectionReason: rejectionReason.trim(),
      },
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        userId: accountRequest.requesterId,
        type: "REQUEST_REJECTED",
        title: "Account request rejected",
        message: `Your account request was rejected: ${rejectionReason}`,
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
      message: "Request rejected",
    });
  } catch (error) {
    console.error("Failed to reject request:", error);
    return NextResponse.json(
      { error: "Failed to reject request" },
      { status: 500 }
    );
  }
}
