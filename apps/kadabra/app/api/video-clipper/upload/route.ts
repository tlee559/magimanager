import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// Configure route for client uploads
export const runtime = "nodejs";

// Max file size: 1GB (matches client-side validation)
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB

// POST /api/video-clipper/upload - Handle client-side upload to Vercel Blob
// Supports both regular and multipart uploads for large files
export async function POST(req: NextRequest) {
  console.log("[Video Clipper Upload] Received request");
  console.log("[Video Clipper Upload] Request URL:", req.url);

  // Check if BLOB token is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[Video Clipper Upload] BLOB_READ_WRITE_TOKEN not configured");
    return NextResponse.json(
      { error: "Server configuration error: Blob storage not configured" },
      { status: 500 }
    );
  }

  // Log token prefix for debugging (not the full token)
  const tokenPrefix = process.env.BLOB_READ_WRITE_TOKEN.substring(0, 20);
  console.log(`[Video Clipper Upload] Token prefix: ${tokenPrefix}...`);

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
    console.log(`[Video Clipper Upload] Request type: ${body.type}`);
    console.log(`[Video Clipper Upload] Body payload:`, JSON.stringify(body).substring(0, 200));
  } catch (parseError) {
    console.error("[Video Clipper Upload] Failed to parse request body:", parseError);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        console.log(`[Video Clipper Upload] onBeforeGenerateToken called for: ${pathname}`);

        // Authenticate the user
        const session = await getServerSession(authOptions);
        if (!session?.user) {
          console.error("[Video Clipper Upload] No session found - unauthorized");
          throw new Error("Unauthorized - please log in");
        }

        const userId = (session.user as { id: string }).id;
        console.log(`[Video Clipper Upload] User authenticated: ${userId}`);

        // Validate file extension
        const extension = pathname.split(".").pop()?.toLowerCase() || "";
        const allowedExtensions = ["mp4", "webm", "mov", "avi", "mkv", "m4v"];
        if (!allowedExtensions.includes(extension)) {
          console.error(`[Video Clipper Upload] Invalid extension: ${extension}`);
          throw new Error("Invalid file type. Supported: MP4, WebM, MOV, AVI, MKV, M4V");
        }

        console.log(`[Video Clipper Upload] Generating token for: ${pathname}`);

        return {
          allowedContentTypes: [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo",
            "video/x-matroska",
            "video/x-m4v",
          ],
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      // Note: onUploadCompleted is optional and called asynchronously by Vercel
      // It doesn't block the upload response
    });

    console.log("[Video Clipper Upload] handleUpload succeeded");
    console.log("[Video Clipper Upload] Response:", JSON.stringify(jsonResponse).substring(0, 200));
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[Video Clipper Upload] handleUpload failed:");
    console.error("[Video Clipper Upload] Error message:", errorMessage);
    console.error("[Video Clipper Upload] Error stack:", errorStack);
    console.error("[Video Clipper Upload] Request body type:", body?.type);

    // Provide more specific error messages
    let userMessage = errorMessage;
    if (errorMessage.includes("BlobAccessError") || errorMessage.includes("access")) {
      userMessage = "Blob storage access error. Please contact support.";
    } else if (errorMessage.includes("token")) {
      userMessage = "Storage token error. Please contact support.";
    }

    return NextResponse.json(
      {
        error: userMessage,
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 400 }
    );
  }
}
