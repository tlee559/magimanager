// ============================================================================
// API HANDLERS INDEX - Export all API route handlers
// ============================================================================

// Account handlers
export {
  accountsGetHandler,
  accountsPostHandler,
  accountGetByIdHandler,
  accountPatchHandler,
  accountDeleteHandler,
  accountCheckInHandler,
  accountAssignHandler,
  needsAttentionHandler,
  dismissAlertHandler,
} from "./accounts.handler";

// Identity handlers
export {
  identitiesGetHandler,
  identitiesPostHandler,
  identityGetByIdHandler,
  identityPutHandler,
  identityPatchHandler,
  identityDeleteHandler,
  identityGeosHandler,
} from "./identities.handler";

// Team handlers
export {
  teamGetHandler,
  teamPostHandler,
  teamMemberGetHandler,
  teamMemberPatchHandler,
  teamMemberDeleteHandler,
  resetPasswordHandler,
  changePasswordHandler,
  profileGetHandler,
  profilePatchHandler,
} from "./team.handler";

// Authenticator handlers
export {
  authenticatorsGetAllHandler,
  authenticatorsPostHandler,
  standaloneAuthenticatorCodeHandler,
  authenticatorsGetHandler,
  authenticatorsWithCodesHandler,
  authenticatorPostHandler,
  authenticatorGetByIdHandler,
  authenticatorPutHandler,
  authenticatorDeleteHandler,
  authenticatorCodeHandler,
  parseOtpUriHandler,
} from "./authenticators.handler";
