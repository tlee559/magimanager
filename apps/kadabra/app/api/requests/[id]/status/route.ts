import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// PATCH /api/requests/[id]/status - Update request status (admin only)
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

    // Only admins and managers can update request status
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN" && userRole !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: requestId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    // Validate the status is a valid RequestStatus
    const validStatuses = [
      "PENDING",
      "APPROVED",
      "PROFILE_CREATED",
      "GOLOGIN_SETUP",
      "ACCOUNT_CREATED",
      "ASSIGNED",
      "ACTIVE",
      "REJECTED",
      "ARCHIVED",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Get the request
    const accountRequest = await prisma.accountRequest.findUnique({
      where: { id: requestId },
    });

    if (!accountRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Update request status
    const updatedRequest = await prisma.accountRequest.update({
      where: { id: requestId },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      message: `Request status updated to ${status}`,
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Failed to update request status:", error);
    return NextResponse.json(
      { error: "Failed to update request status" },
      { status: 500 }
    );
  }
}
