// ============================================================================
// SHARED TYPES - Single source of truth for all TypeScript types
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";
export type UserStatus = "ACTIVE" | "INACTIVE";

export type AccountHealth = "active" | "limited" | "suspended" | "banned" | "in-appeal" | "unknown";
export type BillingStatus = "not_started" | "verified" | "pending" | "failed";
export type CertStatus = "pending" | "verified" | "errored" | "suspended" | "not-started" | null;
export type AccountOrigin = "mcc-created" | "takeover";
export type LifecycleStatus = "provisioned" | "warming-up" | "ready" | "handed-off";
export type HandoffStatus = "available" | "handed-off" | "archived";
export type SyncStatus = "not_connected" | "syncing" | "synced" | "error";
export type ConnectionType = "manual" | "oauth" | "mcc";

export type RequestType = "CLAIM_EXISTING" | "CREATE_NEW";
export type RequestStatus = "PENDING" | "APPROVED" | "PROFILE_CREATED" | "GOLOGIN_SETUP" | "ACCOUNT_CREATED" | "ASSIGNED" | "ACTIVE" | "REJECTED" | "ARCHIVED";

export type NotificationType =
  | "NEW_MESSAGE"
  | "REQUEST_APPROVED"
  | "REQUEST_REJECTED"
  | "ACCOUNT_ASSIGNED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_REACTIVATED"
  | "SYSTEM_ALERT";

export type AlertType = "suspended" | "banned" | "billing_failed" | "limited" | "no_checkin" | "cert_error" | "ready_handoff";
export type AlertPriority = "critical" | "warning" | "info";

// ============================================================================
// GOLOGIN
// ============================================================================

export interface GoLoginProfile {
  id: string;
  profileId: string | null;
  profileName: string | null;
  status: string;
  errorMessage: string | null;
  proxyMode: string;
  proxyHost: string | null;
  proxyPort: number | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  proxyCountry: string | null;
  lastUsedAt: Date | null;
  fingerprintRefreshedAt: Date | null;
  browserVersion: string | null;
  createdAt: Date;
  updatedAt?: Date;
}

// ============================================================================
// IDENTITY
// ============================================================================

export interface IdentityDocument {
  id: string;
  identityProfileId: string;
  type: string;
  filePath: string;
  uploadedAt: Date;
}

// ============================================================================
// AUTHENTICATOR (TOTP 2FA)
// ============================================================================

export type AuthenticatorPlatform = "google" | "meta" | "tiktok" | "microsoft" | "other";

export interface Authenticator {
  id: string;
  identityProfileId: string;
  name: string;
  platform: AuthenticatorPlatform | null;
  issuer: string | null;
  accountName: string | null;
  // Note: secret is never sent to frontend - only used server-side
  algorithm: string;
  digits: number;
  period: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

export interface AuthenticatorWithCode extends Omit<Authenticator, 'secret'> {
  code: string;
  remainingSeconds: number;
}

export interface AuthenticatorCreateInput {
  identityProfileId: string;
  name: string;
  platform?: AuthenticatorPlatform | null;
  issuer?: string | null;
  accountName?: string | null;
  secret: string; // base32 encoded secret
  algorithm?: string;
  digits?: number;
  period?: number;
  notes?: string | null;
}

export interface AuthenticatorUpdateInput {
  name?: string;
  platform?: AuthenticatorPlatform | null;
  notes?: string | null;
}

export interface Identity {
  id: string;
  fullName: string;
  dob: Date;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  geo: string;
  website: string | null;
  notes: string | null;
  // Credentials
  email: string | null;
  emailPassword: string | null;
  phone: string | null;
  twoFactorSecret: string | null;
  backupCodes: string | null;
  // Phone verification
  verificationPhone: string | null;
  verificationPhoneId: string | null;
  verificationStatus: string | null;
  verificationCode: string | null;
  verificationExpiresAt: Date | null;
  // Billing
  ccNumber: string | null;
  ccExp: string | null;
  ccCvv: string | null;
  ccName: string | null;
  billingZip: string | null;
  // Archive
  archived: boolean;
  archivedAt: Date | null;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Relations
  documents: IdentityDocument[];
  gologinProfile?: GoLoginProfile | null;
  adAccounts?: AdAccountSummary[];
}

export interface AdAccountSummary {
  id: string;
  internalId: number;
  googleCid: string | null;
}

export interface IdentityCreateInput {
  fullName: string;
  dob: string; // ISO date string
  address: string;
  city: string;
  state: string;
  zipcode?: string;
  geo: string;
  website?: string | null;
  notes?: string | null;
  email?: string | null;
  emailPassword?: string | null;
  phone?: string | null;
  backupCodes?: string | null;
  ccNumber?: string | null;
  ccExp?: string | null;
  ccCvv?: string | null;
  ccName?: string | null;
  billingZip?: string | null;
}

export interface IdentityUpdateInput extends Partial<IdentityCreateInput> {
  archived?: boolean;
}

// ============================================================================
// MEDIA BUYER
// ============================================================================

export interface MediaBuyer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  adAccounts?: AdAccount[];
  user?: User;
}

export interface MediaBuyerCreateInput {
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  userId?: string | null;
}

// ============================================================================
// AD ACCOUNT
// ============================================================================

export interface GoogleAdsConnection {
  id: string;
  googleEmail: string;
  status: string;
  lastSyncAt?: Date | null;
}

export interface CheckIn {
  id: string;
  adAccountId: string;
  dailySpend: number;
  totalSpend: number;
  adsCount: number;
  campaignsCount: number;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  issues: string | null;
  notes: string | null;
  checkedAt: Date;
  checkedBy: string | null;
}

export interface AccountActivity {
  id: string;
  adAccountId: string;
  action: string;
  details: string | null;
  createdAt: Date;
  createdBy: string | null;
  createdByUser?: User;
}

export interface AdAccount {
  id: string;
  internalId: number;
  googleCid: string | null;
  identityProfileId: string | null;
  origin: AccountOrigin;
  status: LifecycleStatus;
  warmupTargetSpend: number;
  currentSpendTotal: number;
  todaySpend: number;
  adsCount: number;
  campaignsCount: number;
  mccId: string | null;
  accountHealth: AccountHealth;
  billingStatus: BillingStatus;
  certStatus: CertStatus;
  handoffStatus: HandoffStatus;
  mediaBuyerId: string | null;
  handoffDate: Date | null;
  handoffNotes: string | null;
  notes: string | null;
  // OAuth sync
  connectionId: string | null;
  connectionType: ConnectionType;
  syncStatus: SyncStatus;
  lastGoogleSyncAt: Date | null;
  googleSyncError: string | null;
  googleCidVerified: boolean;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Relations
  identityProfile?: Identity | null;
  mediaBuyer?: MediaBuyer | null;
  connection?: GoogleAdsConnection | null;
  checkIns?: CheckIn[];
  activities?: AccountActivity[];
}

export interface AdAccountCreateInput {
  identityProfileId?: string;
  origin?: AccountOrigin;
  googleCid?: string;
  warmupTargetSpend?: number;
  notes?: string | null;
  newIdentity?: IdentityCreateInput;
  // OAuth connection fields
  connectionId?: string;
  connectionType?: ConnectionType;
}

export interface AdAccountUpdateInput {
  googleCid?: string;
  status?: LifecycleStatus;
  warmupTargetSpend?: number;
  accountHealth?: AccountHealth;
  billingStatus?: BillingStatus;
  certStatus?: CertStatus;
  handoffStatus?: HandoffStatus;
  mediaBuyerId?: string | null;
  handoffDate?: Date | null;
  handoffNotes?: string | null;
  notes?: string | null;
}

// ============================================================================
// USER
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string; // Excluded in most responses
  role: UserRole;
  status: UserStatus;
  firstLogin: boolean;
  unreadNotifications: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  mediaBuyer?: MediaBuyer;
}

export interface UserCreateInput {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
}

// ============================================================================
// THREADS & MESSAGES
// ============================================================================

export interface ThreadMessage {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  message: string;
  isRead: boolean;
  createdAt: Date;
  editedAt: Date | null;
}

export interface AccountThread {
  id: string;
  adAccountId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ThreadMessage[];
}

// ============================================================================
// REQUESTS
// ============================================================================

export interface AccountRequest {
  id: string;
  requesterId: string;
  type: RequestType;
  existingAccountId: string | null;
  justification: string;
  status: RequestStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
  requester?: User;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification {
  id: string;
  userId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  entityId: string | null;
  entityType: string | null;
  priority: string;
  createdAt: Date;
}

// ============================================================================
// ALERTS
// ============================================================================

export interface NeedsAttentionAccount {
  id: string;
  internalId: number;
  googleCid: string | null;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  currentSpendTotal: number;
  warmupTargetSpend: number;
  handoffStatus: string;
  identityProfile: {
    id: string;
    fullName: string;
    geo: string;
  } | null;
  lastCheckIn: Date | null;
  alertPriority: AlertPriority;
  alertReason: string;
  alertType: AlertType;
  daysSinceCheckIn: number | null;
}

export interface AlertsSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byType: Record<AlertType, number>;
}

// ============================================================================
// APP SETTINGS
// ============================================================================

export interface AppSettings {
  id: string;
  warmupTargetSpend: number;
  gologinApiKey: string | null;
  googleAdsApiKey: string | null;
  googleApiKey: string | null;
  textverifiedApiKey: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  updatedAt: Date;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// VIEW TYPES
// ============================================================================

export type AdminView =
  | "dashboard"
  | "identities"
  | "create-identity"
  | "identity-detail"
  | "edit-identity"
  | "ad-accounts"
  | "team"
  | "settings"
  | "my-accounts"
  | "requests"
  | "admin-requests"
  | "system"
  | "sms-dashboard"
  | "authenticator";

// ============================================================================
// CAMPAIGN & AUTOMATION TYPES
// ============================================================================

export * from './campaigns';
export * from './automations';

// ============================================================================
// THEME TYPES
// ============================================================================

export type AppTheme = "emerald" | "purple" | "blue" | "orange" | "rose";

export interface ThemeConfig {
  name: AppTheme;
  primary: string;
  primaryHover: string;
  primaryText: string;
  accent: string;
  accentHover: string;
}

export const THEMES: Record<AppTheme, ThemeConfig> = {
  emerald: {
    name: "emerald",
    primary: "bg-emerald-500",
    primaryHover: "hover:bg-emerald-400",
    primaryText: "text-emerald-400",
    accent: "bg-emerald-500/10",
    accentHover: "hover:bg-emerald-500/20",
  },
  purple: {
    name: "purple",
    primary: "bg-purple-500",
    primaryHover: "hover:bg-purple-400",
    primaryText: "text-purple-400",
    accent: "bg-purple-500/10",
    accentHover: "hover:bg-purple-500/20",
  },
  blue: {
    name: "blue",
    primary: "bg-blue-500",
    primaryHover: "hover:bg-blue-400",
    primaryText: "text-blue-400",
    accent: "bg-blue-500/10",
    accentHover: "hover:bg-blue-500/20",
  },
  orange: {
    name: "orange",
    primary: "bg-orange-500",
    primaryHover: "hover:bg-orange-400",
    primaryText: "text-orange-400",
    accent: "bg-orange-500/10",
    accentHover: "hover:bg-orange-500/20",
  },
  rose: {
    name: "rose",
    primary: "bg-rose-500",
    primaryHover: "hover:bg-rose-400",
    primaryText: "text-rose-400",
    accent: "bg-rose-500/10",
    accentHover: "hover:bg-rose-500/20",
  },
};
