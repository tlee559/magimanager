import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { prisma } from "@magimanager/database";
import { put } from "@vercel/blob";

// GET - List user's generated images
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const favoritesOnly = searchParams.get("favorites") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      userId: session.user.id,
      ...(favoritesOnly && { isFavorite: true }),
    };

    const [images, total] = await Promise.all([
      prisma.generatedImage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.generatedImage.count({ where }),
    ]);

    return NextResponse.json({
      images,
      total,
      hasMore: offset + images.length < total,
    });
  } catch (error) {
    console.error("Error fetching images:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }
}

// POST - Save a generated image
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, provider, aspectRatio, rawMode, imageUrl } = body;

    if (!prompt || !provider || !imageUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // If it's a base64 data URL, upload to Vercel Blob
    let finalUrl = imageUrl;
    if (imageUrl.startsWith("data:")) {
      const base64Data = imageUrl.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      const blob = await put(
        `ai-images/${session.user.id}/${Date.now()}.png`,
        buffer,
        {
          access: "public",
          contentType: "image/png",
        }
      );
      finalUrl = blob.url;
    }

    const image = await prisma.generatedImage.create({
      data: {
        userId: session.user.id,
        prompt,
        provider,
        aspectRatio: aspectRatio || "1:1",
        rawMode: rawMode || false,
        imageUrl: finalUrl,
      },
    });

    return NextResponse.json({ success: true, image });
  } catch (error) {
    console.error("Error saving image:", error);
    return NextResponse.json(
      { error: "Failed to save image" },
      { status: 500 }
    );
  }
}
