import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { put } from "@vercel/blob";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/websites/[id]/upload - Upload zip file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    // Check website exists
    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Only .zip files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Update status
    await prisma.website.update({
      where: { id },
      data: {
        status: "UPLOADING",
        statusMessage: "Uploading zip file...",
      },
    });

    // Upload to Vercel Blob
    const blob = await put(
      `websites/${id}/${Date.now()}-${file.name}`,
      file,
      { access: "public" }
    );

    // Update website with file info
    const updated = await prisma.website.update({
      where: { id },
      data: {
        zipFileUrl: blob.url,
        zipFileSize: file.size,
        status: "PENDING",
        statusMessage: "Zip file uploaded. Ready to select domain.",
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "ZIP_UPLOADED",
        details: `Uploaded ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      },
    });

    return NextResponse.json({
      success: true,
      website: updated,
      fileUrl: blob.url,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("Failed to upload file:", error);

    // Try to update status to failed
    try {
      const { id } = await params;
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Upload failed",
        },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
