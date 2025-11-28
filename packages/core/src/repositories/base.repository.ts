// ============================================================================
// BASE REPOSITORY - Foundation for all repositories
// ============================================================================

import { prisma } from "@magimanager/database";
import type { PrismaClient } from "@prisma/client";

/**
 * Get the Prisma client instance.
 * Uses the singleton from @magimanager/database.
 */
export function getPrisma(): PrismaClient {
  return prisma;
}

/**
 * Base service result type for all service operations
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
