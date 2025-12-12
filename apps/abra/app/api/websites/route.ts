import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

// GET /api/websites - List all websites
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const websites = await prisma.website.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({ websites });
  } catch (error) {
    console.error("Failed to fetch websites:", error);
    return NextResponse.json(
      { error: "Failed to fetch websites" },
      { status: 500 }
    );
  }
}

// POST /api/websites - Create new website entry
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Website name is required" },
        { status: 400 }
      );
    }

    const website = await prisma.website.create({
      data: {
        name: name.trim(),
        status: "PENDING",
        createdBy: auth.user!.id,
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: website.id,
        action: "CREATED",
        details: `Website "${name}" created`,
      },
    });

    return NextResponse.json({ website });
  } catch (error) {
    console.error("Failed to create website:", error);
    return NextResponse.json(
      { error: "Failed to create website" },
      { status: 500 }
    );
  }
}
