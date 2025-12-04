// ============================================================================
// AUTHENTICATOR REPOSITORY - Data access layer for TOTP Authenticator operations
// ============================================================================

import { getPrisma } from "./base.repository";
import { encrypt, decrypt } from "../integrations/encryption";
import type { Authenticator, AuthenticatorCreateInput, AuthenticatorUpdateInput } from "@magimanager/shared";

export interface AuthenticatorFindOptions {
  identityProfileId?: string;
  platform?: string;
  limit?: number;
  offset?: number;
}

// Type for internal use - includes encrypted secret
interface AuthenticatorRecord {
  id: string;
  identityProfileId: string | null;
  name: string;
  platform: string | null;
  issuer: string | null;
  accountName: string | null;
  secret: string; // encrypted
  algorithm: string;
  digits: number;
  period: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

// Type for returning to frontend - secret excluded
export type AuthenticatorPublic = Omit<Authenticator, "secret">;

class AuthenticatorRepository {
  private get prisma() {
    return getPrisma();
  }

  /**
   * Convert database record to public format (excludes secret)
   */
  private toPublic(record: AuthenticatorRecord): AuthenticatorPublic {
    return {
      id: record.id,
      identityProfileId: record.identityProfileId,
      name: record.name,
      platform: record.platform as AuthenticatorPublic["platform"],
      issuer: record.issuer,
      accountName: record.accountName,
      algorithm: record.algorithm,
      digits: record.digits,
      period: record.period,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastUsedAt: record.lastUsedAt,
    };
  }

  /**
   * Find authenticator by ID (public format - no secret)
   */
  async findById(id: string): Promise<AuthenticatorPublic | null> {
    const record = await this.prisma.authenticator.findUnique({
      where: { id },
    });

    if (!record) return null;
    return this.toPublic(record as AuthenticatorRecord);
  }

  /**
   * Find authenticator by ID with decrypted secret (internal use only)
   */
  async findByIdWithSecret(id: string): Promise<{ authenticator: AuthenticatorPublic; secret: string } | null> {
    const record = await this.prisma.authenticator.findUnique({
      where: { id },
    });

    if (!record) return null;

    const decryptedSecret = decrypt(record.secret);
    return {
      authenticator: this.toPublic(record as AuthenticatorRecord),
      secret: decryptedSecret,
    };
  }

  /**
   * Find all authenticators for an identity (public format)
   */
  async findByIdentityId(identityProfileId: string): Promise<AuthenticatorPublic[]> {
    const records = await this.prisma.authenticator.findMany({
      where: { identityProfileId },
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => this.toPublic(r as AuthenticatorRecord));
  }

  /**
   * Find all authenticators (public format) - for standalone view
   */
  async findAll(options: AuthenticatorFindOptions = {}): Promise<AuthenticatorPublic[]> {
    const where: Record<string, unknown> = {};

    if (options.identityProfileId) {
      where.identityProfileId = options.identityProfileId;
    }

    if (options.platform) {
      where.platform = options.platform;
    }

    const records = await this.prisma.authenticator.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    });

    return records.map((r) => this.toPublic(r as AuthenticatorRecord));
  }

  /**
   * Find all authenticators with identity info (for standalone view)
   */
  async findAllWithIdentity(options: AuthenticatorFindOptions = {}): Promise<(AuthenticatorPublic & { identityProfile: { id: string; fullName: string; email: string | null } | null })[]> {
    const where: Record<string, unknown> = {};

    if (options.identityProfileId) {
      where.identityProfileId = options.identityProfileId;
    }

    if (options.platform) {
      where.platform = options.platform;
    }

    const records = await this.prisma.authenticator.findMany({
      where,
      include: {
        identityProfile: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    });

    return records.map((r) => ({
      ...this.toPublic(r as AuthenticatorRecord),
      identityProfile: r.identityProfile,
    }));
  }

  /**
   * Count authenticators
   */
  async count(options: AuthenticatorFindOptions = {}): Promise<number> {
    const where: Record<string, unknown> = {};

    if (options.identityProfileId) {
      where.identityProfileId = options.identityProfileId;
    }

    if (options.platform) {
      where.platform = options.platform;
    }

    return this.prisma.authenticator.count({ where });
  }

  /**
   * Create a new authenticator (encrypts secret)
   */
  async create(data: AuthenticatorCreateInput): Promise<AuthenticatorPublic> {
    // Encrypt the secret before storing
    const encryptedSecret = encrypt(data.secret);

    const record = await this.prisma.authenticator.create({
      data: {
        identityProfileId: data.identityProfileId || null,
        name: data.name,
        platform: data.platform || null,
        issuer: data.issuer || null,
        accountName: data.accountName || null,
        secret: encryptedSecret,
        algorithm: data.algorithm || "SHA1",
        digits: data.digits || 6,
        period: data.period || 30,
        notes: data.notes || null,
      },
    });

    return this.toPublic(record as AuthenticatorRecord);
  }

  /**
   * Update an authenticator (does not allow updating secret)
   */
  async update(id: string, data: AuthenticatorUpdateInput): Promise<AuthenticatorPublic> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const record = await this.prisma.authenticator.update({
      where: { id },
      data: updateData,
    });

    return this.toPublic(record as AuthenticatorRecord);
  }

  /**
   * Update lastUsedAt timestamp (called when code is copied)
   */
  async updateLastUsed(id: string): Promise<void> {
    await this.prisma.authenticator.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Delete an authenticator
   */
  async delete(id: string): Promise<void> {
    await this.prisma.authenticator.delete({ where: { id } });
  }

  /**
   * Delete all authenticators for an identity
   */
  async deleteByIdentityId(identityProfileId: string): Promise<number> {
    const result = await this.prisma.authenticator.deleteMany({
      where: { identityProfileId },
    });
    return result.count;
  }
}

export const authenticatorRepository = new AuthenticatorRepository();
