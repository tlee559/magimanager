// ============================================================================
// APPEAL TRACKING SERVICE
// Manages appeal tracking for ad accounts in "in-appeal" status
// - Auto-creates tracking when account goes to in-appeal
// - Tracks appeal attempts, deadlines, notes
// - Resolves appeals and integrates with decommission system
// ============================================================================

import { getPrisma } from "../repositories/base.repository";
import { sendMessage as sendTelegramMessage } from "../integrations/telegram-bot";
import type { AppealMethod, AppealResolution, AppealTracking } from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AppealTrackingWithAccount extends AppealTracking {
  adAccount: {
    id: string;
    internalId: number;
    googleCid: string | null;
    accountHealth: string;
    identityProfile: {
      id: string;
      fullName: string;
    } | null;
  };
}

export interface UpdateAppealInput {
  appealNotes?: string;
  appealDeadline?: Date | null;
}

// ============================================================================
// APPEAL TRACKING SERVICE CLASS
// ============================================================================

class AppealTrackingService {
  /**
   * Start tracking an appeal for an account
   * Called automatically when account status changes to "in-appeal"
   */
  async startAppealTracking(accountId: string): Promise<ServiceResult<AppealTrackingWithAccount>> {
    const prisma = getPrisma();

    try {
      // Check if account exists
      const account = await prisma.adAccount.findUnique({
        where: { id: accountId },
        include: { identityProfile: true },
      });

      if (!account) {
        return { success: false, error: "Account not found" };
      }

      // Check if tracking already exists
      const existing = await prisma.appealTracking.findUnique({
        where: { adAccountId: accountId },
      });

      if (existing) {
        // Reset the tracking for a new appeal
        const updated = await prisma.appealTracking.update({
          where: { id: existing.id },
          data: {
            appealStartDate: new Date(),
            appealAttempts: 1,
            appealDeadline: null,
            appealNotes: null,
            lastAppealDate: null,
            lastAppealMethod: null,
            resolvedAt: null,
            resolution: null,
          },
          include: {
            adAccount: {
              include: { identityProfile: true },
            },
          },
        });

        console.log(`[Appeal] Reset tracking for account ${account.internalId}`);

        return {
          success: true,
          data: updated as AppealTrackingWithAccount,
        };
      }

      // Create new tracking
      const tracking = await prisma.appealTracking.create({
        data: {
          adAccountId: accountId,
          appealStartDate: new Date(),
          appealAttempts: 1,
        },
        include: {
          adAccount: {
            include: { identityProfile: true },
          },
        },
      });

      console.log(`[Appeal] Started tracking for account ${account.internalId}`);

      return {
        success: true,
        data: tracking as AppealTrackingWithAccount,
      };
    } catch (error) {
      console.error("[Appeal] Failed to start tracking:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Get appeal tracking for an account
   */
  async getByAccountId(accountId: string): Promise<ServiceResult<AppealTrackingWithAccount | null>> {
    const prisma = getPrisma();

    try {
      const tracking = await prisma.appealTracking.findUnique({
        where: { adAccountId: accountId },
        include: {
          adAccount: {
            include: { identityProfile: true },
          },
        },
      });

      return {
        success: true,
        data: tracking as AppealTrackingWithAccount | null,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Update appeal tracking details
   */
  async updateAppeal(
    accountId: string,
    data: UpdateAppealInput
  ): Promise<ServiceResult<AppealTrackingWithAccount>> {
    const prisma = getPrisma();

    try {
      const tracking = await prisma.appealTracking.findUnique({
        where: { adAccountId: accountId },
      });

      if (!tracking) {
        return { success: false, error: "Appeal tracking not found" };
      }

      const updated = await prisma.appealTracking.update({
        where: { id: tracking.id },
        data: {
          appealNotes: data.appealNotes ?? tracking.appealNotes,
          appealDeadline: data.appealDeadline !== undefined ? data.appealDeadline : tracking.appealDeadline,
        },
        include: {
          adAccount: {
            include: { identityProfile: true },
          },
        },
      });

      console.log(`[Appeal] Updated tracking for account ${accountId}`);

      return {
        success: true,
        data: updated as AppealTrackingWithAccount,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Log a new appeal attempt
   */
  async logAppealAttempt(
    accountId: string,
    method: AppealMethod
  ): Promise<ServiceResult<AppealTrackingWithAccount>> {
    const prisma = getPrisma();

    try {
      const tracking = await prisma.appealTracking.findUnique({
        where: { adAccountId: accountId },
      });

      if (!tracking) {
        return { success: false, error: "Appeal tracking not found" };
      }

      const updated = await prisma.appealTracking.update({
        where: { id: tracking.id },
        data: {
          appealAttempts: tracking.appealAttempts + 1,
          lastAppealDate: new Date(),
          lastAppealMethod: method,
        },
        include: {
          adAccount: {
            include: { identityProfile: true },
          },
        },
      });

      console.log(`[Appeal] Logged attempt #${updated.appealAttempts} for account ${accountId} via ${method}`);

      return {
        success: true,
        data: updated as AppealTrackingWithAccount,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Resolve an appeal
   * - "reinstated": Account is back, clear appeal tracking
   * - "banned": Account permanently banned, trigger decommission
   * - "abandoned": User gave up, trigger decommission
   */
  async resolveAppeal(
    accountId: string,
    resolution: AppealResolution
  ): Promise<ServiceResult<AppealTrackingWithAccount>> {
    const prisma = getPrisma();

    try {
      const tracking = await prisma.appealTracking.findUnique({
        where: { adAccountId: accountId },
        include: {
          adAccount: {
            include: { identityProfile: true },
          },
        },
      });

      if (!tracking) {
        return { success: false, error: "Appeal tracking not found" };
      }

      // Update tracking
      const updated = await prisma.appealTracking.update({
        where: { id: tracking.id },
        data: {
          resolvedAt: new Date(),
          resolution,
        },
        include: {
          adAccount: {
            include: { identityProfile: true },
          },
        },
      });

      // Update account health based on resolution
      let newHealth: string;
      switch (resolution) {
        case "reinstated":
          newHealth = "active";
          break;
        case "banned":
          newHealth = "banned";
          break;
        case "abandoned":
          newHealth = "banned"; // Treat abandoned as effectively banned
          break;
        default:
          newHealth = "unknown";
      }

      await prisma.adAccount.update({
        where: { id: accountId },
        data: {
          accountHealth: newHealth,
          statusChangedAt: new Date(),
        },
      });

      // Log activity
      await prisma.accountActivity.create({
        data: {
          adAccountId: accountId,
          action: "APPEAL_RESOLVED",
          details: `Appeal resolved: ${resolution}`,
        },
      });

      console.log(`[Appeal] Resolved for account ${accountId}: ${resolution}`);

      // If banned or abandoned, the account service will trigger decommission
      // via the checkAndFireDecommissionAlert which checks for banned status

      return {
        success: true,
        data: updated as AppealTrackingWithAccount,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Get all accounts with approaching appeal deadlines
   */
  async getApproachingDeadlines(withinDays: number = 3): Promise<ServiceResult<AppealTrackingWithAccount[]>> {
    const prisma = getPrisma();

    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + withinDays);

      const trackings = await prisma.appealTracking.findMany({
        where: {
          resolvedAt: null,
          appealDeadline: {
            not: null,
            lte: futureDate,
          },
          adAccount: {
            accountHealth: "in-appeal",
          },
        },
        include: {
          adAccount: {
            include: { identityProfile: true },
          },
        },
        orderBy: { appealDeadline: "asc" },
      });

      return {
        success: true,
        data: trackings as AppealTrackingWithAccount[],
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Get all active appeal trackings
   */
  async getActiveAppeals(): Promise<ServiceResult<AppealTrackingWithAccount[]>> {
    const prisma = getPrisma();

    try {
      const trackings = await prisma.appealTracking.findMany({
        where: {
          resolvedAt: null,
          adAccount: {
            accountHealth: "in-appeal",
          },
        },
        include: {
          adAccount: {
            include: { identityProfile: true },
          },
        },
        orderBy: { appealStartDate: "desc" },
      });

      return {
        success: true,
        data: trackings as AppealTrackingWithAccount[],
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Send notifications for approaching deadlines
   */
  async sendDeadlineReminders(): Promise<void> {
    const prisma = getPrisma();
    const settings = await prisma.appSettings.findFirst();
    if (!settings) return;

    const result = await this.getApproachingDeadlines(3);
    if (!result.success || !result.data || result.data.length === 0) return;

    for (const tracking of result.data) {
      const daysUntil = tracking.appealDeadline
        ? Math.ceil((tracking.appealDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

      const identityName = tracking.adAccount.identityProfile?.fullName || "Unknown";
      const message = `Account #${tracking.adAccount.internalId} (${identityName})\nAppeal deadline in ${daysUntil} days\nAttempts: ${tracking.appealAttempts}`;

      // In-app notification
      if (settings.decommissionAlertViaApp) {
        await prisma.notification.create({
          data: {
            type: "APPEAL_DEADLINE_APPROACHING",
            title: "Appeal Deadline Approaching",
            message,
            entityId: tracking.adAccount.id,
            entityType: "account",
            priority: "warning",
          },
        });
      }

      // Telegram
      if (settings.decommissionAlertViaTelegram && settings.telegramBotToken && settings.telegramChatId) {
        const telegramMessage = `⚠️ *Appeal Deadline Approaching*\n\n${escapeMarkdown(message)}`;
        await sendTelegramMessage(telegramMessage, settings.telegramChatId);
      }
    }
  }

  /**
   * Calculate days in appeal for an account
   */
  getDaysInAppeal(tracking: AppealTracking): number {
    return Math.floor(
      (Date.now() - tracking.appealStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function escapeMarkdown(text: string): string {
  const linkPattern = /(\[[^\]]+\]\([^)]+\))|(https?:\/\/[^\s]+)/g;
  const parts = text.split(linkPattern);

  return parts
    .filter(part => part !== undefined)
    .map(part => {
      if (/^\[[^\]]+\]\([^)]+\)$/.test(part) || /^https?:\/\//.test(part)) {
        return part;
      }
      return part.replace(/[_*[\]()~`>#+=|{}.!]/g, "\\$&");
    })
    .join("");
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const appealTrackingService = new AppealTrackingService();
