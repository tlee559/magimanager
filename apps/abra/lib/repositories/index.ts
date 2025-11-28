// Re-export from @magimanager/core for backward compatibility
export {
  identityRepository,
  accountRepository,
  userRepository,
  mediaBuyerRepository,
  type IdentityFindOptions,
  type IdentityWithRelations,
  type AccountFindOptions,
  type AccountWithRelations,
  type UserFindOptions,
  type UserWithRelations,
  type MediaBuyerFindOptions,
  type MediaBuyerWithRelations,
} from "@magimanager/core";

// Re-export prisma client for backward compatibility
export { prisma } from "@magimanager/database";
