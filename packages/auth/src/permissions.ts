export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";

export const Permissions = {
  // Team Management
  canManageTeam: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  canCreateAdmin: (role: UserRole) => role === "SUPER_ADMIN",
  canDeactivateUser: (role: UserRole, targetRole: UserRole) => {
    if (targetRole === "SUPER_ADMIN") return false;
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role);
  },

  // Account Management
  canCreateAccount: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  canViewAllAccounts: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  canEditAccount: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  canDeleteAccount: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  canHandoffAccount: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),

  // Identity Management
  canManageIdentities: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),

  // Media Buyer Management
  canManageMediaBuyers: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),

  // Account Requests
  canCreateAccountRequest: () => true,
  canReviewAccountRequest: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),

  // Threads/Messages
  canViewAccountThread: (role: UserRole, userId: string, accountMediaBuyerUserId?: string | null) => {
    if (["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)) return true;
    if (role === "MEDIA_BUYER" && accountMediaBuyerUserId === userId) return true;
    return false;
  },
  canPostToThread: (role: UserRole, userId: string, accountMediaBuyerUserId?: string | null) => {
    if (["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)) return true;
    if (role === "MEDIA_BUYER" && accountMediaBuyerUserId === userId) return true;
    return false;
  },

  // Settings
  canManageSettings: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  canManageApiKeys: (role: UserRole) => role === "SUPER_ADMIN",

  // GoLogin
  canManageGoLogin: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),

  // Jobs
  canViewJobs: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  canCreateJob: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
};

export const getAccessibleViews = (role: UserRole) => ({
  dashboard: true,
  websiteGenerator: true,
  accounts: ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  identities: ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  mediaBuyers: ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  team: ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  settings: ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  myAccounts: role === "MEDIA_BUYER",
  requests: true,
});

// App-specific permissions
export const abraPermissions = {
  canAccess: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSISTANT"].includes(role),
  canEdit: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role),
  canDelete: (role: UserRole) => ["SUPER_ADMIN", "ADMIN"].includes(role),
};

export const kadabraPermissions = {
  canAccess: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER", "MEDIA_BUYER", "ASSISTANT"].includes(role),
  canEdit: (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER", "MEDIA_BUYER"].includes(role),
  canDelete: (role: UserRole) => ["SUPER_ADMIN", "ADMIN"].includes(role),
};

export const canAccessAbra = (role: UserRole) => abraPermissions.canAccess(role);
export const canAccessKadabra = (role: UserRole) => kadabraPermissions.canAccess(role);
