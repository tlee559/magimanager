import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";
import {
  selectRandomPresets,
  generateWebsiteContent,
  assembleWebsiteFromFiles,
  getPresetInfo,
  type NicheType,
} from "@magimanager/core";

// POST /api/websites/[id]/generate - Generate AI website
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { niche, description, fileType = "html" } = body as {
      niche: NicheType;
      description: string;
      fileType?: "html" | "php";
    };

    // Validate niche
    if (niche !== "social-casino") {
      return NextResponse.json(
        { error: "Only social-casino niche is currently supported" },
        { status: 400 }
      );
    }

    // Validate description
    if (!description || description.trim().length < 10) {
      return NextResponse.json(
        { error: "Please provide a description of at least 10 characters" },
        { status: 400 }
      );
    }

    // Get website
    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    // Get Google API key from env (same as Kadabra) or settings as fallback
    const googleApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!googleApiKey) {
      // Try settings as fallback
      const settings = await prisma.appSettings.findFirst();
      if (!settings?.googleApiKey) {
        return NextResponse.json(
          { error: "Google API key not configured" },
          { status: 400 }
        );
      }
    }

    const apiKey = googleApiKey || (await prisma.appSettings.findFirst())?.googleApiKey;

    // Update website status
    await prisma.website.update({
      where: { id },
      data: { status: "UPLOADING" },
    });

    // Select random presets for uniqueness
    const presets = selectRandomPresets();

    // Use domain if available, otherwise convert website name to domain-like format
    const siteDomain = website.domain || `${website.name.toLowerCase().replace(/\s+/g, "-")}.com`;

    // Generate content and images using AI
    console.log("[Generate] Starting AI content generation...");
    const { content, images } = await generateWebsiteContent({
      apiKey: apiKey!,
      niche,
      description: description.trim(),
      domain: siteDomain,
      colors: presets.colors,
    });

    // Log image sizes for debugging
    console.log("[Generate] Image sizes:", {
      hero: images.hero.length,
      features: images.features.map((f, i) => `feature${i + 1}: ${f.length}`),
    });

    // Assemble the website ZIP
    const zipBuffer = await assembleWebsiteFromFiles({
      niche,
      domain: siteDomain,
      content,
      images,
      presets,
      fileType,
    });

    // Upload ZIP to Vercel Blob
    const timestamp = Date.now();
    const filename = `websites/${id}/ai-generated-${timestamp}.zip`;

    const blob = await put(filename, zipBuffer, {
      access: "public",
      contentType: "application/zip",
    });

    // Generate preview token for unauthenticated preview access
    const previewToken = randomBytes(32).toString("hex");

    // Update website with ZIP URL and AI metadata
    const updatedWebsite = await prisma.website.update({
      where: { id },
      data: {
        zipFileUrl: blob.url,
        status: "PENDING",
        statusMessage: "AI-generated website ready. Proceed to create server.",
        aiGenerated: true,
        aiNiche: niche,
        aiPresets: JSON.stringify(getPresetInfo(presets)),
        previewToken,
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "AI_GENERATED",
        details: `AI-generated ${niche} website with ${presets.colors.name} theme`,
      },
    });

    const ext = fileType === "php" ? ".php" : ".html";

    return NextResponse.json({
      success: true,
      website: updatedWebsite,
      previewToken,
      presets: getPresetInfo(presets),
      fileType,
      filesGenerated: [
        `index${ext}`,
        `terms${ext}`,
        `privacy${ext}`,
        `play${ext}`,
        "css/style.css",
        "css/slots.css",
        "js/slots.js",
        "images/hero.png",
        ...images.features.map((_, i) => `images/feature${i + 1}.png`),
      ],
      imageSizes: {
        hero: images.hero.length,
        features: images.features.map((f) => f.length),
      },
    });
  } catch (error) {
    console.error("Website generation failed:", error);

    // Update website status to failed
    const { id } = await params;
    await prisma.website.update({
      where: { id },
      data: { status: "FAILED" },
    }).catch(() => {});

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Website generation failed",
      },
      { status: 500 }
    );
  }
}
