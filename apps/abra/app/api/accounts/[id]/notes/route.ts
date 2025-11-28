import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PATCH /api/accounts/[id]/notes - Update account notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { notes } = body;

    const account = await prisma.adAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const updatedAccount = await prisma.adAccount.update({
      where: { id },
      data: {
        notes: notes || null,
      },
      include: {
        identityProfile: {
          include: {
            gologinProfile: true,
          },
        },
        mediaBuyer: true,
      },
    });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("Failed to update account notes:", error);
    return NextResponse.json(
      { error: "Failed to update account notes" },
      { status: 500 }
    );
  }
}
