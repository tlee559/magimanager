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
} from "./team.handler";
