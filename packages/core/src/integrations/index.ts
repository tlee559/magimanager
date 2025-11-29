// ============================================================================
// INTEGRATIONS INDEX - Export all external service integrations
// ============================================================================

// Encryption utilities
export {
  encrypt,
  decrypt,
  isEncrypted,
  hash,
  generateSecureRandom,
} from "./encryption";

// Telegram Bot
export {
  sendMessage,
  sendTypingAction,
  formatDailyReport,
  formatAlertsReport,
  formatSummary,
  formatHelpMessage,
  parseCommand,
  isAuthorizedChat,
  isBotMentioned,
  type TelegramMessage,
  type TelegramUpdate,
  type AccountData,
  type AlertData,
  type ActivityData,
  type CheckInData,
  type MediaBuyerData,
  type RequestData,
  type IdentityData,
  type DatabaseStats,
} from "./telegram-bot";

// TextVerified SMS Verification
export {
  createTextVerifiedClient,
  getTextVerifiedClientFromSettings,
  formatPhoneNumber,
  extractCodeFromSms,
  GOOGLE_SERVICE_ID,
  type TextVerifiedBalance,
  type TextVerifiedVerification,
  type TextVerifiedError,
} from "./textverified";

// GoLogin Browser Profiles
export {
  createGoLoginClient,
  getGoLoginClientFromSettings,
  setGoLoginConfig,
  getGoLoginConfig,
  launchBrowserProfile,
  launchBrowserForOAuth,
  DEFAULT_EXTENSIONS,
  CUSTOM_EXTENSION_URLS,
  DEFAULT_WINDOWS_FONTS,
  type GoLoginConfig,
  type GoLoginProxyConfig,
  type GoLoginProfileOptions,
  type GoLoginProfile,
  type GoLoginError,
  type GoLoginFingerprint,
  type BrowserLaunchResult,
} from "./gologin";
