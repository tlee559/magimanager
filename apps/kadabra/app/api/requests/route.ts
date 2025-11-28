import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET /api/requests - List account requests (filtered by role)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    let requests;

    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "MANAGER") {
      // Admins and managers see all requests (excluding archived)
      requests = await prisma.accountRequest.findMany({
        where: {
          status: {
            not: "ARCHIVED",
          },
        },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else if (userRole === "MEDIA_BUYER") {
      // Media buyers only see their own requests (excluding archived)
      requests = await prisma.accountRequest.findMany({
        where: {
          requesterId: userId,
          status: {
            not: "ARCHIVED",
          },
        },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else {
      // All other users see their own requests (excluding archived)
      requests = await prisma.accountRequest.findMany({
        where: {
          requesterId: userId,
          status: {
            not: "ARCHIVED",
          },
        },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Failed to fetch requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

// POST /api/requests - Create new account request (media buyer only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userName = session.user.name || "Unknown";

    const body = await request.json();
    const { type, justification, existingAccountId } = body;

    // Validation
    if (!type) {
      return NextResponse.json(
        { error: "Request type is required" },
        { status: 400 }
      );
    }

    // Justification is required for CREATE_NEW requests
    if (type === "CREATE_NEW" && !justification?.trim()) {
      return NextResponse.json(
        { error: "Justification is required for new account requests" },
        { status: 400 }
      );
    }

    if (type !== "CLAIM_EXISTING" && type !== "CREATE_NEW") {
      return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
    }

    if (type === "CLAIM_EXISTING" && !existingAccountId) {
      return NextResponse.json(
        { error: "existingAccountId is required for CLAIM_EXISTING requests" },
        { status: 400 }
      );
    }

    // If claiming existing account, validate it exists and is available
    if (type === "CLAIM_EXISTING") {
      const account = await prisma.adAccount.findUnique({
        where: { id: existingAccountId },
      });

      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }

      if (account.handoffStatus !== "available") {
        return NextResponse.json(
          { error: "Account is not available" },
          { status: 400 }
        );
      }

      // Check if there's already a pending request for this account
      const existingRequest = await prisma.accountRequest.findFirst({
        where: {
          existingAccountId,
          status: "PENDING",
        },
      });

      if (existingRequest) {
        return NextResponse.json(
          { error: "There is already a pending request for this account" },
          { status: 409 }
        );
      }
    }

    // Create request
    const newRequest = await prisma.accountRequest.create({
      data: {
        requesterId: userId,
        type,
        justification: justification?.trim() || "",
        existingAccountId: type === "CLAIM_EXISTING" ? existingAccountId : null,
        status: "PENDING",
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Notify all admins and managers
    const admins = await prisma.user.findMany({
      where: {
        OR: [{ role: "ADMIN" }, { role: "SUPER_ADMIN" }, { role: "MANAGER" }],
        status: "ACTIVE",
      },
      select: { id: true },
    });

    const requestTypeLabel =
      type === "CLAIM_EXISTING" ? "claim an account" : "create a new account";

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: "ACCOUNT_ASSIGNED",
          title: "New account request",
          message: `${userName} requested to ${requestTypeLabel}`,
          entityId: newRequest.id,
          entityType: "request",
          isRead: false,
        },
      });

      await prisma.user.update({
        where: { id: admin.id },
        data: {
          unreadNotifications: {
            increment: 1,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      request: newRequest,
    });
  } catch (error) {
    console.error("Failed to create request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
