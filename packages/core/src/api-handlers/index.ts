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

// Decommission handlers
export {
  decommissionGetHandler,
  decommissionStartHandler,
  decommissionGetByIdHandler,
  decommissionExecuteHandler,
  decommissionCancelHandler,
  decommissionRetryHandler,
  decommissionCandidatesHandler,
} from "./decommission.handler";

// Appeal handlers
export {
  appealGetHandler,
  appealPostHandler,
  appealPatchHandler,
  appealAttemptHandler,
  appealResolveHandler,
  appealsGetHandler,
  appealsDeadlinesHandler,
} from "./appeal.handler";
