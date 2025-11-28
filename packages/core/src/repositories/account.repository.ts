// ============================================================================
// ACCOUNT REPOSITORY - Data access layer for AdAccount operations
// ============================================================================

import { getPrisma } from "./base.repository";
import type {
  AdAccount,
  AdAccountCreateInput,
  AdAccountUpdateInput,
  CheckIn,
  AccountActivity,
  AccountHealth,
  HandoffStatus,
  LifecycleStatus,
  AlertType,
  AlertPriority,
  NeedsAttentionAccount,
} from "@magimanager/shared";

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

export interface AccountWithRelations extends AdAccount {
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

class AccountRepository {
  private get prisma() {
    return getPrisma();
  }

  private buildInclude(options: AccountFindOptions = {}) {
    return {
      identityProfile: options.includeIdentity !== false
        ? {
            include: {
              gologinProfile: true,
            },
          }
        : false,
      mediaBuyer: options.includeMediaBuyer !== false,
      connection: options.includeConnection !== false
        ? {
            select: {
              id: true,
              googleEmail: true,
              status: true,
            },
          }
        : false,
      checkIns: options.includeCheckIns
        ? { orderBy: { checkedAt: "desc" as const }, take: 10 }
        : false,
      activities: options.includeActivities
        ? { orderBy: { createdAt: "desc" as const }, take: 20 }
        : false,
    };
  }

  private buildWhere(options: AccountFindOptions = {}) {
    const where: Record<string, unknown> = {};

    if (!options.includeArchived) {
      where.handoffStatus = { not: "archived" };
    }

    if (options.unassignedOnly) {
      where.identityProfileId = null;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.handoffStatus) {
      where.handoffStatus = options.handoffStatus;
    }

    if (options.accountHealth) {
      where.accountHealth = options.accountHealth;
    }

    if (options.mediaBuyerId) {
      where.mediaBuyerId = options.mediaBuyerId;
    }

    if (options.search) {
      where.OR = [
        { googleCid: { contains: options.search, mode: "insensitive" } },
        { identityProfile: { fullName: { contains: options.search, mode: "insensitive" } } },
        { identityProfile: { email: { contains: options.search, mode: "insensitive" } } },
      ];
    }

    return where;
  }

  async findById(id: string, options: AccountFindOptions = {}): Promise<AccountWithRelations | null> {
    const account = await this.prisma.adAccount.findUnique({
      where: { id },
      include: {
        identityProfile: {
          include: { gologinProfile: true },
        },
        mediaBuyer: true,
        connection: {
          select: { id: true, googleEmail: true, status: true },
        },
        checkIns: options.includeCheckIns
          ? { orderBy: { checkedAt: "desc" }, take: 10 }
          : undefined,
        activities: options.includeActivities
          ? { orderBy: { createdAt: "desc" }, take: 20, include: { createdByUser: true } }
          : undefined,
      },
    });

    return account as AccountWithRelations | null;
  }

  async findByInternalId(internalId: number): Promise<AccountWithRelations | null> {
    const account = await this.prisma.adAccount.findUnique({
      where: { internalId },
      include: {
        identityProfile: {
          include: { gologinProfile: true },
        },
        mediaBuyer: true,
        connection: {
          select: { id: true, googleEmail: true, status: true },
        },
      },
    });

    return account as AccountWithRelations | null;
  }

  async findByGoogleCid(googleCid: string): Promise<AccountWithRelations | null> {
    // Normalize CID
    const normalizedCid = googleCid.replace(/[-\s]/g, "");

    const account = await this.prisma.adAccount.findFirst({
      where: { googleCid: normalizedCid },
      include: {
        identityProfile: {
          include: { gologinProfile: true },
        },
        mediaBuyer: true,
        connection: {
          select: { id: true, googleEmail: true, status: true },
        },
      },
    });

    return account as AccountWithRelations | null;
  }

  async findAll(options: AccountFindOptions = {}): Promise<AccountWithRelations[]> {
    const accounts = await this.prisma.adAccount.findMany({
      where: this.buildWhere(options),
      include: this.buildInclude(options),
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    });

    return accounts as AccountWithRelations[];
  }

  async count(options: AccountFindOptions = {}): Promise<number> {
    return this.prisma.adAccount.count({
      where: this.buildWhere(options),
    });
  }

  async create(data: AdAccountCreateInput, userId?: string | null): Promise<AccountWithRelations> {
    // Normalize CID if provided
    let googleCid = data.googleCid;
    if (googleCid) {
      googleCid = googleCid.replace(/[-\s]/g, "");
    } else if (data.origin === "mcc-created") {
      // Generate mock CID for MCC-created accounts
      googleCid = `${Math.floor(100 + Math.random() * 900)}${Math.floor(100 + Math.random() * 900)}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const account = await this.prisma.adAccount.create({
      data: {
        identityProfileId: data.identityProfileId || null,
        origin: data.origin || "mcc-created",
        googleCid,
        status: "provisioned",
        handoffStatus: "available",
        warmupTargetSpend: data.warmupTargetSpend || 5000, // cents
        currentSpendTotal: 0,
        todaySpend: 0,
        adsCount: 0,
        campaignsCount: 0,
        notes: data.notes || null,
      },
      include: {
        identityProfile: {
          include: { gologinProfile: true },
        },
        mediaBuyer: true,
        connection: {
          select: { id: true, googleEmail: true, status: true },
        },
      },
    });

    // Log activity
    await this.logActivity(account.id, "CREATED",
      data.origin === "takeover"
        ? "Takeover account added to system"
        : "New MCC account created",
      userId
    );

    return account as AccountWithRelations;
  }

  async update(id: string, data: AdAccountUpdateInput, userId?: string | null): Promise<AccountWithRelations> {
    const updateData: Record<string, unknown> = {};

    if (data.googleCid !== undefined) {
      updateData.googleCid = data.googleCid?.replace(/[-\s]/g, "") || null;
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.warmupTargetSpend !== undefined) updateData.warmupTargetSpend = data.warmupTargetSpend;
    if (data.accountHealth !== undefined) updateData.accountHealth = data.accountHealth;
    if (data.billingStatus !== undefined) updateData.billingStatus = data.billingStatus;
    if (data.certStatus !== undefined) updateData.certStatus = data.certStatus;
    if (data.handoffStatus !== undefined) updateData.handoffStatus = data.handoffStatus;
    if (data.mediaBuyerId !== undefined) updateData.mediaBuyerId = data.mediaBuyerId;
    if (data.handoffDate !== undefined) updateData.handoffDate = data.handoffDate;
    if (data.handoffNotes !== undefined) updateData.handoffNotes = data.handoffNotes;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const account = await this.prisma.adAccount.update({
      where: { id },
      data: updateData,
      include: {
        identityProfile: {
          include: { gologinProfile: true },
        },
        mediaBuyer: true,
        connection: {
          select: { id: true, googleEmail: true, status: true },
        },
      },
    });

    return account as AccountWithRelations;
  }

  async delete(id: string): Promise<void> {
    // Delete related records first
    await this.prisma.accountCheckIn.deleteMany({ where: { adAccountId: id } });
    await this.prisma.accountActivity.deleteMany({ where: { adAccountId: id } });
    await this.prisma.dailySpendSnapshot.deleteMany({ where: { adAccountId: id } });
    await this.prisma.threadMessage.deleteMany({ where: { thread: { adAccountId: id } } });
    await this.prisma.accountThread.deleteMany({ where: { adAccountId: id } });
    await this.prisma.dismissedAlert.deleteMany({ where: { adAccountId: id } });

    // Finally delete the account
    await this.prisma.adAccount.delete({ where: { id } });
  }

  async archive(id: string, userId?: string | null): Promise<AccountWithRelations> {
    const account = await this.update(id, { handoffStatus: "archived" });
    await this.logActivity(id, "ARCHIVED", "Account archived", userId);
    return account;
  }

  async assignToMediaBuyer(
    id: string,
    mediaBuyerId: string,
    notes?: string,
    userId?: string | null
  ): Promise<AccountWithRelations> {
    const account = await this.update(id, {
      mediaBuyerId,
      handoffStatus: "handed-off",
      handoffDate: new Date(),
      handoffNotes: notes || null,
    });

    await this.logActivity(
      id,
      "HANDED_OFF",
      `Account handed off to media buyer${notes ? `: ${notes}` : ""}`,
      userId
    );

    return account;
  }

  async logActivity(
    accountId: string,
    action: string,
    details: string | null,
    userId?: string | null
  ): Promise<AccountActivity> {
    const activity = await this.prisma.accountActivity.create({
      data: {
        adAccountId: accountId,
        action,
        details,
        createdBy: userId || null,
      },
    });

    return activity as AccountActivity;
  }

  async addCheckIn(
    accountId: string,
    data: {
      dailySpend: number;
      totalSpend: number;
      adsCount: number;
      campaignsCount?: number;
      accountHealth: string;
      billingStatus: string;
      certStatus?: string | null;
      issues?: string | null;
      notes?: string | null;
    },
    userId?: string | null
  ): Promise<CheckIn> {
    // Create check-in record
    const checkIn = await this.prisma.accountCheckIn.create({
      data: {
        adAccountId: accountId,
        dailySpend: data.dailySpend,
        totalSpend: data.totalSpend,
        adsCount: data.adsCount,
        campaignsCount: data.campaignsCount || 0,
        accountHealth: data.accountHealth,
        billingStatus: data.billingStatus,
        certStatus: data.certStatus || null,
        issues: data.issues || null,
        notes: data.notes || null,
        checkedBy: userId || null,
      },
    });

    // Update account with latest data
    await this.prisma.adAccount.update({
      where: { id: accountId },
      data: {
        currentSpendTotal: Math.round(data.totalSpend * 100), // Convert to cents
        todaySpend: Math.round(data.dailySpend * 100),
        adsCount: data.adsCount,
        campaignsCount: data.campaignsCount || 0,
        accountHealth: data.accountHealth,
        billingStatus: data.billingStatus,
        certStatus: data.certStatus || null,
      },
    });

    return checkIn as unknown as CheckIn;
  }

  async getNeedsAttention(): Promise<{
    accounts: NeedsAttentionAccount[];
    summary: { total: number; critical: number; warning: number; info: number };
  }> {
    // Get all non-archived accounts
    const accounts = await this.prisma.adAccount.findMany({
      where: {
        handoffStatus: { not: "archived" },
      },
      include: {
        identityProfile: {
          select: { id: true, fullName: true, geo: true },
        },
        checkIns: {
          orderBy: { checkedAt: "desc" },
          take: 1,
        },
      },
    });

    // Get dismissed alerts
    const dismissedAlerts = await this.prisma.dismissedAlert.findMany();
    const dismissedSet = new Set(
      dismissedAlerts.map((d) => `${d.adAccountId}:${d.alertType}`)
    );

    const needsAttention: NeedsAttentionAccount[] = [];

    for (const account of accounts) {
      let alertType: AlertType | null = null;
      let alertReason = "";
      let alertPriority: AlertPriority = "info";

      // Check for issues in priority order
      if (account.accountHealth === "suspended") {
        alertType = "suspended";
        alertReason = "Account suspended";
        alertPriority = "critical";
      } else if (account.accountHealth === "banned") {
        alertType = "banned";
        alertReason = "Account banned";
        alertPriority = "critical";
      } else if (account.billingStatus === "failed") {
        alertType = "billing_failed";
        alertReason = "Billing failed";
        alertPriority = "critical";
      } else if (account.accountHealth === "limited") {
        alertType = "limited";
        alertReason = "Account limited";
        alertPriority = "warning";
      } else if (account.certStatus === "errored" || account.certStatus === "suspended") {
        alertType = "cert_error";
        alertReason = `Certification ${account.certStatus}`;
        alertPriority = "warning";
      }

      // Check for no recent check-in (only for handed-off accounts)
      const lastCheckIn = account.checkIns[0];
      let daysSinceCheckIn: number | null = null;
      if (lastCheckIn) {
        daysSinceCheckIn = Math.floor(
          (Date.now() - new Date(lastCheckIn.checkedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (
          !alertType &&
          account.handoffStatus === "handed-off" &&
          daysSinceCheckIn > 3
        ) {
          alertType = "no_checkin";
          alertReason = `No check-in for ${daysSinceCheckIn} days`;
          alertPriority = "warning";
        }
      }

      // Check for ready to handoff
      if (
        !alertType &&
        account.status === "ready" &&
        account.handoffStatus === "available"
      ) {
        alertType = "ready_handoff";
        alertReason = "Ready for handoff";
        alertPriority = "info";
      }

      if (alertType && !dismissedSet.has(`${account.id}:${alertType}`)) {
        needsAttention.push({
          id: account.id,
          internalId: account.internalId,
          googleCid: account.googleCid,
          accountHealth: account.accountHealth,
          billingStatus: account.billingStatus,
          certStatus: account.certStatus,
          currentSpendTotal: account.currentSpendTotal,
          warmupTargetSpend: account.warmupTargetSpend,
          handoffStatus: account.handoffStatus,
          identityProfile: account.identityProfile,
          lastCheckIn: lastCheckIn?.checkedAt || null,
          alertPriority,
          alertReason,
          alertType,
          daysSinceCheckIn,
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    needsAttention.sort(
      (a, b) => priorityOrder[a.alertPriority] - priorityOrder[b.alertPriority]
    );

    const summary = {
      total: needsAttention.length,
      critical: needsAttention.filter((a) => a.alertPriority === "critical").length,
      warning: needsAttention.filter((a) => a.alertPriority === "warning").length,
      info: needsAttention.filter((a) => a.alertPriority === "info").length,
    };

    return { accounts: needsAttention, summary };
  }

  async dismissAlert(accountId: string, alertType: AlertType, userId: string): Promise<void> {
    await this.prisma.dismissedAlert.upsert({
      where: {
        adAccountId_alertType: {
          adAccountId: accountId,
          alertType,
        },
      },
      create: {
        adAccountId: accountId,
        alertType,
        dismissedBy: userId,
      },
      update: {
        dismissedBy: userId,
        dismissedAt: new Date(),
      },
    });
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byHealth: Record<string, number>;
    byHandoff: Record<string, number>;
    totalSpend: number;
  }> {
    const accounts = await this.prisma.adAccount.findMany({
      where: { handoffStatus: { not: "archived" } },
      select: {
        status: true,
        accountHealth: true,
        handoffStatus: true,
        currentSpendTotal: true,
      },
    });

    const byStatus: Record<string, number> = {};
    const byHealth: Record<string, number> = {};
    const byHandoff: Record<string, number> = {};
    let totalSpend = 0;

    for (const account of accounts) {
      byStatus[account.status] = (byStatus[account.status] || 0) + 1;
      byHealth[account.accountHealth] = (byHealth[account.accountHealth] || 0) + 1;
      byHandoff[account.handoffStatus] = (byHandoff[account.handoffStatus] || 0) + 1;
      totalSpend += account.currentSpendTotal;
    }

    return {
      total: accounts.length,
      byStatus,
      byHealth,
      byHandoff,
      totalSpend,
    };
  }
}

export const accountRepository = new AccountRepository();
