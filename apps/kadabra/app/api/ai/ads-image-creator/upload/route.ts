import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// POST /api/ai/ads-image-creator/upload - Handle client-side uploads
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Validate the upload
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB max
          tokenPayload: JSON.stringify({
            userId,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("[Ads Image Creator] Upload completed:", blob.url);
        // Could store upload metadata in database here if needed
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[Ads Image Creator] Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
