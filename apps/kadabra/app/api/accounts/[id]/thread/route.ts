import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET /api/accounts/[id]/thread - Get thread with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;
    const { id: accountId } = await params;

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
    // ADMIN and SUPER_ADMIN can view all threads
    // MEDIA_BUYER can only view threads for their assigned accounts
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
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!thread) {
      // Create thread if it doesn't exist
      thread = await prisma.accountThread.create({
        data: {
          adAccountId: accountId,
        },
        include: {
          messages: true,
        },
      });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error("Failed to fetch thread:", error);
    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 }
    );
  }
}
