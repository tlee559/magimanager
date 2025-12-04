import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { MAX_FILE_SIZE, ALLOWED_TYPES } from '@/lib/video-clipper/constants';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log('[VideoClipper] Upload request received');

  // Check for blob token
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[VideoClipper] BLOB_READ_WRITE_TOKEN not configured');
    return NextResponse.json(
      { error: 'Storage not configured' },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json()) as HandleUploadBody;
    console.log('[VideoClipper] Upload body type:', body.type);

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        console.log('[VideoClipper] Generating token for:', pathname);

        // Parse client payload for validation
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        const { size, type } = payload;

        // Validate file size
        if (size && size > MAX_FILE_SIZE) {
          throw new Error(`File too large. Maximum size is 1GB.`);
        }

        // Validate file type
        if (type && !ALLOWED_TYPES.includes(type)) {
          throw new Error(`Invalid file type. Use MP4, MOV, or WebM.`);
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({
            uploadedAt: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[VideoClipper] Upload completed:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[VideoClipper] Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
