// ============================================================================
// BASE REPOSITORY - Abstract base class for all repositories
// ============================================================================

import { prisma } from "@/lib/db";

export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected prisma = prisma;

  abstract findById(id: string): Promise<T | null>;
  abstract findAll(options?: unknown): Promise<T[]>;
  abstract create(data: CreateInput): Promise<T>;
  abstract update(id: string, data: UpdateInput): Promise<T>;
  abstract delete(id: string): Promise<void>;
}

// Re-export prisma instance for direct access when needed
export { prisma };
