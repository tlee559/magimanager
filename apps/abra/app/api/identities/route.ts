// Custom route handler that extends core handler with document upload support
import { NextRequest, NextResponse } from "next/server";
import { identitiesGetHandler } from "@magimanager/core/api-handlers";
import { identityService } from "@magimanager/core/services";
import { broadcastEvent, CHANNELS } from "@magimanager/realtime";
import { requireManager } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import type { IdentityCreateInput } from "@magimanager/shared";

export const GET = identitiesGetHandler;

/**
 * Custom POST handler that handles document uploads during identity creation
 */
export async function POST(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const contentType = request.headers.get("content-type") || "";
    let data: IdentityCreateInput;
    let documents: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle form data with files
      const formData = await request.formData();

      // Extract identity data
      data = {
        fullName: formData.get("fullName") as string,
        dob: formData.get("dob") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        zipcode: formData.get("zipcode") as string | undefined,
        geo: formData.get("geo") as string,
        website: formData.get("website") as string | null,
        websiteNotes: formData.get("websiteNotes") as string | null,
        notes: formData.get("notes") as string | null,
        email: formData.get("email") as string | null,
        emailPassword: formData.get("emailPassword") as string | null,
        phone: formData.get("phone") as string | null,
        backupCodes: formData.get("backupCodes") as string | null,
        ccNumber: formData.get("ccNumber") as string | null,
        ccExp: formData.get("ccExp") as string | null,
        ccCvv: formData.get("ccCvv") as string | null,
        ccName: formData.get("ccName") as string | null,
        billingZip: formData.get("billingZip") as string | null,
      };

      // Extract documents from FormData
      const docEntries = formData.getAll("documents");
      documents = docEntries.filter((entry): entry is File => entry instanceof File);
    } else {
      data = await request.json();
    }

    // Normalize website URL - auto-add https:// if missing
    if (data.website && typeof data.website === 'string') {
      const trimmed = data.website.trim();
      if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        data.website = `https://${trimmed}`;
      }
    }

    // Create the identity using the service
    const result = await identityService.create(data, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const identity = result.data!;

    // Upload documents if any were provided
    if (documents.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      const maxSize = 10 * 1024 * 1024; // 10MB

      for (const file of documents) {
        // Validate file type
        if (!allowedTypes.includes(file.type)) {
          console.warn(`Skipping invalid file type: ${file.type}`);
          continue;
        }

        // Validate file size
        if (file.size > maxSize) {
          console.warn(`Skipping oversized file: ${file.name} (${file.size} bytes)`);
          continue;
        }

        try {
          // Upload to Vercel Blob
          const filename = `identity-docs/${identity.id}/${Date.now()}-${file.name}`;
          const blob = await put(filename, file, {
            access: 'public',
          });

          // Determine document type from file name or use generic
          let docType = 'document';
          const lowerName = file.name.toLowerCase();
          if (lowerName.includes('id') || lowerName.includes('license') || lowerName.includes('passport')) {
            docType = 'id';
          } else if (lowerName.includes('bank') || lowerName.includes('statement')) {
            docType = 'bank_statement';
          } else if (lowerName.includes('bill') || lowerName.includes('utility')) {
            docType = 'utility_bill';
          }

          // Save to database
          await prisma.identityDocument.create({
            data: {
              identityProfileId: identity.id,
              type: docType,
              filePath: blob.url,
            },
          });

          // Log activity
          await prisma.identityActivity.create({
            data: {
              identityProfileId: identity.id,
              action: 'DOCUMENT_UPLOADED',
              details: `Document uploaded during creation: ${file.name}`,
            },
          });
        } catch (uploadError) {
          console.error(`Failed to upload document ${file.name}:`, uploadError);
          // Continue with other documents even if one fails
        }
      }
    }

    // Broadcast real-time event
    await broadcastEvent(CHANNELS.IDENTITIES, "identity:created", {
      id: identity.id,
      fullName: identity.fullName,
    });

    return NextResponse.json(identity, { status: 201 });
  } catch (error) {
    console.error("POST /api/identities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
