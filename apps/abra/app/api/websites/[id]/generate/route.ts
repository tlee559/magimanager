import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { put } from "@vercel/blob";
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
    const { niche, description } = body as {
      niche: NicheType;
      description: string;
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

    // Get Google API key from settings
    const settings = await prisma.settings.findFirst();
    const googleApiKey = settings?.googleApiKey;

    if (!googleApiKey) {
      return NextResponse.json(
        { error: "Google API key not configured in settings" },
        { status: 400 }
      );
    }

    // Update website status
    await prisma.website.update({
      where: { id },
      data: { status: "UPLOADING" },
    });

    // Select random presets for uniqueness
    const presets = selectRandomPresets();

    // Generate content and images using AI
    const { content, images } = await generateWebsiteContent({
      apiKey: googleApiKey,
      niche,
      description: description.trim(),
      domain: website.domain || "example.com",
      colors: presets.colors,
    });

    // Assemble the website ZIP
    const zipBuffer = await assembleWebsiteFromFiles({
      niche,
      domain: website.domain || "example.com",
      content,
      images,
      presets,
    });

    // Upload ZIP to Vercel Blob
    const timestamp = Date.now();
    const filename = `websites/${id}/ai-generated-${timestamp}.zip`;

    const blob = await put(filename, zipBuffer, {
      access: "public",
      contentType: "application/zip",
    });

    // Update website with ZIP URL and AI metadata
    const updatedWebsite = await prisma.website.update({
      where: { id },
      data: {
        zipFileUrl: blob.url,
        status: "UPLOADED",
        aiGenerated: true,
        aiNiche: niche,
        aiPresets: JSON.stringify(getPresetInfo(presets)),
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

    return NextResponse.json({
      success: true,
      website: updatedWebsite,
      presets: getPresetInfo(presets),
      filesGenerated: [
        "index.html",
        "terms.html",
        "privacy.html",
        "play.html",
        "css/style.css",
        "css/slots.css",
        "js/slots.js",
        "images/hero.png",
        "images/feature1.png",
        "images/feature2.png",
      ],
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
