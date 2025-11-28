import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/api-auth";

// GET /api/media-buyers - Fetch all media buyers
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) return auth.error;

  try {
    const mediaBuyers = await prisma.mediaBuyer.findMany({
      include: {
        adAccounts: {
          include: {
            identityProfile: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(mediaBuyers);
  } catch (error) {
    console.error("Failed to fetch media buyers:", error);
    return NextResponse.json(
      { error: "Failed to fetch media buyers" },
      { status: 500 }
    );
  }
}

// POST /api/media-buyers - Create a new media buyer
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { name, email, phone, notes } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.mediaBuyer.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A media buyer with this email already exists" },
        { status: 409 }
      );
    }

    const mediaBuyer = await prisma.mediaBuyer.create({
      data: {
        name,
        email,
        phone: phone || null,
        notes: notes || null,
        isActive: true,
      },
    });

    return NextResponse.json(mediaBuyer, { status: 201 });
  } catch (error) {
    console.error("Failed to create media buyer:", error);
    return NextResponse.json(
      { error: "Failed to create media buyer" },
      { status: 500 }
    );
  }
}
