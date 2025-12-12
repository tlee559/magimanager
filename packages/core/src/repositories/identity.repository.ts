// ============================================================================
// IDENTITY REPOSITORY - Data access layer for Identity operations
// ============================================================================

import { getPrisma } from "./base.repository";
import type { Identity, IdentityCreateInput, IdentityUpdateInput, IdentityDocument } from "@magimanager/shared";

export interface IdentityFindOptions {
  includeArchived?: boolean;
  includeDocuments?: boolean;
  includeGologin?: boolean;
  includeAccounts?: boolean;
  geo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface IdentityWithRelations extends Omit<Identity, "documents" | "adAccounts"> {
  documents: IdentityDocument[];
  adAccounts?: { id: string; internalId: number; googleCid: string | null }[];
}

class IdentityRepository {
  private get prisma() {
    return getPrisma();
  }

  private buildInclude(options: IdentityFindOptions = {}) {
    return {
      documents: options.includeDocuments !== false,
      gologinProfile: options.includeGologin !== false,
      adAccounts: options.includeAccounts !== false
        ? { select: { id: true, internalId: true, googleCid: true } }
        : false,
    };
  }

  private buildWhere(options: IdentityFindOptions = {}) {
    const where: Record<string, unknown> = {};

    if (!options.includeArchived) {
      where.archived = false;
    }

    if (options.geo && options.geo !== "all") {
      where.geo = options.geo;
    }

    if (options.search) {
      where.OR = [
        { fullName: { contains: options.search, mode: "insensitive" } },
        { email: { contains: options.search, mode: "insensitive" } },
        { address: { contains: options.search, mode: "insensitive" } },
        { city: { contains: options.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  async findById(id: string): Promise<IdentityWithRelations | null> {
    const identity = await this.prisma.identityProfile.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { uploadedAt: "desc" } },
        gologinProfile: true,
        adAccounts: { select: { id: true, internalId: true, googleCid: true } },
      },
    });

    return identity as unknown as IdentityWithRelations | null;
  }

  async findAll(options: IdentityFindOptions = {}): Promise<IdentityWithRelations[]> {
    const identities = await this.prisma.identityProfile.findMany({
      where: this.buildWhere(options),
      include: this.buildInclude(options),
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    });

    return identities as unknown as IdentityWithRelations[];
  }

  async count(options: IdentityFindOptions = {}): Promise<number> {
    return this.prisma.identityProfile.count({
      where: this.buildWhere(options),
    });
  }

  async create(data: IdentityCreateInput): Promise<IdentityWithRelations> {
    const identity = await this.prisma.identityProfile.create({
      data: {
        fullName: data.fullName,
        dob: new Date(data.dob),
        address: data.address,
        city: data.city,
        state: data.state,
        zipcode: data.zipcode || "",
        geo: data.geo,
        website: data.website || null,
        notes: data.notes || null,
        email: data.email || null,
        emailPassword: data.emailPassword || null,
        phone: data.phone || null,
        backupCodes: data.backupCodes || null,
        ccNumber: data.ccNumber || null,
        ccExp: data.ccExp || null,
        ccCvv: data.ccCvv || null,
        ccName: data.ccName || null,
        billingZip: data.billingZip || null,
      },
      include: {
        documents: true,
        gologinProfile: true,
        adAccounts: { select: { id: true, internalId: true, googleCid: true } },
      },
    });

    return identity as unknown as IdentityWithRelations;
  }

  async update(id: string, data: IdentityUpdateInput): Promise<IdentityWithRelations> {
    const updateData: Record<string, unknown> = {};

    // Only include defined fields
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.dob !== undefined) updateData.dob = new Date(data.dob);
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.zipcode !== undefined) updateData.zipcode = data.zipcode;
    if (data.geo !== undefined) updateData.geo = data.geo;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.websiteNotes !== undefined) updateData.websiteNotes = data.websiteNotes;
    if (data.websiteCompleted !== undefined) updateData.websiteCompleted = data.websiteCompleted;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.emailPassword !== undefined) updateData.emailPassword = data.emailPassword;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.backupCodes !== undefined) updateData.backupCodes = data.backupCodes;
    if (data.ccNumber !== undefined) updateData.ccNumber = data.ccNumber;
    if (data.ccExp !== undefined) updateData.ccExp = data.ccExp;
    if (data.ccCvv !== undefined) updateData.ccCvv = data.ccCvv;
    if (data.ccName !== undefined) updateData.ccName = data.ccName;
    if (data.billingZip !== undefined) updateData.billingZip = data.billingZip;
    if (data.inactive !== undefined) updateData.inactive = data.inactive;
    if (data.archived !== undefined) {
      updateData.archived = data.archived;
      updateData.archivedAt = data.archived ? new Date() : null;
    }

    const identity = await this.prisma.identityProfile.update({
      where: { id },
      data: updateData,
      include: {
        documents: true,
        gologinProfile: true,
        adAccounts: { select: { id: true, internalId: true, googleCid: true } },
      },
    });

    return identity as unknown as IdentityWithRelations;
  }

  async delete(id: string): Promise<void> {
    // Delete related records first
    await this.prisma.identityDocument.deleteMany({ where: { identityProfileId: id } });
    await this.prisma.identityActivity.deleteMany({ where: { identityProfileId: id } });
    await this.prisma.goLoginProfile.deleteMany({ where: { identityProfileId: id } });

    // Finally delete the identity
    await this.prisma.identityProfile.delete({ where: { id } });
  }

  async archive(id: string): Promise<IdentityWithRelations> {
    return this.update(id, { archived: true });
  }

  async unarchive(id: string): Promise<IdentityWithRelations> {
    return this.update(id, { archived: false });
  }

  async addDocument(identityId: string, type: string, filePath: string): Promise<IdentityDocument> {
    const document = await this.prisma.identityDocument.create({
      data: {
        identityProfileId: identityId,
        type,
        filePath,
      },
    });

    return document as unknown as IdentityDocument;
  }

  async removeDocument(documentId: string): Promise<void> {
    await this.prisma.identityDocument.delete({ where: { id: documentId } });
  }

  async getUniqueGeos(): Promise<string[]> {
    const result = await this.prisma.identityProfile.findMany({
      select: { geo: true },
      distinct: ["geo"],
      orderBy: { geo: "asc" },
    });

    return result.map((r) => r.geo);
  }
}

export const identityRepository = new IdentityRepository();
