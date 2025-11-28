// ============================================================================
// REPOSITORIES INDEX - Central export for all repositories
// ============================================================================

export { identityRepository, type IdentityFindOptions, type IdentityWithRelations } from "./identity.repository";
export { accountRepository, type AccountFindOptions, type AccountWithRelations } from "./account.repository";
export { userRepository, type UserFindOptions, type UserWithRelations } from "./user.repository";
export { prisma } from "./base.repository";
