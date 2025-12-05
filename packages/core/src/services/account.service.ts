// ============================================================================
// ACCOUNT SERVICE - Business logic for AdAccount operations
// ============================================================================

import {
  accountRepository,
  identityRepository,
  type AccountFindOptions,
  type AccountWithRelations,
} from "../repositories";
import type { ServiceResult } from "../repositories/base.repository";
import type {
  AdAccountCreateInput,
  AdAccountUpdateInput,
  CheckIn,
  AccountActivity,
  NeedsAttentionAccount,
  AlertType,
} from "@magimanager/shared";
import { checkAndFireDecommissionAlert } from "./decommission-alert.service";
import { createCustomerClient } from "./google-ads.service";
import { decryptToken } from "./oauth.service";
import { getPrisma } from "../repositories/base.repository";

class AccountService {
  async getById(
    id: string,
    options: AccountFindOptions = {}
  ): Promise<ServiceResult<AccountWithRelations>> {
    try {
      const account = await accountRepository.findById(id, options);
      if (!account) {
        return { success: false, error: "Account not found" };
      }
      return { success: true, data: account };
    } catch (error) {
      console.error("AccountService.getById error:", error);
      return { success: false, error: "Failed to fetch account" };
    }
  }

  async getByInternalId(internalId: number): Promise<ServiceResult<AccountWithRelations>> {
    try {
      const account = await accountRepository.findByInternalId(internalId);
      if (!account) {
        return { success: false, error: "Account not found" };
      }
      return { success: true, data: account };
    } catch (error) {
      console.error("AccountService.getByInternalId error:", error);
      return { success: false, error: "Failed to fetch account" };
    }
  }

  async getByGoogleCid(googleCid: string): Promise<ServiceResult<AccountWithRelations>> {
    try {
      const account = await accountRepository.findByGoogleCid(googleCid);
      if (!account) {
        return { success: false, error: "Account not found" };
      }
      return { success: true, data: account };
    } catch (error) {
      console.error("AccountService.getByGoogleCid error:", error);
      return { success: false, error: "Failed to fetch account" };
    }
  }

  async getAll(options: AccountFindOptions = {}): Promise<ServiceResult<AccountWithRelations[]>> {
    try {
      const accounts = await accountRepository.findAll(options);
      return { success: true, data: accounts };
    } catch (error) {
      console.error("AccountService.getAll error:", error);
      return { success: false, error: "Failed to fetch accounts" };
    }
  }

  async create(
    data: AdAccountCreateInput,
    userId?: string | null
  ): Promise<ServiceResult<AccountWithRelations>> {
    try {
      // Validate identity if provided
      if (data.identityProfileId) {
        const identity = await identityRepository.findById(data.identityProfileId);
        if (!identity) {
          return { success: false, error: "Identity profile not found" };
        }

        // Check if identity already has an account (1:1 relationship)
        const existingByIdentity = await accountRepository.findAll({
          includeArchived: false,
        });
        const hasAccount = existingByIdentity.some(
          (a) => a.identityProfileId === data.identityProfileId
        );
        if (hasAccount) {
          return {
            success: false,
            error: "This identity is already linked to an account. Each identity can only have one account.",
          };
        }
      }

      // Validate CID uniqueness if provided
      if (data.googleCid) {
        const existingByCid = await accountRepository.findByGoogleCid(data.googleCid);
        if (existingByCid) {
          return {
            success: false,
            error: `CID ${data.googleCid} is already in use by account #${existingByCid.internalId}`,
          };
        }
      }

      // Require CID for takeover accounts
      if (data.origin === "takeover" && !data.googleCid) {
        return { success: false, error: "Google CID is required for takeover accounts" };
      }

      // Require identity for new accounts
      if (!data.identityProfileId && !data.newIdentity) {
        return { success: false, error: "Identity profile or new identity data is required" };
      }

      // Create identity inline if provided
      let identityId = data.identityProfileId;
      if (data.newIdentity && !identityId) {
        const identity = await identityRepository.create(data.newIdentity);
        identityId = identity.id;
      }

      // For MCC-created accounts, MUST create via Google Ads API
      let googleCid = data.googleCid;
      if (data.origin === "mcc-created" && !googleCid) {
        const prisma = getPrisma();
        const settings = await prisma.appSettings.findFirst({
          select: {
            mccCustomerId: true,
            mccConnectionId: true,
          },
        });

        if (!settings?.mccConnectionId || !settings?.mccCustomerId) {
          return {
            success: false,
            error: "MCC is not configured. Please connect your MCC in Settings first.",
          };
        }

        // Get the MCC connection's access token
        const connection = await prisma.googleAdsConnection.findUnique({
          where: { id: settings.mccConnectionId },
          select: { accessToken: true, status: true },
        });

        if (!connection || connection.status !== "active") {
          return {
            success: false,
            error: "MCC connection is not active. Please reconnect your MCC in Settings.",
          };
        }

        {
            try {
              const accessToken = decryptToken(connection.accessToken);

              // Get identity name and next internal ID for descriptive name
              // Format: "MM001 - John Smith" or "MM001 - New Account"
              const nextInternalId = await accountRepository.getNextInternalId();
              const internalIdStr = `MM${nextInternalId.toString().padStart(3, "0")}`;

              let identityName = "New Account";
              if (identityId) {
                const identity = await identityRepository.findById(identityId);
                if (identity) {
                  identityName = identity.fullName;
                }
              }

              const accountName = `${internalIdStr} - ${identityName}`;

              // Create the account via Google Ads API
              const result = await createCustomerClient(accessToken, settings.mccCustomerId, {
                descriptiveName: accountName,
                currencyCode: "USD",
                timeZone: "America/Los_Angeles",
              });

              if (result.success && result.customerId) {
                googleCid = result.customerId;
                console.log(`[AccountService] Created real Google Ads account: ${googleCid}`);
              } else {
                // Failed to create account via MCC - return error instead of creating fake account
                console.error(`[AccountService] Failed to create Google Ads account: ${result.error}`);
                return {
                  success: false,
                  error: `Failed to create Google Ads account: ${result.error || "Unknown error"}`,
                };
              }
            } catch (error) {
              console.error("[AccountService] Error creating Google Ads account:", error);
              return {
                success: false,
                error: `Error creating Google Ads account: ${error instanceof Error ? error.message : "Unknown error"}`,
              };
            }
        }
      }

      const account = await accountRepository.create(
        { ...data, identityProfileId: identityId, googleCid },
        userId
      );

      return { success: true, data: account };
    } catch (error) {
      console.error("AccountService.create error:", error);
      return { success: false, error: "Failed to create account" };
    }
  }

  async update(
    id: string,
    data: AdAccountUpdateInput,
    userId?: string | null
  ): Promise<ServiceResult<AccountWithRelations>> {
    try {
      const existing = await accountRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Account not found" };
      }

      // Validate CID uniqueness if changing
      if (data.googleCid && data.googleCid !== existing.googleCid) {
        const existingByCid = await accountRepository.findByGoogleCid(data.googleCid);
        if (existingByCid && existingByCid.id !== id) {
          return {
            success: false,
            error: `CID ${data.googleCid} is already in use by account #${existingByCid.internalId}`,
          };
        }
      }

      const account = await accountRepository.update(id, data, userId);

      // Log significant changes
      if (data.status && data.status !== existing.status) {
        await accountRepository.logActivity(id, "STATUS_CHANGED", `Status changed to ${data.status}`, userId);
      }
      if (data.accountHealth && data.accountHealth !== existing.accountHealth) {
        await accountRepository.logActivity(
          id,
          "HEALTH_CHANGED",
          `Health changed to ${data.accountHealth}`,
          userId
        );

        // Check for decommission alert if account became suspended/banned
        if (data.accountHealth === "suspended" || data.accountHealth === "banned") {
          await checkAndFireDecommissionAlert(id, existing.identityProfileId);
        }
      }

      // Check for decommission alert if account was archived via update
      if (data.handoffStatus === "archived" && existing.handoffStatus !== "archived") {
        await accountRepository.logActivity(id, "ARCHIVED", "Account archived", userId);
        await checkAndFireDecommissionAlert(id, existing.identityProfileId);
      }

      return { success: true, data: account };
    } catch (error) {
      console.error("AccountService.update error:", error);
      return { success: false, error: "Failed to update account" };
    }
  }

  async delete(id: string, userId?: string | null): Promise<ServiceResult<void>> {
    try {
      const existing = await accountRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Account not found" };
      }

      const identityId = existing.identityProfileId; // Save before delete
      await accountRepository.delete(id);

      // Check for decommission alert
      await checkAndFireDecommissionAlert(id, identityId);

      return { success: true };
    } catch (error) {
      console.error("AccountService.delete error:", error);
      return { success: false, error: "Failed to delete account" };
    }
  }

  async archive(id: string, userId?: string | null): Promise<ServiceResult<AccountWithRelations>> {
    try {
      const existing = await accountRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Account not found" };
      }

      const account = await accountRepository.archive(id, userId);

      // Check for decommission alert
      await checkAndFireDecommissionAlert(id, existing.identityProfileId);

      return { success: true, data: account };
    } catch (error) {
      console.error("AccountService.archive error:", error);
      return { success: false, error: "Failed to archive account" };
    }
  }

  async assignToMediaBuyer(
    id: string,
    mediaBuyerId: string,
    notes?: string,
    userId?: string | null
  ): Promise<ServiceResult<AccountWithRelations>> {
    try {
      const existing = await accountRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Account not found" };
      }

      // Check if account is ready for handoff
      if (existing.status !== "ready" && existing.handoffStatus !== "available") {
        return {
          success: false,
          error: "Account must be in 'ready' status and available for handoff",
        };
      }

      const account = await accountRepository.assignToMediaBuyer(id, mediaBuyerId, notes, userId);
      return { success: true, data: account };
    } catch (error) {
      console.error("AccountService.assignToMediaBuyer error:", error);
      return { success: false, error: "Failed to assign account" };
    }
  }

  async addCheckIn(
    id: string,
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
  ): Promise<ServiceResult<CheckIn>> {
    try {
      const existing = await accountRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Account not found" };
      }

      const checkIn = await accountRepository.addCheckIn(id, data, userId);
      await accountRepository.logActivity(
        id,
        "CHECK_IN",
        `Check-in: $${data.dailySpend.toFixed(2)} daily, $${data.totalSpend.toFixed(2)} total`,
        userId
      );

      // Auto-update status based on spend progress
      const warmupProgress = (data.totalSpend * 100) / (existing.warmupTargetSpend / 100);
      if (warmupProgress >= 100 && existing.status === "warming-up") {
        await accountRepository.update(id, { status: "ready" }, userId);
        await accountRepository.logActivity(id, "STATUS_CHANGED", "Warmup complete - marked as ready", userId);
      } else if (data.totalSpend > 0 && existing.status === "provisioned") {
        await accountRepository.update(id, { status: "warming-up" }, userId);
        await accountRepository.logActivity(id, "STATUS_CHANGED", "Started warming up", userId);
      }

      return { success: true, data: checkIn };
    } catch (error) {
      console.error("AccountService.addCheckIn error:", error);
      return { success: false, error: "Failed to add check-in" };
    }
  }

  async logActivity(
    id: string,
    action: string,
    details: string | null,
    userId?: string | null
  ): Promise<ServiceResult<AccountActivity>> {
    try {
      const existing = await accountRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Account not found" };
      }

      const activity = await accountRepository.logActivity(id, action, details, userId);
      return { success: true, data: activity };
    } catch (error) {
      console.error("AccountService.logActivity error:", error);
      return { success: false, error: "Failed to log activity" };
    }
  }

  async getNeedsAttention(): Promise<
    ServiceResult<{
      accounts: NeedsAttentionAccount[];
      summary: { total: number; critical: number; warning: number; info: number };
    }>
  > {
    try {
      const result = await accountRepository.getNeedsAttention();
      return { success: true, data: result };
    } catch (error) {
      console.error("AccountService.getNeedsAttention error:", error);
      return { success: false, error: "Failed to fetch alerts" };
    }
  }

  async dismissAlert(
    accountId: string,
    alertType: AlertType,
    userId: string
  ): Promise<ServiceResult<void>> {
    try {
      await accountRepository.dismissAlert(accountId, alertType, userId);
      return { success: true };
    } catch (error) {
      console.error("AccountService.dismissAlert error:", error);
      return { success: false, error: "Failed to dismiss alert" };
    }
  }

  async getStats(): Promise<
    ServiceResult<{
      total: number;
      byStatus: Record<string, number>;
      byHealth: Record<string, number>;
      byHandoff: Record<string, number>;
      totalSpend: number;
    }>
  > {
    try {
      const stats = await accountRepository.getStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error("AccountService.getStats error:", error);
      return { success: false, error: "Failed to fetch stats" };
    }
  }

  async simulateWarmupProgress(
    id: string,
    spendAmount: number,
    userId?: string | null
  ): Promise<ServiceResult<AccountWithRelations>> {
    try {
      const existing = await accountRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Account not found" };
      }

      const newTotalSpend = existing.currentSpendTotal + Math.round(spendAmount * 100);
      const warmupProgress = (newTotalSpend / existing.warmupTargetSpend) * 100;

      // Update account spend
      const updateData: AdAccountUpdateInput = {};

      // Auto-transition status
      if (warmupProgress >= 100 && existing.status !== "ready") {
        updateData.status = "ready";
      } else if (newTotalSpend > 0 && existing.status === "provisioned") {
        updateData.status = "warming-up";
      }

      // Update via repository (which handles spend updates in checkIn)
      await accountRepository.addCheckIn(
        id,
        {
          dailySpend: spendAmount,
          totalSpend: newTotalSpend / 100,
          adsCount: existing.adsCount,
          campaignsCount: existing.campaignsCount,
          accountHealth: existing.accountHealth,
          billingStatus: existing.billingStatus,
          certStatus: existing.certStatus,
        },
        userId
      );

      if (Object.keys(updateData).length > 0) {
        await accountRepository.update(id, updateData, userId);
      }

      await accountRepository.logActivity(
        id,
        "WARMUP_SIMULATED",
        `Simulated $${spendAmount.toFixed(2)} spend`,
        userId
      );

      // Fetch updated account
      const account = await accountRepository.findById(id);
      return { success: true, data: account! };
    } catch (error) {
      console.error("AccountService.simulateWarmupProgress error:", error);
      return { success: false, error: "Failed to simulate warmup" };
    }
  }
}

export const accountService = new AccountService();
