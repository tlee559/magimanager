import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const activitySchema = z.object({
  action: z.string().min(1).max(100),
  details: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
});

// GET /api/accounts/[id]/activity - Get activity timeline for an account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const action = searchParams.get("action"); // Optional filter by action type

  try {
    // Verify account exists
    const account = await prisma.adAccount.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const whereClause = {
      adAccountId: id,
      ...(action && { action }),
    };

    const [activities, total] = await Promise.all([
      prisma.accountActivity.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.accountActivity.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      activities,
      total,
      hasMore: offset + activities.length < total,
    });
  } catch (error) {
    console.error(`GET /api/accounts/${id}/activity error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

// POST /api/accounts/[id]/activity - Add an activity entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const result = activitySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    // Verify account exists
    const account = await prisma.adAccount.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const activity = await prisma.accountActivity.create({
      data: {
        adAccountId: id,
        action: result.data.action,
        details: result.data.details || null,
        createdBy: result.data.createdBy || null,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error(`POST /api/accounts/${id}/activity error:`, error);
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}
