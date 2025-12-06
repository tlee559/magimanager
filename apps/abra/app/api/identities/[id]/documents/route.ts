import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { put, del } from '@vercel/blob';
import { fireIdentityProgressAlert } from '@magimanager/core/services';

/**
 * GET /api/identities/[id]/documents
 * List all documents for an identity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const documents = await prisma.identityDocument.findMany({
      where: { identityProfileId: id },
      orderBy: { uploadedAt: 'desc' },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/identities/[id]/documents
 * Upload a new document for an identity
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify identity exists
    const identity = await prisma.identityProfile.findUnique({
      where: { id },
    });

    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!type) {
      return NextResponse.json({ error: 'Document type required' }, { status: 400 });
    }

    // Validate file type (images and PDFs only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF allowed.' },
        { status: 400 }
      );
    }

    // Max 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Max 10MB allowed.' },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const filename = `identity-docs/${id}/${Date.now()}-${file.name}`;

    let blob;
    try {
      blob = await put(filename, file, {
        access: 'public',
      });
    } catch (blobError) {
      console.error('Vercel Blob upload failed:', blobError);
      const errorMessage = blobError instanceof Error ? blobError.message : 'Unknown blob error';
      return NextResponse.json(
        { error: `Blob upload failed: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Save to database
    const document = await prisma.identityDocument.create({
      data: {
        identityProfileId: id,
        type,
        filePath: blob.url,
      },
    });

    // Log activity
    await prisma.identityActivity.create({
      data: {
        identityProfileId: id,
        action: 'DOCUMENT_UPLOADED',
        details: `Document uploaded: ${type}`,
      },
    });

    // Fire progress alert
    await fireIdentityProgressAlert({
      identityId: id,
      identityName: identity.fullName,
      progressType: 'document_added',
      details: file.name,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error uploading document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to upload document: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/identities/[id]/documents
 * Delete a document (documentId in query params)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    // Find the document
    const document = await prisma.identityDocument.findFirst({
      where: {
        id: documentId,
        identityProfileId: id,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from Vercel Blob
    try {
      await del(document.filePath);
    } catch (blobError) {
      console.error('Failed to delete from blob storage:', blobError);
      // Continue anyway - file might already be deleted
    }

    // Delete from database
    await prisma.identityDocument.delete({
      where: { id: documentId },
    });

    // Log activity
    await prisma.identityActivity.create({
      data: {
        identityProfileId: id,
        action: 'DOCUMENT_DELETED',
        details: `Document deleted: ${document.type}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
