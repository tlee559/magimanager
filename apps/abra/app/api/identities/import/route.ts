/**
 * Batch import endpoint for identity profiles from CSV data
 */
import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@magimanager/auth";
import { identityService } from "@magimanager/core/services";
import { broadcastEvent, CHANNELS } from "@magimanager/realtime";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import {
  downloadGoogleDriveFile,
  isGoogleDriveUrl,
} from "@magimanager/core/utils/google-drive";
import { normalizeDateString } from "@magimanager/core/utils/csv-parser";
import type { IdentityCreateInput } from "@magimanager/shared";

interface ImportRow {
  fullName: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  geo: string;
  website?: string;
  documentUrl?: string;
}

interface ImportResult {
  success: boolean;
  created: number;
  failed: number;
  documentWarnings: string[];
  errors: { row: number; message: string }[];
  createdIds: string[];
}

export async function POST(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  const userId = auth.user?.id || null;

  try {
    const body = await request.json();
    const rows: ImportRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Request must include a non-empty 'rows' array" },
        { status: 400 }
      );
    }

    const result: ImportResult = {
      success: true,
      created: 0,
      failed: 0,
      documentWarnings: [],
      errors: [],
      createdIds: [],
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        // Validate required fields
        const missingFields: string[] = [];
        if (!row.fullName?.trim()) missingFields.push("fullName");
        if (!row.dob?.trim()) missingFields.push("dob");
        if (!row.address?.trim()) missingFields.push("address");
        if (!row.city?.trim()) missingFields.push("city");
        if (!row.state?.trim()) missingFields.push("state");
        if (!row.zipcode?.trim()) missingFields.push("zipcode");
        if (!row.geo?.trim()) missingFields.push("geo");

        if (missingFields.length > 0) {
          result.errors.push({
            row: rowNum,
            message: `Missing required fields: ${missingFields.join(", ")}`,
          });
          result.failed++;
          continue;
        }

        // Normalize the date string and create input data
        const normalizedDob = normalizeDateString(row.dob.trim());

        const identityData: IdentityCreateInput = {
          fullName: row.fullName.trim(),
          dob: normalizedDob,
          address: row.address.trim(),
          city: row.city.trim(),
          state: row.state.trim().toUpperCase(),
          zipcode: row.zipcode.trim(),
          geo: row.geo.trim(),
          website: row.website?.trim() || null,
        };

        // Create the identity
        const createResult = await identityService.create(identityData, userId);

        if (!createResult.success) {
          result.errors.push({
            row: rowNum,
            message: createResult.error || "Failed to create identity",
          });
          result.failed++;
          continue;
        }

        const identity = createResult.data!;
        result.createdIds.push(identity.id);
        result.created++;

        // Handle document URL if provided
        if (row.documentUrl?.trim()) {
          const docUrl = row.documentUrl.trim();

          if (isGoogleDriveUrl(docUrl)) {
            try {
              // Download from Google Drive
              const download = await downloadGoogleDriveFile(docUrl);

              // Validate content type
              const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "application/pdf",
              ];
              if (!allowedTypes.some((t) => download.contentType.includes(t))) {
                result.documentWarnings.push(
                  `Row ${rowNum}: Unsupported file type (${download.contentType})`
                );
              } else {
                // Upload to Vercel Blob
                const filename = `identity-docs/${identity.id}/${Date.now()}-${download.filename}`;
                const blob = await put(filename, download.buffer, {
                  access: "public",
                  contentType: download.contentType,
                });

                // Determine document type from filename
                let docType = "document";
                const lowerName = download.filename.toLowerCase();
                if (
                  lowerName.includes("id") ||
                  lowerName.includes("license") ||
                  lowerName.includes("passport")
                ) {
                  docType = "id";
                } else if (
                  lowerName.includes("bank") ||
                  lowerName.includes("statement")
                ) {
                  docType = "bank_statement";
                } else if (
                  lowerName.includes("bill") ||
                  lowerName.includes("utility")
                ) {
                  docType = "utility_bill";
                }

                // Save document to database
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
                    action: "DOCUMENT_UPLOADED",
                    details: `Document imported from Google Drive: ${download.filename}`,
                  },
                });
              }
            } catch (docError) {
              const errorMsg =
                docError instanceof Error
                  ? docError.message
                  : "Unknown error downloading document";
              result.documentWarnings.push(`Row ${rowNum}: ${errorMsg}`);
              // Identity was still created, just document failed
            }
          } else {
            result.documentWarnings.push(
              `Row ${rowNum}: URL is not a valid Google Drive link`
            );
          }
        }

        // Broadcast real-time event for each created identity
        await broadcastEvent(CHANNELS.IDENTITIES, "identity:created", {
          id: identity.id,
          fullName: identity.fullName,
        });
      } catch (rowError) {
        const errorMsg =
          rowError instanceof Error ? rowError.message : "Unknown error";
        result.errors.push({
          row: rowNum,
          message: errorMsg,
        });
        result.failed++;
      }
    }

    result.success = result.failed === 0;

    return NextResponse.json(result, {
      status: result.created > 0 ? 201 : 400,
    });
  } catch (error) {
    console.error("POST /api/identities/import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
