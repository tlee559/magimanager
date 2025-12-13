import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require("jszip");

// GET /api/websites/[id]/preview - Get preview URL or serve preview content
// Supports token-based access for iframe preview (no auth required with valid token)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file") || "index.html";
  const token = searchParams.get("token");

  // Check if token-based access (for iframe preview)
  let authorized = false;
  if (token) {
    const website = await prisma.website.findUnique({
      where: { id },
      select: { previewToken: true },
    });
    authorized = website?.previewToken === token;
  }

  // If no valid token, require authentication
  if (!authorized) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.error;
  }

  try {

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    if (!website.zipFileUrl) {
      return NextResponse.json(
        { error: "No ZIP file uploaded" },
        { status: 400 }
      );
    }

    // Fetch the ZIP file
    const zipResponse = await fetch(website.zipFileUrl);
    if (!zipResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch ZIP file" },
        { status: 500 }
      );
    }

    const zipBuffer = await zipResponse.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    // Get the requested file from ZIP
    const zipFile = zip.file(file);
    if (!zipFile) {
      return NextResponse.json(
        { error: `File ${file} not found in ZIP` },
        { status: 404 }
      );
    }

    // Determine content type
    let contentType = "text/html";
    let isBinary = false;

    if (file.endsWith(".css")) {
      contentType = "text/css";
    } else if (file.endsWith(".js")) {
      contentType = "application/javascript";
    } else if (file.endsWith(".json")) {
      contentType = "application/json";
    } else if (file.endsWith(".png")) {
      contentType = "image/png";
      isBinary = true;
    } else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
      contentType = "image/jpeg";
      isBinary = true;
    } else if (file.endsWith(".gif")) {
      contentType = "image/gif";
      isBinary = true;
    } else if (file.endsWith(".svg")) {
      contentType = "image/svg+xml";
    } else if (file.endsWith(".webp")) {
      contentType = "image/webp";
      isBinary = true;
    }

    // Handle binary files (images)
    if (isBinary) {
      const binaryContent = await zipFile.async("uint8array");
      return new NextResponse(binaryContent, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const content = await zipFile.async("string");

    // Build token query param if present
    const tokenParam = token ? `&token=${token}` : "";

    // For HTML files, rewrite relative URLs to go through the preview API
    let processedContent = content;
    if (file.endsWith(".html")) {
      // Rewrite CSS links
      processedContent = processedContent.replace(
        /href="css\//g,
        `href="/api/websites/${id}/preview?file=css/`
      );
      processedContent = processedContent.replace(
        /href='css\//g,
        `href='/api/websites/${id}/preview?file=css/`
      );

      // Rewrite JS links
      processedContent = processedContent.replace(
        /src="js\//g,
        `src="/api/websites/${id}/preview?file=js/`
      );
      processedContent = processedContent.replace(
        /src='js\//g,
        `src='/api/websites/${id}/preview?file=js/`
      );

      // Rewrite image links
      processedContent = processedContent.replace(
        /src="images\//g,
        `src="/api/websites/${id}/preview?file=images/`
      );
      processedContent = processedContent.replace(
        /src='images\//g,
        `src='/api/websites/${id}/preview?file=images/`
      );

      // Rewrite navigation links
      processedContent = processedContent.replace(
        /href="index\.html"/g,
        `href="/api/websites/${id}/preview?file=index.html${tokenParam}"`
      );
      processedContent = processedContent.replace(
        /href="terms\.html"/g,
        `href="/api/websites/${id}/preview?file=terms.html${tokenParam}"`
      );
      processedContent = processedContent.replace(
        /href="privacy\.html"/g,
        `href="/api/websites/${id}/preview?file=privacy.html${tokenParam}"`
      );
      processedContent = processedContent.replace(
        /href="play\.html"/g,
        `href="/api/websites/${id}/preview?file=play.html${tokenParam}"`
      );

      // Add token to all rewritten asset URLs (CSS, JS, images)
      if (token) {
        processedContent = processedContent.replace(
          new RegExp(`/api/websites/${id}/preview\\?file=([^"']+)`, "g"),
          `/api/websites/${id}/preview?file=$1${tokenParam}`
        );
      }
    }

    return new NextResponse(processedContent, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Preview failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 }
    );
  }
}

// POST /api/websites/[id]/preview - Get preview info
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    if (!website.zipFileUrl) {
      return NextResponse.json(
        { error: "No ZIP file uploaded" },
        { status: 400 }
      );
    }

    // Fetch the ZIP to list files
    const zipResponse = await fetch(website.zipFileUrl);
    if (!zipResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch ZIP file" },
        { status: 500 }
      );
    }

    const zipBuffer = await zipResponse.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    // List all files in ZIP
    const files: string[] = [];
    zip.forEach((relativePath: string) => {
      files.push(relativePath);
    });

    return NextResponse.json({
      previewUrl: `/api/websites/${id}/preview?file=index.html`,
      files,
      aiGenerated: website.aiGenerated,
      aiNiche: website.aiNiche,
      aiPresets: website.aiPresets ? JSON.parse(website.aiPresets) : null,
    });
  } catch (error) {
    console.error("Preview info failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview info failed" },
      { status: 500 }
    );
  }
}
