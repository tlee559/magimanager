// ============================================================================
// REPOSITORY TYPES - Abstract interfaces for data access patterns
// ============================================================================

import type {
  Identity,
  IdentityCreateInput,
  IdentityUpdateInput,
  IdentityDocument,
  AdAccount,
  AdAccountCreateInput,
  AdAccountUpdateInput,
  CheckIn,
  AccountActivity,
  AlertType,
  NeedsAttentionAccount,
  User,
  UserCreateInput,
  UserUpdateInput,
  MediaBuyer,
  MediaBuyerCreateInput,
  AccountHealth,
  HandoffStatus,
  LifecycleStatus,
} from "../types";

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// IDENTITY REPOSITORY
// ============================================================================

export interface IdentityFindOptions {
  includeArchived?: boolean;
  includeDocuments?: boolean;
  includeGologin?: boolean;
  includeAccounts?: boolean;
  geo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface IdentityWithRelations extends Omit<Identity, "documents" | "adAccounts"> {
  documents: IdentityDocument[];
  adAccounts?: { id: string; internalId: number; googleCid: string | null }[];
}

export interface IIdentityRepository {
  findById(id: string): Promise<IdentityWithRelations | null>;
  findAll(options?: IdentityFindOptions): Promise<IdentityWithRelations[]>;
  count(options?: IdentityFindOptions): Promise<number>;
  create(data: IdentityCreateInput): Promise<IdentityWithRelations>;
  update(id: string, data: IdentityUpdateInput): Promise<IdentityWithRelations>;
  delete(id: string): Promise<void>;
  archive(id: string): Promise<IdentityWithRelations>;
  unarchive(id: string): Promise<IdentityWithRelations>;
  addDocument(identityId: string, type: string, filePath: string): Promise<IdentityDocument>;
  removeDocument(documentId: string): Promise<void>;
  getUniqueGeos(): Promise<string[]>;
}

// ============================================================================
// ACCOUNT REPOSITORY
// ============================================================================

export interface AccountFindOptions {
  includeArchived?: boolean;
  includeIdentity?: boolean;
  includeMediaBuyer?: boolean;
  includeConnection?: boolean;
  includeCheckIns?: boolean;
  includeActivities?: boolean;
  unassignedOnly?: boolean;
  status?: LifecycleStatus;
  handoffStatus?: HandoffStatus;
  accountHealth?: AccountHealth;
  mediaBuyerId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AccountWithRelations extends Omit<AdAccount, "identityProfile" | "mediaBuyer" | "connection" | "checkIns" | "activities"> {
  identityProfile?: {
    id: string;
    fullName: string;
    geo: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    ccNumber: string | null;
    ccExp: string | null;
    ccCvv: string | null;
    ccName: string | null;
    billingZip: string | null;
    gologinProfile?: {
      id: string;
      profileId: string | null;
      status: string;
    } | null;
  } | null;
  mediaBuyer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  connection?: {
    id: string;
    googleEmail: string;
    status: string;
  } | null;
  checkIns?: CheckIn[];
  activities?: AccountActivity[];
}

export interface CheckInData {
  dailySpend: number;
  totalSpend: number;
  adsCount: number;
  campaignsCount?: number;
  accountHealth: string;
  billingStatus: string;
  certStatus?: string | null;
  issues?: string | null;
  notes?: string | null;
}

export interface NeedsAttentionResult {
  accounts: NeedsAttentionAccount[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export interface AccountStats {
  total: number;
  byStatus: Record<string, number>;
  byHealth: Record<string, number>;
  byHandoff: Record<string, number>;
  totalSpend: number;
}

export interface IAccountRepository {
  findById(id: string, options?: AccountFindOptions): Promise<AccountWithRelations | null>;
  findByInternalId(internalId: number): Promise<AccountWithRelations | null>;
  findByGoogleCid(googleCid: string): Promise<AccountWithRelations | null>;
  findAll(options?: AccountFindOptions): Promise<AccountWithRelations[]>;
  count(options?: AccountFindOptions): Promise<number>;
  create(data: AdAccountCreateInput, userId?: string | null): Promise<AccountWithRelations>;
  update(id: string, data: AdAccountUpdateInput, userId?: string | null): Promise<AccountWithRelations>;
  delete(id: string): Promise<void>;
  archive(id: string, userId?: string | null): Promise<AccountWithRelations>;
  assignToMediaBuyer(
    id: string,
    mediaBuyerId: string,
    notes?: string,
    userId?: string | null
  ): Promise<AccountWithRelations>;
  logActivity(
    accountId: string,
    action: string,
    details: string | null,
    userId?: string | null
  ): Promise<AccountActivity>;
  addCheckIn(
    accountId: string,
    data: CheckInData,
    userId?: string | null
  ): Promise<CheckIn>;
  getNeedsAttention(): Promise<NeedsAttentionResult>;
  dismissAlert(accountId: string, alertType: AlertType, userId: string): Promise<void>;
  getStats(): Promise<AccountStats>;
}

// ============================================================================
// USER REPOSITORY
// ============================================================================

export interface UserFindOptions {
  includeInactive?: boolean;
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UserWithRelations extends Omit<User, "mediaBuyer"> {
  mediaBuyer?: MediaBuyer;
}

export interface IUserRepository {
  findById(id: string): Promise<UserWithRelations | null>;
  findByEmail(email: string): Promise<UserWithRelations | null>;
  findAll(options?: UserFindOptions): Promise<UserWithRelations[]>;
  count(options?: UserFindOptions): Promise<number>;
  create(data: UserCreateInput): Promise<UserWithRelations>;
  update(id: string, data: UserUpdateInput): Promise<UserWithRelations>;
  delete(id: string): Promise<void>;
  updatePassword(id: string, hashedPassword: string): Promise<void>;
  updateLastLogin(id: string): Promise<void>;
}

// ============================================================================
// MEDIA BUYER REPOSITORY
// ============================================================================

export interface MediaBuyerFindOptions {
  includeInactive?: boolean;
  includeAccounts?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MediaBuyerWithRelations extends Omit<MediaBuyer, "adAccounts" | "user"> {
  adAccounts?: AdAccount[];
  user?: User;
}

export interface IMediaBuyerRepository {
  findById(id: string): Promise<MediaBuyerWithRelations | null>;
  findByEmail(email: string): Promise<MediaBuyerWithRelations | null>;
  findByUserId(userId: string): Promise<MediaBuyerWithRelations | null>;
  findAll(options?: MediaBuyerFindOptions): Promise<MediaBuyerWithRelations[]>;
  count(options?: MediaBuyerFindOptions): Promise<number>;
  create(data: MediaBuyerCreateInput): Promise<MediaBuyerWithRelations>;
  update(id: string, data: Partial<MediaBuyerCreateInput>): Promise<MediaBuyerWithRelations>;
  delete(id: string): Promise<void>;
  linkToUser(id: string, userId: string): Promise<MediaBuyerWithRelations>;
  unlinkFromUser(id: string): Promise<MediaBuyerWithRelations>;
}
