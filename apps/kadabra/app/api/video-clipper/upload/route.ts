import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// Configure route for client uploads
export const runtime = "nodejs";

// POST /api/video-clipper/upload - Handle client-side upload to Vercel Blob
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

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
        const allowedExtensions = ["mp4", "webm", "mov", "avi", "mkv"];
        if (!allowedExtensions.includes(extension)) {
          throw new Error("Invalid file type. Supported: MP4, WebM, MOV, AVI, MKV");
        }

        return {
          allowedContentTypes: [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo",
            "video/x-matroska",
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called after upload is complete
        console.log("[Video Clipper] Upload completed:", blob.url);

        try {
          const { userId } = JSON.parse(tokenPayload || "{}");
          console.log("[Video Clipper] Upload by user:", userId);
        } catch (error) {
          console.error("[Video Clipper] Error in onUploadCompleted:", error);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[Video Clipper] Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
