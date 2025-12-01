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
  const startTime = Date.now();
  console.log("[Video Clipper Upload] Received request");

  // Check if BLOB token is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[Video Clipper Upload] BLOB_READ_WRITE_TOKEN not configured");
    return NextResponse.json(
      { error: "Server configuration error: Blob storage not configured" },
      { status: 500 }
    );
  }

  const body = (await req.json()) as HandleUploadBody;
  console.log(`[Video Clipper Upload] Request type: ${body.type}`);

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate the user
        const session = await getServerSession(authOptions);
        if (!session?.user) {
          throw new Error("Unauthorized");
        }

        const userId = (session.user as { id: string }).id;

        // Validate file extension
        const extension = pathname.split(".").pop()?.toLowerCase() || "";
        const allowedExtensions = ["mp4", "webm", "mov", "avi", "mkv", "m4v"];
        if (!allowedExtensions.includes(extension)) {
          throw new Error("Invalid file type. Supported: MP4, WebM, MOV, AVI, MKV, M4V");
        }

        console.log(`[Video Clipper Upload] Generating token for: ${pathname} (user: ${userId})`);

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
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called after upload is complete
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Video Clipper Upload] Complete: ${blob.url}`);
        console.log(`[Video Clipper Upload] Duration: ${durationSec}s`);

        try {
          const { userId } = JSON.parse(tokenPayload || "{}");
          console.log(`[Video Clipper Upload] User: ${userId}`);
        } catch (error) {
          console.error("[Video Clipper Upload] Error in onUploadCompleted:", error);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[Video Clipper Upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
