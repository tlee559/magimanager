import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { analyzeReferenceImage } from "@/lib/ads-image-creator-agent";

// POST /api/ai/ads-image-creator/reference/analyze - Analyze a reference image
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    console.log("[Ads Image Creator] Analyzing reference image:", imageUrl.substring(0, 100));

    const analysis = await analyzeReferenceImage(imageUrl);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[Ads Image Creator] Reference analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze image" },
      { status: 500 }
    );
  }
}
