import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@magimanager/database";
import { compositeAdImage, AD_FORMATS, type AdFormatKey } from "@/lib/ads-image-compositor";
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes max for export

// POST /api/ai/ads-image-creator/projects/[projectId]/export - Export images in multiple formats
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { projectId } = await params;

    const body = await req.json();
    const {
      imageIds,
      formats = ["facebook-feed", "instagram-square", "gdn-medium-rectangle"],
      includeTextOverlay = true,
    } = body as {
      imageIds?: string[];
      formats?: AdFormatKey[];
      includeTextOverlay?: boolean;
    };

    // Fetch the project with images
    const project = await prisma.adImageProject.findFirst({
      where: { id: projectId, userId },
      include: {
        images: imageIds
          ? { where: { id: { in: imageIds } } }
          : true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.images.length === 0) {
      return NextResponse.json(
        { error: "No images to export" },
        { status: 400 }
      );
    }

    console.log(`[Export] Exporting ${project.images.length} images in ${formats.length} formats`);

    // Create ZIP archive
    const zip = new JSZip();

    // Process each image
    for (const image of project.images) {
      if (!image.backgroundUrl) continue;

      const imageName = `image-${image.id.slice(0, 8)}`;
      const imageFolder = zip.folder(imageName);
      if (!imageFolder) continue;

      // Generate each format
      for (const formatKey of formats) {
        const format = AD_FORMATS[formatKey];
        if (!format) continue;

        try {
          // If includeTextOverlay, use compositor to add text
          if (includeTextOverlay && (image.headlineUsed || image.ctaUsed)) {
            const result = await compositeAdImage({
              backgroundUrl: image.backgroundUrl,
              headline: image.headlineUsed || undefined,
              ctaText: image.ctaUsed || undefined,
              outputWidth: format.width,
              outputHeight: format.height,
              outputFormat: "jpeg",
            });

            imageFolder.file(`${formatKey}.jpg`, result.buffer);
          } else {
            // Just resize the background image
            const response = await fetch(image.backgroundUrl);
            if (!response.ok) continue;
            const arrayBuffer = await response.arrayBuffer();

            // Import sharp dynamically for resizing
            const sharp = (await import("sharp")).default;
            const resized = await sharp(Buffer.from(arrayBuffer))
              .resize(format.width, format.height, {
                fit: "cover",
                position: "center",
              })
              .jpeg({ quality: 90 })
              .toBuffer();

            imageFolder.file(`${formatKey}.jpg`, resized);
          }
        } catch (err) {
          console.error(`[Export] Error generating ${formatKey} for ${imageName}:`, err);
        }
      }

      // Add metadata file
      const metadata = {
        id: image.id,
        headline: image.headlineUsed,
        cta: image.ctaUsed,
        angle: image.angleUsed,
        rationale: image.creativeRationale,
        scores: {
          hook: image.hookScore,
          clarity: image.clarityScore,
          cta: image.ctaScore,
          overall: image.overallScore,
        },
      };
      imageFolder.file("metadata.json", JSON.stringify(metadata, null, 2));
    }

    // Add project summary
    const projectSummary = {
      projectId: project.id,
      name: project.name,
      productDescription: project.productDescription,
      exportedAt: new Date().toISOString(),
      totalImages: project.images.length,
      formats: formats,
      images: project.images.map((img) => ({
        id: img.id,
        headline: img.headlineUsed,
        cta: img.ctaUsed,
        angle: img.angleUsed,
        overallScore: img.overallScore,
      })),
    };
    zip.file("project-summary.json", JSON.stringify(projectSummary, null, 2));

    // Generate ZIP
    const zipBuffer = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Return ZIP file as blob
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name || "ad-images"}-export.zip"`,
      },
    });
  } catch (error) {
    console.error("[Export] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}

// GET /api/ai/ads-image-creator/projects/[projectId]/export - Get available export formats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return available formats grouped by platform
    return NextResponse.json({
      formats: {
        google: [
          { key: "gdn-medium-rectangle", name: "Medium Rectangle", dimensions: "300x250" },
          { key: "gdn-large-rectangle", name: "Large Rectangle", dimensions: "336x280" },
          { key: "gdn-leaderboard", name: "Leaderboard", dimensions: "728x90" },
          { key: "gdn-half-page", name: "Half Page", dimensions: "300x600" },
          { key: "gdn-large-mobile-banner", name: "Large Mobile Banner", dimensions: "320x100" },
        ],
        facebook: [
          { key: "facebook-feed", name: "Feed", dimensions: "1200x628" },
          { key: "facebook-story", name: "Story", dimensions: "1080x1920" },
          { key: "facebook-carousel", name: "Carousel", dimensions: "1080x1080" },
        ],
        instagram: [
          { key: "instagram-square", name: "Square", dimensions: "1080x1080" },
          { key: "instagram-portrait", name: "Portrait", dimensions: "1080x1350" },
          { key: "instagram-story", name: "Story", dimensions: "1080x1920" },
        ],
        linkedin: [
          { key: "linkedin-single", name: "Single Image", dimensions: "1200x627" },
          { key: "linkedin-square", name: "Square", dimensions: "1200x1200" },
        ],
        twitter: [
          { key: "twitter-single", name: "Single Image", dimensions: "1200x675" },
          { key: "twitter-card", name: "Card", dimensions: "800x418" },
        ],
      },
    });
  } catch (error) {
    console.error("[Export] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get formats" },
      { status: 500 }
    );
  }
}
