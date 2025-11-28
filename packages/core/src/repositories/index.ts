// ============================================================================
// REPOSITORIES INDEX - Export all repository implementations
// ============================================================================

// Base repository utilities
export { getPrisma, type ServiceResult } from "./base.repository";

// Identity repository
export { identityRepository } from "./identity.repository";
export type { IdentityFindOptions, IdentityWithRelations } from "./identity.repository";

// Account repository
export { accountRepository } from "./account.repository";
export type { AccountFindOptions, AccountWithRelations } from "./account.repository";

// User repository
export { userRepository } from "./user.repository";
export type { UserFindOptions, UserWithRelations } from "./user.repository";

// Media buyer repository
export { mediaBuyerRepository } from "./media-buyer.repository";
export type { MediaBuyerFindOptions, MediaBuyerWithRelations } from "./media-buyer.repository";
