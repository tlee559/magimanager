// ============================================================================
// SERVICES INDEX - Export all service implementations
// ============================================================================

export { identityService } from "./identity.service";
export { accountService } from "./account.service";
export { userService } from "./user.service";
export { authenticatorService } from "./authenticator.service";
export type { TOTPCode } from "./authenticator.service";

// OAuth Service - Token management for Google Ads OAuth
export * from "./oauth.service";

// Google Ads Service - All Google Ads API interactions
export * from "./google-ads.service";

// Decommission Service - Comprehensive decommission job management and resource cleanup
export { decommissionService } from "./decommission.service";
export type {
  CleanupResult,
  DecommissionJobWithIdentity,
  StartDecommissionOptions,
} from "./decommission.service";

// Appeal Tracking Service - Manage appeals for suspended/in-appeal accounts
export { appealTrackingService } from "./appeal-tracking.service";
export type { AppealTrackingWithAccount, UpdateAppealInput } from "./appeal-tracking.service";

// Incomplete Identity Alert Service - Alerts when identity profiles are missing items
export * from "./incomplete-identity-alert.service";

// Identity Progress Alert Service - Alerts when items are added to identity profiles
export * from "./identity-progress-alert.service";

// Identity Archived Alert Service - Alerts when identity profiles are archived
export * from "./identity-archived-alert.service";
