import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { put } from "@vercel/blob";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Extract file ID from Google Drive URL
 * Supports formats:
 * - https://drive.google.com/file/d/{fileId}/view
 * - https://drive.google.com/open?id={fileId}
 * - https://drive.google.com/uc?id={fileId}
 */
function extractGoogleDriveFileId(url: string): string | null {
  // Format: /file/d/{fileId}/
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) return fileIdMatch[1];

  // Format: ?id={fileId}
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];

  return null;
}

/**
 * Download file from Google Drive using direct download URL
 * Google Drive requires files to be shared with "Anyone with the link" to download without auth
 */
async function downloadFromGoogleDrive(fileId: string): Promise<{ buffer: ArrayBuffer; size: number }> {
  // Try the export download URL first (works for most files)
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  console.log(`Attempting to download from Google Drive: ${fileId}`);

  const response = await fetch(downloadUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
    },
  });

  console.log(`Google Drive response status: ${response.status}, content-type: ${response.headers.get("content-type")}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Google Drive file not found. Check that the file ID is correct.");
    }
    throw new Error(`Google Drive returned error ${response.status}. Make sure the file is shared publicly.`);
  }

  // Check if we got a virus scan warning page (for larger files) or access denied page
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = await response.text();
    console.log(`Got HTML response, length: ${html.length}`);

    // Check for access denied / not shared
    if (html.includes("Google Drive - Access Denied") || html.includes("You need access") || html.includes("Request access")) {
      throw new Error("Access denied. Make sure the file is shared with 'Anyone with the link' in Google Drive sharing settings.");
    }

    // Check for file not found
    if (html.includes("isn't available") || html.includes("file you requested does not exist")) {
      throw new Error("Google Drive file not found or has been deleted.");
    }

    // Google shows a confirmation page for larger files (virus scan warning)
    // Try to extract the confirmation token and retry
    const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);
    const uuidMatch = html.match(/uuid=([0-9A-Za-z_-]+)/);

    if (confirmMatch) {
      console.log("Found virus scan confirmation page, retrying with token...");
      let confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`;
      if (uuidMatch) {
        confirmUrl += `&uuid=${uuidMatch[1]}`;
      }

      const confirmResponse = await fetch(confirmUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
        },
      });

      if (!confirmResponse.ok) {
        throw new Error("Failed to download large file from Google Drive after virus scan confirmation.");
      }

      const confirmContentType = confirmResponse.headers.get("content-type") || "";
      if (confirmContentType.includes("text/html")) {
        throw new Error("Google Drive file could not be downloaded. It may require authentication or is too large for direct download.");
      }

      const buffer = await confirmResponse.arrayBuffer();
      console.log(`Downloaded ${buffer.byteLength} bytes after confirmation`);
      return { buffer, size: buffer.byteLength };
    }

    // If we can't find a confirm token, the file might not be properly shared
    throw new Error("Google Drive file is not accessible. Make sure it's shared with 'Anyone with the link' (not 'Restricted').");
  }

  const buffer = await response.arrayBuffer();
  console.log(`Downloaded ${buffer.byteLength} bytes directly`);

  // Sanity check - if the file is tiny, it might be an error page
  if (buffer.byteLength < 100) {
    throw new Error("Downloaded file is too small. The Google Drive link may be invalid or the file may not be shared properly.");
  }

  return { buffer, size: buffer.byteLength };
}

// POST /api/websites/[id]/upload - Upload zip file (direct or from Google Drive)
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

    // Check content type to determine upload method
    const contentType = request.headers.get("content-type") || "";

    let fileBuffer: ArrayBuffer;
    let fileName: string;
    let fileSize: number;

    if (contentType.includes("application/json")) {
      // Google Drive URL upload
      const body = await request.json();
      const { gdriveUrl } = body;

      if (!gdriveUrl || typeof gdriveUrl !== "string") {
        return NextResponse.json(
          { error: "Google Drive URL is required" },
          { status: 400 }
        );
      }

      const fileId = extractGoogleDriveFileId(gdriveUrl);
      if (!fileId) {
        return NextResponse.json(
          { error: "Invalid Google Drive URL. Use a share link like: https://drive.google.com/file/d/.../view" },
          { status: 400 }
        );
      }

      // Update status
      await prisma.website.update({
        where: { id },
        data: {
          status: "UPLOADING",
          statusMessage: "Downloading from Google Drive...",
        },
      });

      // Download from Google Drive
      const downloaded = await downloadFromGoogleDrive(fileId);
      fileBuffer = downloaded.buffer;
      fileSize = downloaded.size;
      fileName = `gdrive-${fileId}.zip`;

      // Validate file size
      if (fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        );
      }
    } else {
      // Direct file upload
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

      fileBuffer = await file.arrayBuffer();
      fileName = file.name;
      fileSize = file.size;
    }

    // Upload to Vercel Blob
    const blob = await put(
      `websites/${id}/${Date.now()}-${fileName}`,
      fileBuffer,
      { access: "public" }
    );

    // Update website with file info
    const updated = await prisma.website.update({
      where: { id },
      data: {
        zipFileUrl: blob.url,
        zipFileSize: fileSize,
        status: "PENDING",
        statusMessage: "Zip file uploaded. Ready to select domain.",
      },
    });

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "ZIP_UPLOADED",
        details: `Uploaded ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
      },
    });

    return NextResponse.json({
      success: true,
      website: updated,
      fileUrl: blob.url,
      fileSize: fileSize,
    });
  } catch (error) {
    console.error("Failed to upload file:", error);

    const errorMessage = error instanceof Error ? error.message : "Upload failed";

    // Try to update status to failed
    try {
      const { id } = await params;
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage,
        },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
