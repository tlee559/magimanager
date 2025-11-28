// ============================================================================
// SERVICE TYPES - Abstract interfaces for business logic layer
// ============================================================================

import type {
  IdentityCreateInput,
  IdentityUpdateInput,
  IdentityDocument,
  AdAccountCreateInput,
  AdAccountUpdateInput,
  CheckIn,
  AccountActivity,
  AlertType,
  User,
  UserCreateInput,
  UserUpdateInput,
  MediaBuyer,
  MediaBuyerCreateInput,
  Notification,
  AppSettings,
} from "../types";

import type {
  ServiceResult,
  IdentityFindOptions,
  IdentityWithRelations,
  AccountFindOptions,
  AccountWithRelations,
  CheckInData,
  NeedsAttentionResult,
  AccountStats,
  UserFindOptions,
  UserWithRelations,
  MediaBuyerFindOptions,
  MediaBuyerWithRelations,
} from "../repositories";

// Re-export ServiceResult for convenience
export type { ServiceResult };

// ============================================================================
// IDENTITY SERVICE
// ============================================================================

export interface IdentityStats {
  total: number;
  active: number;
  archived: number;
  byGeo: Record<string, number>;
}

export interface IIdentityService {
  getById(id: string): Promise<ServiceResult<IdentityWithRelations>>;
  getAll(options?: IdentityFindOptions): Promise<ServiceResult<IdentityWithRelations[]>>;
  create(data: IdentityCreateInput, userId?: string | null): Promise<ServiceResult<IdentityWithRelations>>;
  update(id: string, data: IdentityUpdateInput, userId?: string | null): Promise<ServiceResult<IdentityWithRelations>>;
  delete(id: string, userId?: string | null): Promise<ServiceResult<void>>;
  archive(id: string, userId?: string | null): Promise<ServiceResult<IdentityWithRelations>>;
  unarchive(id: string, userId?: string | null): Promise<ServiceResult<IdentityWithRelations>>;
  addDocument(
    identityId: string,
    type: string,
    filePath: string,
    userId?: string | null
  ): Promise<ServiceResult<IdentityDocument>>;
  removeDocument(
    identityId: string,
    documentId: string,
    userId?: string | null
  ): Promise<ServiceResult<void>>;
  getUniqueGeos(): Promise<string[]>;
  getStats(): Promise<IdentityStats>;
}

// ============================================================================
// ACCOUNT SERVICE
// ============================================================================

export interface IAccountService {
  getById(id: string, options?: AccountFindOptions): Promise<ServiceResult<AccountWithRelations>>;
  getByInternalId(internalId: number): Promise<ServiceResult<AccountWithRelations>>;
  getByGoogleCid(googleCid: string): Promise<ServiceResult<AccountWithRelations>>;
  getAll(options?: AccountFindOptions): Promise<ServiceResult<AccountWithRelations[]>>;
  create(data: AdAccountCreateInput, userId?: string | null): Promise<ServiceResult<AccountWithRelations>>;
  update(
    id: string,
    data: AdAccountUpdateInput,
    userId?: string | null
  ): Promise<ServiceResult<AccountWithRelations>>;
  delete(id: string, userId?: string | null): Promise<ServiceResult<void>>;
  archive(id: string, userId?: string | null): Promise<ServiceResult<AccountWithRelations>>;
  assignToMediaBuyer(
    id: string,
    mediaBuyerId: string,
    notes?: string,
    userId?: string | null
  ): Promise<ServiceResult<AccountWithRelations>>;
  addCheckIn(
    accountId: string,
    data: CheckInData,
    userId?: string | null
  ): Promise<ServiceResult<CheckIn>>;
  getNeedsAttention(): Promise<ServiceResult<NeedsAttentionResult>>;
  dismissAlert(accountId: string, alertType: AlertType, userId: string): Promise<ServiceResult<void>>;
  getStats(): Promise<ServiceResult<AccountStats>>;
}

// ============================================================================
// USER SERVICE
// ============================================================================

export interface IUserService {
  getById(id: string): Promise<ServiceResult<UserWithRelations>>;
  getByEmail(email: string): Promise<ServiceResult<UserWithRelations>>;
  getAll(options?: UserFindOptions): Promise<ServiceResult<UserWithRelations[]>>;
  create(data: UserCreateInput): Promise<ServiceResult<UserWithRelations>>;
  update(id: string, data: UserUpdateInput): Promise<ServiceResult<UserWithRelations>>;
  delete(id: string): Promise<ServiceResult<void>>;
  changePassword(id: string, currentPassword: string, newPassword: string): Promise<ServiceResult<void>>;
  resetPassword(id: string, newPassword: string): Promise<ServiceResult<void>>;
  authenticate(email: string, password: string): Promise<ServiceResult<UserWithRelations>>;
}

// ============================================================================
// MEDIA BUYER SERVICE
// ============================================================================

export interface IMediaBuyerService {
  getById(id: string): Promise<ServiceResult<MediaBuyerWithRelations>>;
  getByEmail(email: string): Promise<ServiceResult<MediaBuyerWithRelations>>;
  getByUserId(userId: string): Promise<ServiceResult<MediaBuyerWithRelations>>;
  getAll(options?: MediaBuyerFindOptions): Promise<ServiceResult<MediaBuyerWithRelations[]>>;
  create(data: MediaBuyerCreateInput): Promise<ServiceResult<MediaBuyerWithRelations>>;
  update(id: string, data: Partial<MediaBuyerCreateInput>): Promise<ServiceResult<MediaBuyerWithRelations>>;
  delete(id: string): Promise<ServiceResult<void>>;
  linkToUser(id: string, userId: string): Promise<ServiceResult<MediaBuyerWithRelations>>;
  unlinkFromUser(id: string): Promise<ServiceResult<MediaBuyerWithRelations>>;
}

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

export interface NotificationFindOptions {
  userId?: string;
  isRead?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface INotificationService {
  getById(id: string): Promise<ServiceResult<Notification>>;
  getForUser(userId: string, options?: NotificationFindOptions): Promise<ServiceResult<Notification[]>>;
  getUnreadCount(userId: string): Promise<number>;
  create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    entityId?: string;
    entityType?: string;
    priority?: string;
  }): Promise<ServiceResult<Notification>>;
  markAsRead(id: string): Promise<ServiceResult<void>>;
  markAllAsRead(userId: string): Promise<ServiceResult<void>>;
  delete(id: string): Promise<ServiceResult<void>>;
}

// ============================================================================
// SETTINGS SERVICE
// ============================================================================

export interface ISettingsService {
  get(): Promise<ServiceResult<AppSettings>>;
  update(data: Partial<AppSettings>): Promise<ServiceResult<AppSettings>>;
}
