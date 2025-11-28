// ============================================================================
// MEDIA BUYER REPOSITORY - Data access layer for MediaBuyer operations
// ============================================================================

import { getPrisma } from "./base.repository";
import type { MediaBuyer, MediaBuyerCreateInput } from "@magimanager/shared";

export interface MediaBuyerFindOptions {
  includeAccounts?: boolean;
  includeUser?: boolean;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MediaBuyerWithRelations extends Omit<MediaBuyer, "user"> {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

class MediaBuyerRepository {
  private get prisma() {
    return getPrisma();
  }

  private buildInclude(options: MediaBuyerFindOptions = {}) {
    return {
      adAccounts: options.includeAccounts
        ? {
            select: { id: true, internalId: true, googleCid: true },
            where: { handoffStatus: { not: "archived" } },
          }
        : false,
      user: options.includeUser
        ? { select: { id: true, name: true, email: true, role: true } }
        : false,
    };
  }

  private buildWhere(options: MediaBuyerFindOptions = {}) {
    const where: Record<string, unknown> = {};

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { email: { contains: options.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  async findById(id: string, options: MediaBuyerFindOptions = {}): Promise<MediaBuyerWithRelations | null> {
    const mediaBuyer = await this.prisma.mediaBuyer.findUnique({
      where: { id },
      include: this.buildInclude(options),
    });

    return mediaBuyer as unknown as MediaBuyerWithRelations | null;
  }

  async findAll(options: MediaBuyerFindOptions = {}): Promise<MediaBuyerWithRelations[]> {
    const mediaBuyers = await this.prisma.mediaBuyer.findMany({
      where: this.buildWhere(options),
      include: this.buildInclude(options),
      orderBy: { name: "asc" },
      take: options.limit,
      skip: options.offset,
    });

    return mediaBuyers as unknown as MediaBuyerWithRelations[];
  }

  async count(options: MediaBuyerFindOptions = {}): Promise<number> {
    return this.prisma.mediaBuyer.count({
      where: this.buildWhere(options),
    });
  }

  async create(data: MediaBuyerCreateInput): Promise<MediaBuyerWithRelations> {
    const mediaBuyer = await this.prisma.mediaBuyer.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        notes: data.notes || null,
        userId: data.userId || null,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return mediaBuyer as unknown as MediaBuyerWithRelations;
  }

  async update(
    id: string,
    data: Partial<{ name: string; email: string; phone: string | null; notes: string | null; isActive: boolean; userId: string | null }>
  ): Promise<MediaBuyerWithRelations> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.userId !== undefined) updateData.userId = data.userId;

    const mediaBuyer = await this.prisma.mediaBuyer.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return mediaBuyer as unknown as MediaBuyerWithRelations;
  }

  async delete(id: string): Promise<void> {
    // First unassign all accounts from this media buyer
    await this.prisma.adAccount.updateMany({
      where: { mediaBuyerId: id },
      data: {
        mediaBuyerId: null,
        handoffStatus: "available",
        handoffDate: null,
        handoffNotes: null,
      },
    });

    // Then delete the media buyer
    await this.prisma.mediaBuyer.delete({ where: { id } });
  }

  async linkToUser(mediaBuyerId: string, userId: string): Promise<MediaBuyerWithRelations> {
    return this.update(mediaBuyerId, { userId });
  }

  async unlinkFromUser(mediaBuyerId: string): Promise<MediaBuyerWithRelations> {
    return this.update(mediaBuyerId, { userId: null });
  }
}

export const mediaBuyerRepository = new MediaBuyerRepository();
