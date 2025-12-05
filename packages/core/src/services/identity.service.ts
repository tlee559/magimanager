// ============================================================================
// IDENTITY SERVICE - Business logic for Identity operations
// ============================================================================

import { identityRepository, type IdentityFindOptions, type IdentityWithRelations } from "../repositories";
import { getPrisma, type ServiceResult } from "../repositories/base.repository";
import type { IdentityCreateInput, IdentityUpdateInput, IdentityDocument } from "@magimanager/shared";
import { fireIdentityArchivedAlert } from "./decommission-alert.service";

class IdentityService {
  async getById(id: string): Promise<ServiceResult<IdentityWithRelations>> {
    try {
      const identity = await identityRepository.findById(id);
      if (!identity) {
        return { success: false, error: "Identity not found" };
      }
      return { success: true, data: identity };
    } catch (error) {
      console.error("IdentityService.getById error:", error);
      return { success: false, error: "Failed to fetch identity" };
    }
  }

  async getAll(options: IdentityFindOptions = {}): Promise<ServiceResult<IdentityWithRelations[]>> {
    try {
      const identities = await identityRepository.findAll(options);
      return { success: true, data: identities };
    } catch (error) {
      console.error("IdentityService.getAll error:", error);
      return { success: false, error: "Failed to fetch identities" };
    }
  }

  async create(
    data: IdentityCreateInput,
    userId?: string | null
  ): Promise<ServiceResult<IdentityWithRelations>> {
    try {
      // Validate required fields
      if (!data.fullName || !data.dob || !data.address || !data.city || !data.state || !data.geo) {
        return { success: false, error: "Missing required fields: fullName, dob, address, city, state, geo" };
      }

      const identity = await identityRepository.create(data);

      // Log activity
      await this.logActivity(identity.id, "CREATED", `Identity "${identity.fullName}" created`, userId);

      return { success: true, data: identity };
    } catch (error) {
      console.error("IdentityService.create error:", error);
      return { success: false, error: "Failed to create identity" };
    }
  }

  async update(
    id: string,
    data: IdentityUpdateInput,
    userId?: string | null
  ): Promise<ServiceResult<IdentityWithRelations>> {
    try {
      // Check if identity exists
      const existing = await identityRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Identity not found" };
      }

      const identity = await identityRepository.update(id, data);

      // Log activity
      await this.logActivity(id, "UPDATED", "Identity profile updated", userId);

      return { success: true, data: identity };
    } catch (error) {
      console.error("IdentityService.update error:", error);
      return { success: false, error: "Failed to update identity" };
    }
  }

  async delete(id: string, userId?: string | null): Promise<ServiceResult<void>> {
    try {
      // Check if identity exists
      const existing = await identityRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Identity not found" };
      }

      // Check if identity has linked accounts
      if (existing.adAccounts && existing.adAccounts.length > 0) {
        return { success: false, error: "Cannot delete identity with linked ad accounts" };
      }

      await identityRepository.delete(id);
      return { success: true };
    } catch (error) {
      console.error("IdentityService.delete error:", error);
      return { success: false, error: "Failed to delete identity" };
    }
  }

  async archive(id: string, userId?: string | null): Promise<ServiceResult<IdentityWithRelations>> {
    try {
      const existing = await identityRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Identity not found" };
      }

      const identity = await identityRepository.archive(id);
      await this.logActivity(id, "ARCHIVED", "Identity archived", userId);

      // Fire decommission alert for identity archive
      await fireIdentityArchivedAlert(id);

      return { success: true, data: identity };
    } catch (error) {
      console.error("IdentityService.archive error:", error);
      return { success: false, error: "Failed to archive identity" };
    }
  }

  async unarchive(id: string, userId?: string | null): Promise<ServiceResult<IdentityWithRelations>> {
    try {
      const existing = await identityRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Identity not found" };
      }

      const identity = await identityRepository.unarchive(id);
      await this.logActivity(id, "UNARCHIVED", "Identity restored from archive", userId);

      return { success: true, data: identity };
    } catch (error) {
      console.error("IdentityService.unarchive error:", error);
      return { success: false, error: "Failed to unarchive identity" };
    }
  }

  async addDocument(
    identityId: string,
    type: string,
    filePath: string,
    userId?: string | null
  ): Promise<ServiceResult<IdentityDocument>> {
    try {
      const existing = await identityRepository.findById(identityId);
      if (!existing) {
        return { success: false, error: "Identity not found" };
      }

      const document = await identityRepository.addDocument(identityId, type, filePath);
      await this.logActivity(identityId, "DOCUMENT_UPLOADED", `Document uploaded: ${type}`, userId);

      return { success: true, data: document };
    } catch (error) {
      console.error("IdentityService.addDocument error:", error);
      return { success: false, error: "Failed to add document" };
    }
  }

  async removeDocument(
    identityId: string,
    documentId: string,
    userId?: string | null
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await identityRepository.findById(identityId);
      if (!existing) {
        return { success: false, error: "Identity not found" };
      }

      const doc = existing.documents.find((d) => d.id === documentId);
      if (!doc) {
        return { success: false, error: "Document not found" };
      }

      await identityRepository.removeDocument(documentId);
      await this.logActivity(identityId, "DOCUMENT_DELETED", `Document deleted: ${doc.type}`, userId);

      return { success: true };
    } catch (error) {
      console.error("IdentityService.removeDocument error:", error);
      return { success: false, error: "Failed to remove document" };
    }
  }

  async getUniqueGeos(): Promise<string[]> {
    return identityRepository.getUniqueGeos();
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    archived: number;
    byGeo: Record<string, number>;
  }> {
    const [total, archived] = await Promise.all([
      identityRepository.count(),
      identityRepository.count({ includeArchived: true }),
    ]);

    const identities = await identityRepository.findAll({ includeArchived: true });
    const byGeo: Record<string, number> = {};

    for (const identity of identities) {
      if (!identity.archived) {
        byGeo[identity.geo] = (byGeo[identity.geo] || 0) + 1;
      }
    }

    return {
      total,
      active: total,
      archived: archived - total,
      byGeo,
    };
  }

  private async logActivity(
    identityId: string,
    action: string,
    details: string,
    userId?: string | null
  ): Promise<void> {
    try {
      const prisma = getPrisma();
      await prisma.identityActivity.create({
        data: {
          identityProfileId: identityId,
          action,
          details,
          createdBy: userId || null,
        },
      });
    } catch (error) {
      console.error("Failed to log identity activity:", error);
    }
  }
}

export const identityService = new IdentityService();
