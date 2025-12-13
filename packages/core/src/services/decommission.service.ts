// ============================================================================
// DECOMMISSION SERVICE
// Comprehensive service for managing identity decommissioning
// - Tracks decommission jobs
// - Cleans up external resources (droplets, domains, GoLogin)
// - Sends notifications at every step
// - Supports manual and auto-triggered decommissioning
// ============================================================================

import { getPrisma } from "../repositories/base.repository";
import { sendMessage as sendTelegramMessage } from "../integrations/telegram-bot";
import { getDigitalOceanClientFromSettings } from "../integrations/digitalocean";
import { getNamecheapClientFromSettings } from "../integrations/namecheap";
import type {
  DecommissionTriggerType,
  DecommissionJobType,
  DecommissionJobStatus,
  DecommissionResourceStatuses,
} from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

export interface CleanupResult {
  success: boolean;
  verified: boolean;
  error?: string;
  details?: string;
}

export interface DecommissionJobWithIdentity {
  id: string;
  identityProfileId: string;
  triggerType: string;
  triggeredBy: string | null;
  triggeredAt: Date;
  jobType: string;
  status: string;
  completedAt: Date | null;
  resourceStatus: DecommissionResourceStatuses;
  errorMessage: string | null;
  scheduledFor: Date | null;
  reminderSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  identityProfile: {
    id: string;
    fullName: string;
    geo: string;
    website: string | null;
    linkedWebsite: {
      id: string;
      name: string;
      domain: string | null;
      dropletId: string | null;
      dropletIp: string | null;
    } | null;
    gologinProfile: {
      id: string;
      profileId: string | null;
    } | null;
    adAccounts: {
      id: string;
      internalId: number;
      googleCid: string | null;
      accountHealth: string;
      handoffStatus: string;
    }[];
  };
}

export interface StartDecommissionOptions {
  triggerType: DecommissionTriggerType;
  triggeredBy?: string;
  jobType: DecommissionJobType;
  scheduledFor?: Date;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// DECOMMISSION SERVICE CLASS
// ============================================================================

class DecommissionService {
  // ============================================================================
  // JOB MANAGEMENT
  // ============================================================================

  /**
   * Start a decommission job for an identity
   */
  async startDecommission(
    identityId: string,
    options: StartDecommissionOptions
  ): Promise<ServiceResult<DecommissionJobWithIdentity>> {
    const prisma = getPrisma();

    try {
      // Check if identity exists
      const identity = await prisma.identityProfile.findUnique({
        where: { id: identityId },
        include: {
          linkedWebsite: true,
          gologinProfile: true,
          adAccounts: {
            where: { handoffStatus: { not: "archived" } },
          },
        },
      });

      if (!identity) {
        return { success: false, error: "Identity not found" };
      }

      // Check if there's already an active job for this identity
      const existingJob = await prisma.decommissionJob.findUnique({
        where: { identityProfileId: identityId },
      });

      if (existingJob && existingJob.status !== "completed" && existingJob.status !== "cancelled" && existingJob.status !== "failed") {
        return { success: false, error: "A decommission job already exists for this identity" };
      }

      // Determine initial resource status based on what exists
      const resourceStatus: DecommissionResourceStatuses = {
        droplet: identity.linkedWebsite?.dropletId ? "pending" : "skipped",
        domain: identity.linkedWebsite?.domain ? "pending" : "skipped",
        gologin: identity.gologinProfile?.profileId ? "pending" : "skipped",
        account: identity.adAccounts.length > 0 ? "pending" : "skipped",
      };

      // Create or update the job
      const job = existingJob
        ? await prisma.decommissionJob.update({
            where: { id: existingJob.id },
            data: {
              triggerType: options.triggerType,
              triggeredBy: options.triggeredBy,
              triggeredAt: new Date(),
              jobType: options.jobType,
              status: "pending",
              completedAt: null,
              resourceStatus: JSON.stringify(resourceStatus),
              errorMessage: null,
              scheduledFor: options.scheduledFor,
              reminderSentAt: null,
            },
            include: {
              identityProfile: {
                include: {
                  linkedWebsite: true,
                  gologinProfile: true,
                  adAccounts: true,
                },
              },
            },
          })
        : await prisma.decommissionJob.create({
            data: {
              identityProfileId: identityId,
              triggerType: options.triggerType,
              triggeredBy: options.triggeredBy,
              jobType: options.jobType,
              resourceStatus: JSON.stringify(resourceStatus),
              scheduledFor: options.scheduledFor,
            },
            include: {
              identityProfile: {
                include: {
                  linkedWebsite: true,
                  gologinProfile: true,
                  adAccounts: true,
                },
              },
            },
          });

      // Parse resource status
      const parsedJob: DecommissionJobWithIdentity = {
        ...job,
        resourceStatus: JSON.parse(job.resourceStatus),
      };

      // Send notification if scheduled for later
      if (options.scheduledFor) {
        await this.sendDecommissionScheduledNotification(parsedJob);
      }

      console.log(`[Decommission] Job created for identity ${identity.fullName} (${identityId})`);

      return { success: true, data: parsedJob };
    } catch (error) {
      console.error("[Decommission] Failed to start decommission:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Cancel a pending decommission job
   */
  async cancelDecommission(jobId: string): Promise<ServiceResult<void>> {
    const prisma = getPrisma();

    try {
      const job = await prisma.decommissionJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return { success: false, error: "Decommission job not found" };
      }

      if (job.status !== "pending") {
        return { success: false, error: `Cannot cancel job in '${job.status}' status` };
      }

      await prisma.decommissionJob.update({
        where: { id: jobId },
        data: { status: "cancelled" },
      });

      console.log(`[Decommission] Job ${jobId} cancelled`);

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Execute a decommission job - cleans up all resources
   */
  async executeDecommission(jobId: string): Promise<ServiceResult<DecommissionJobWithIdentity>> {
    const prisma = getPrisma();

    try {
      // Get the job with all related data
      const job = await prisma.decommissionJob.findUnique({
        where: { id: jobId },
        include: {
          identityProfile: {
            include: {
              linkedWebsite: true,
              gologinProfile: true,
              adAccounts: {
                where: { handoffStatus: { not: "archived" } },
              },
            },
          },
        },
      });

      if (!job) {
        return { success: false, error: "Decommission job not found" };
      }

      if (job.status !== "pending") {
        return { success: false, error: `Cannot execute job in '${job.status}' status` };
      }

      // Update status to in_progress
      await prisma.decommissionJob.update({
        where: { id: jobId },
        data: { status: "in_progress" },
      });

      const resourceStatus: DecommissionResourceStatuses = JSON.parse(job.resourceStatus);
      const errors: string[] = [];
      const identity = job.identityProfile;

      console.log(`[Decommission] Executing job ${jobId} for identity ${identity.fullName}`);

      // 1. Clean up droplet
      if (resourceStatus.droplet === "pending" && identity.linkedWebsite?.dropletId) {
        console.log(`[Decommission] Cleaning up droplet ${identity.linkedWebsite.dropletId}`);
        const dropletResult = await this.cleanupDroplet(identity.linkedWebsite.id);
        resourceStatus.droplet = dropletResult.success && dropletResult.verified ? "completed" : "failed";
        if (dropletResult.error) errors.push(`Droplet: ${dropletResult.error}`);
      }

      // 2. Disable domain auto-renewal
      if (resourceStatus.domain === "pending" && identity.linkedWebsite?.domain) {
        console.log(`[Decommission] Disabling auto-renewal for domain ${identity.linkedWebsite.domain}`);
        const domainResult = await this.disableDomainAutoRenewal(identity.linkedWebsite.domain);
        resourceStatus.domain = domainResult.success ? "completed" : "failed";
        if (domainResult.error) errors.push(`Domain: ${domainResult.error}`);
      }

      // 3. Clean up GoLogin profile
      if (resourceStatus.gologin === "pending" && identity.gologinProfile?.profileId) {
        console.log(`[Decommission] Cleaning up GoLogin profile ${identity.gologinProfile.profileId}`);
        const gologinResult = await this.cleanupGoLoginProfile(identity.id);
        resourceStatus.gologin = gologinResult.success ? "completed" : "failed";
        if (gologinResult.error) errors.push(`GoLogin: ${gologinResult.error}`);
      }

      // 4. Archive ad accounts
      if (resourceStatus.account === "pending") {
        for (const account of identity.adAccounts) {
          console.log(`[Decommission] Archiving ad account ${account.internalId}`);
          const accountResult = await this.archiveAdAccount(account.id);
          if (!accountResult.success) {
            errors.push(`Account ${account.internalId}: ${accountResult.error}`);
          }
        }
        resourceStatus.account = errors.some(e => e.startsWith("Account")) ? "failed" : "completed";
      }

      // 5. Archive identity (for archive job type) or mark as decommissioned
      const allCompleted = Object.values(resourceStatus).every(s => s === "completed" || s === "skipped");
      const hasFailures = Object.values(resourceStatus).some(s => s === "failed");

      const finalStatus: DecommissionJobStatus = allCompleted ? "completed" : hasFailures ? "failed" : "completed";

      // Update identity
      if (finalStatus === "completed") {
        await prisma.identityProfile.update({
          where: { id: identity.id },
          data: {
            decommissionedAt: new Date(),
            archived: job.jobType === "archive" || job.jobType === "delete",
            archivedAt: job.jobType === "archive" ? new Date() : undefined,
          },
        });
      }

      // Update job
      const updatedJob = await prisma.decommissionJob.update({
        where: { id: jobId },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          resourceStatus: JSON.stringify(resourceStatus),
          errorMessage: errors.length > 0 ? errors.join("\n") : null,
        },
        include: {
          identityProfile: {
            include: {
              linkedWebsite: true,
              gologinProfile: true,
              adAccounts: true,
            },
          },
        },
      });

      const parsedJob: DecommissionJobWithIdentity = {
        ...updatedJob,
        resourceStatus,
      };

      // Send completion notification
      if (finalStatus === "completed") {
        await this.sendDecommissionCompletedNotification(parsedJob);
      } else {
        await this.sendDecommissionFailedNotification(parsedJob, errors);
      }

      console.log(`[Decommission] Job ${jobId} ${finalStatus}`);

      return { success: true, data: parsedJob };
    } catch (error) {
      console.error("[Decommission] Failed to execute decommission:", error);

      // Update job to failed
      await prisma.decommissionJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });

      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Get all decommission jobs
   */
  async getJobs(filter?: { status?: DecommissionJobStatus }): Promise<ServiceResult<DecommissionJobWithIdentity[]>> {
    const prisma = getPrisma();

    try {
      const jobs = await prisma.decommissionJob.findMany({
        where: filter?.status ? { status: filter.status } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          identityProfile: {
            include: {
              linkedWebsite: true,
              gologinProfile: true,
              adAccounts: true,
            },
          },
        },
      });

      const parsedJobs = jobs.map(job => ({
        ...job,
        resourceStatus: JSON.parse(job.resourceStatus) as DecommissionResourceStatuses,
      }));

      return { success: true, data: parsedJobs };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Get a single decommission job by ID
   */
  async getJob(jobId: string): Promise<ServiceResult<DecommissionJobWithIdentity>> {
    const prisma = getPrisma();

    try {
      const job = await prisma.decommissionJob.findUnique({
        where: { id: jobId },
        include: {
          identityProfile: {
            include: {
              linkedWebsite: true,
              gologinProfile: true,
              adAccounts: true,
            },
          },
        },
      });

      if (!job) {
        return { success: false, error: "Decommission job not found" };
      }

      return {
        success: true,
        data: {
          ...job,
          resourceStatus: JSON.parse(job.resourceStatus) as DecommissionResourceStatuses,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // ============================================================================
  // RESOURCE CLEANUP METHODS
  // ============================================================================

  /**
   * Delete DigitalOcean droplet and verify
   */
  async cleanupDroplet(websiteId: string): Promise<CleanupResult> {
    const prisma = getPrisma();

    try {
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
      });

      if (!website?.dropletId) {
        return { success: true, verified: true, details: "No droplet to clean up" };
      }

      const doClient = await getDigitalOceanClientFromSettings();
      const result = await doClient.deleteDropletWithVerification(parseInt(website.dropletId));

      if (result.success) {
        // Clear droplet info from website
        await prisma.website.update({
          where: { id: websiteId },
          data: {
            dropletId: null,
            dropletIp: null,
            status: "DOMAIN_PURCHASED",
            statusMessage: "Droplet deleted during decommission",
          },
        });
      }

      return {
        success: result.success,
        verified: result.verified,
        error: result.error,
        details: result.success ? `Droplet ${website.dropletId} deleted` : undefined,
      };
    } catch (error) {
      return {
        success: false,
        verified: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Disable domain auto-renewal on Namecheap
   */
  async disableDomainAutoRenewal(domain: string): Promise<CleanupResult> {
    try {
      const ncClient = await getNamecheapClientFromSettings();
      const result = await ncClient.disableAutoRenewal(domain);

      return {
        success: result.success || result.verified, // Consider success if verified even if API call had issues
        verified: result.verified,
        error: result.error,
        details: result.expirationDate ? `Domain expires: ${result.expirationDate}` : undefined,
      };
    } catch (error) {
      return {
        success: false,
        verified: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Delete GoLogin profile
   */
  async cleanupGoLoginProfile(identityId: string): Promise<CleanupResult> {
    const prisma = getPrisma();

    try {
      const gologinProfile = await prisma.goLoginProfile.findUnique({
        where: { identityProfileId: identityId },
      });

      if (!gologinProfile?.profileId) {
        return { success: true, verified: true, details: "No GoLogin profile to clean up" };
      }

      // Get GoLogin API token from settings
      const settings = await prisma.appSettings.findFirst();
      if (!settings?.gologinApiKey) {
        return { success: false, verified: false, error: "GoLogin API token not configured" };
      }

      // Delete from GoLogin API
      const response = await fetch(`https://api.gologin.com/browser/${gologinProfile.profileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${settings.gologinApiKey}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        return {
          success: false,
          verified: false,
          error: `GoLogin API error: ${response.status} - ${errorText}`,
        };
      }

      // Delete from database
      await prisma.goLoginProfile.delete({
        where: { id: gologinProfile.id },
      });

      return {
        success: true,
        verified: true,
        details: `GoLogin profile ${gologinProfile.profileId} deleted`,
      };
    } catch (error) {
      return {
        success: false,
        verified: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Archive an ad account
   */
  async archiveAdAccount(accountId: string): Promise<CleanupResult> {
    const prisma = getPrisma();

    try {
      await prisma.adAccount.update({
        where: { id: accountId },
        data: { handoffStatus: "archived" },
      });

      // Log activity
      await prisma.accountActivity.create({
        data: {
          adAccountId: accountId,
          action: "ARCHIVED",
          details: "Archived during identity decommission",
        },
      });

      return {
        success: true,
        verified: true,
        details: `Account ${accountId} archived`,
      };
    } catch (error) {
      return {
        success: false,
        verified: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // AUTO-DECOMMISSION SCHEDULING
  // ============================================================================

  /**
   * Get identities that are candidates for auto-decommission based on settings
   */
  async getAutoDecommissionCandidates(): Promise<ServiceResult<{
    suspended: { id: string; fullName: string; daysSuspended: number }[];
    inAppeal: { id: string; fullName: string; daysInAppeal: number }[];
    inactive: { id: string; fullName: string; daysInactive: number }[];
  }>> {
    const prisma = getPrisma();

    try {
      const settings = await prisma.appSettings.findFirst();
      if (!settings) {
        return { success: false, error: "No settings found" };
      }

      const now = new Date();
      const candidates = {
        suspended: [] as { id: string; fullName: string; daysSuspended: number }[],
        inAppeal: [] as { id: string; fullName: string; daysInAppeal: number }[],
        inactive: [] as { id: string; fullName: string; daysInactive: number }[],
      };

      // Check suspended accounts
      if (settings.autoDecommissionSuspendedDays > 0) {
        const suspendedAccounts = await prisma.adAccount.findMany({
          where: {
            accountHealth: "suspended",
            statusChangedAt: { not: null },
            handoffStatus: { not: "archived" },
            identityProfile: {
              archived: false,
              decommissionedAt: null,
            },
          },
          include: { identityProfile: true },
        });

        for (const account of suspendedAccounts) {
          if (account.statusChangedAt && account.identityProfile) {
            const daysSuspended = Math.floor(
              (now.getTime() - account.statusChangedAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSuspended >= settings.autoDecommissionSuspendedDays) {
              // Check if not already in candidates
              if (!candidates.suspended.some(c => c.id === account.identityProfile!.id)) {
                candidates.suspended.push({
                  id: account.identityProfile.id,
                  fullName: account.identityProfile.fullName,
                  daysSuspended,
                });
              }
            }
          }
        }
      }

      // Check in-appeal accounts
      if (settings.autoDecommissionInAppealDays > 0) {
        const appealAccounts = await prisma.adAccount.findMany({
          where: {
            accountHealth: "in-appeal",
            handoffStatus: { not: "archived" },
            identityProfile: {
              archived: false,
              decommissionedAt: null,
            },
          },
          include: {
            identityProfile: true,
            appealTracking: true,
          },
        });

        for (const account of appealAccounts) {
          if (account.appealTracking && account.identityProfile) {
            const daysInAppeal = Math.floor(
              (now.getTime() - account.appealTracking.appealStartDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysInAppeal >= settings.autoDecommissionInAppealDays) {
              if (!candidates.inAppeal.some(c => c.id === account.identityProfile!.id)) {
                candidates.inAppeal.push({
                  id: account.identityProfile.id,
                  fullName: account.identityProfile.fullName,
                  daysInAppeal,
                });
              }
            }
          }
        }
      }

      // Check inactive identities
      if (settings.autoDecommissionInactiveDays > 0) {
        const inactiveIdentities = await prisma.identityProfile.findMany({
          where: {
            inactive: true,
            archived: false,
            decommissionedAt: null,
          },
        });

        for (const identity of inactiveIdentities) {
          const daysInactive = Math.floor(
            (now.getTime() - identity.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysInactive >= settings.autoDecommissionInactiveDays) {
            candidates.inactive.push({
              id: identity.id,
              fullName: identity.fullName,
              daysInactive,
            });
          }
        }
      }

      return { success: true, data: candidates };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Schedule auto-decommissions for eligible candidates
   * Returns the number of jobs scheduled
   */
  async scheduleAutoDecommissions(): Promise<ServiceResult<number>> {
    const prisma = getPrisma();

    try {
      const settings = await prisma.appSettings.findFirst();
      if (!settings) {
        return { success: false, error: "No settings found" };
      }

      const candidatesResult = await this.getAutoDecommissionCandidates();
      if (!candidatesResult.success || !candidatesResult.data) {
        return { success: false, error: candidatesResult.error };
      }

      const { suspended, inAppeal, inactive } = candidatesResult.data;
      let scheduledCount = 0;

      const reminderDays = settings.decommissionReminderDays || 3;
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + reminderDays);

      // Schedule suspended
      for (const candidate of suspended) {
        const existingJob = await prisma.decommissionJob.findUnique({
          where: { identityProfileId: candidate.id },
        });
        if (!existingJob || existingJob.status === "cancelled" || existingJob.status === "failed") {
          await this.startDecommission(candidate.id, {
            triggerType: "suspended_timeout",
            jobType: "archive",
            scheduledFor,
          });
          scheduledCount++;
        }
      }

      // Schedule in-appeal
      for (const candidate of inAppeal) {
        const existingJob = await prisma.decommissionJob.findUnique({
          where: { identityProfileId: candidate.id },
        });
        if (!existingJob || existingJob.status === "cancelled" || existingJob.status === "failed") {
          await this.startDecommission(candidate.id, {
            triggerType: "appeal_timeout",
            jobType: "archive",
            scheduledFor,
          });
          scheduledCount++;
        }
      }

      // Schedule inactive
      for (const candidate of inactive) {
        const existingJob = await prisma.decommissionJob.findUnique({
          where: { identityProfileId: candidate.id },
        });
        if (!existingJob || existingJob.status === "cancelled" || existingJob.status === "failed") {
          await this.startDecommission(candidate.id, {
            triggerType: "inactive_timeout",
            jobType: "archive",
            scheduledFor,
          });
          scheduledCount++;
        }
      }

      console.log(`[Decommission] Scheduled ${scheduledCount} auto-decommission jobs`);

      return { success: true, data: scheduledCount };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Execute all scheduled jobs that are due
   */
  async executeScheduledJobs(): Promise<ServiceResult<number>> {
    const prisma = getPrisma();

    try {
      const now = new Date();
      const dueJobs = await prisma.decommissionJob.findMany({
        where: {
          status: "pending",
          scheduledFor: { lte: now },
        },
      });

      let executedCount = 0;
      for (const job of dueJobs) {
        const result = await this.executeDecommission(job.id);
        if (result.success) {
          executedCount++;
        }
      }

      console.log(`[Decommission] Executed ${executedCount} scheduled jobs`);

      return { success: true, data: executedCount };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  /**
   * Send notification when decommission is scheduled
   */
  async sendDecommissionScheduledNotification(job: DecommissionJobWithIdentity): Promise<void> {
    const prisma = getPrisma();
    const settings = await prisma.appSettings.findFirst();
    if (!settings) return;

    const identity = job.identityProfile;
    const daysUntil = job.scheduledFor
      ? Math.ceil((job.scheduledFor.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    const triggerReasons: Record<string, string> = {
      manual: "Manual trigger",
      banned: "Account banned",
      suspended_timeout: "Suspended too long",
      appeal_timeout: "Appeal timeout",
      inactive_timeout: "Inactive too long",
    };

    const resourceList = [];
    if (job.resourceStatus.droplet === "pending") resourceList.push("Droplet");
    if (job.resourceStatus.domain === "pending") resourceList.push("Domain");
    if (job.resourceStatus.gologin === "pending") resourceList.push("GoLogin");
    if (job.resourceStatus.account === "pending") resourceList.push("Account");

    const message = `Identity: ${identity.fullName}\nTrigger: ${triggerReasons[job.triggerType] || job.triggerType}\nScheduled: ${job.scheduledFor?.toLocaleDateString()}\nResources: ${resourceList.join(", ") || "None"}\n\nThis will auto-execute in ${daysUntil} days unless cancelled.`;

    // In-app notification
    if (settings.decommissionAlertViaApp) {
      await prisma.notification.create({
        data: {
          type: "DECOMMISSION_SCHEDULED",
          title: "Decommission Scheduled",
          message,
          entityId: identity.id,
          entityType: "identity",
          priority: "warning",
        },
      });
    }

    // Telegram
    if (settings.decommissionAlertViaTelegram && settings.telegramBotToken && settings.telegramChatId) {
      const telegramMessage = `🟡 *Decommission Scheduled*\n\n${escapeMarkdown(message)}`;
      await sendTelegramMessage(telegramMessage, settings.telegramChatId);
    }
  }

  /**
   * Send reminder notification before decommission executes
   */
  async sendDecommissionReminderNotification(job: DecommissionJobWithIdentity): Promise<void> {
    const prisma = getPrisma();
    const settings = await prisma.appSettings.findFirst();
    if (!settings) return;

    const identity = job.identityProfile;
    const daysUntil = job.scheduledFor
      ? Math.ceil((job.scheduledFor.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    const resourceDetails = [];
    if (job.resourceStatus.droplet === "pending" && identity.linkedWebsite?.dropletIp) {
      resourceDetails.push(`- Droplet: ${identity.linkedWebsite.dropletIp}`);
    }
    if (job.resourceStatus.domain === "pending" && identity.linkedWebsite?.domain) {
      resourceDetails.push(`- Domain: ${identity.linkedWebsite.domain}`);
    }
    if (job.resourceStatus.gologin === "pending") {
      resourceDetails.push(`- GoLogin Profile`);
    }
    if (job.resourceStatus.account === "pending") {
      resourceDetails.push(`- Ad Account(s): ${identity.adAccounts.length}`);
    }

    const message = `Identity: ${identity.fullName}\nExecuting in: ${daysUntil} days\n\nResources to cleanup:\n${resourceDetails.join("\n")}`;

    // In-app notification
    if (settings.decommissionAlertViaApp) {
      await prisma.notification.create({
        data: {
          type: "DECOMMISSION_REMINDER",
          title: "Decommission Reminder",
          message,
          entityId: identity.id,
          entityType: "identity",
          priority: "warning",
        },
      });
    }

    // Update job reminder sent
    await prisma.decommissionJob.update({
      where: { id: job.id },
      data: { reminderSentAt: new Date() },
    });

    // Telegram
    if (settings.decommissionAlertViaTelegram && settings.telegramBotToken && settings.telegramChatId) {
      const telegramMessage = `⚠️ *Decommission Reminder*\n\n${escapeMarkdown(message)}`;
      await sendTelegramMessage(telegramMessage, settings.telegramChatId);
    }
  }

  /**
   * Send notification when decommission completes successfully
   */
  async sendDecommissionCompletedNotification(job: DecommissionJobWithIdentity): Promise<void> {
    const prisma = getPrisma();
    const settings = await prisma.appSettings.findFirst();
    if (!settings) return;

    const identity = job.identityProfile;

    const resourceResults = [];
    if (job.resourceStatus.droplet === "completed") resourceResults.push("✓ Droplet deleted");
    if (job.resourceStatus.domain === "completed") resourceResults.push("✓ Domain auto-renewal disabled");
    if (job.resourceStatus.gologin === "completed") resourceResults.push("✓ GoLogin profile deleted");
    if (job.resourceStatus.account === "completed") resourceResults.push("✓ Ad account(s) archived");

    const message = `Identity: ${identity.fullName}\n\nResources cleaned:\n${resourceResults.join("\n")}\n\nIdentity has been archived.`;

    // In-app notification
    if (settings.decommissionAlertViaApp) {
      await prisma.notification.create({
        data: {
          type: "DECOMMISSION_COMPLETED",
          title: "Decommission Complete",
          message,
          entityId: identity.id,
          entityType: "identity",
          priority: "info",
        },
      });
    }

    // Telegram
    if (settings.decommissionAlertViaTelegram && settings.telegramBotToken && settings.telegramChatId) {
      const telegramMessage = `✅ *Decommission Complete*\n\n${escapeMarkdown(message)}`;
      await sendTelegramMessage(telegramMessage, settings.telegramChatId);
    }
  }

  /**
   * Send notification when decommission fails
   */
  async sendDecommissionFailedNotification(job: DecommissionJobWithIdentity, errors: string[]): Promise<void> {
    const prisma = getPrisma();
    const settings = await prisma.appSettings.findFirst();
    if (!settings) return;

    const identity = job.identityProfile;

    const message = `Identity: ${identity.fullName}\n\nErrors:\n${errors.map(e => `- ${e}`).join("\n")}\n\nManual intervention required.`;

    // In-app notification
    if (settings.decommissionAlertViaApp) {
      await prisma.notification.create({
        data: {
          type: "DECOMMISSION_FAILED",
          title: "Decommission Failed",
          message,
          entityId: identity.id,
          entityType: "identity",
          priority: "high",
        },
      });
    }

    // Telegram
    if (settings.decommissionAlertViaTelegram && settings.telegramBotToken && settings.telegramChatId) {
      const telegramMessage = `🔴 *Decommission Failed*\n\n${escapeMarkdown(message)}`;
      await sendTelegramMessage(telegramMessage, settings.telegramChatId);
    }
  }

  /**
   * Send daily digest of decommission status
   */
  async sendDailyDigest(): Promise<void> {
    const prisma = getPrisma();
    const settings = await prisma.appSettings.findFirst();
    if (!settings?.decommissionDigestEnabled) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Get stats
    const completedYesterday = await prisma.decommissionJob.count({
      where: {
        status: "completed",
        completedAt: { gte: yesterday, lt: today },
      },
    });

    const pending = await prisma.decommissionJob.count({
      where: { status: "pending" },
    });

    const executingToday = await prisma.decommissionJob.count({
      where: {
        status: "pending",
        scheduledFor: { lte: today },
      },
    });

    const scheduledThisWeek = await prisma.decommissionJob.count({
      where: {
        status: "pending",
        scheduledFor: { gte: today, lte: nextWeek },
      },
    });

    const failed = await prisma.decommissionJob.findMany({
      where: { status: "failed" },
      include: { identityProfile: true },
      take: 5,
    });

    if (completedYesterday === 0 && pending === 0 && failed.length === 0) {
      // No activity to report
      return;
    }

    const failedList = failed.map(f => `- ${f.identityProfile.fullName}: ${f.errorMessage?.split("\n")[0] || "Unknown error"}`).join("\n");

    const message = `Completed yesterday: ${completedYesterday}\n\nPending: ${pending}\n- Executing today: ${executingToday}\n- Scheduled this week: ${scheduledThisWeek}\n\nFailed (needs attention): ${failed.length}${failed.length > 0 ? `\n${failedList}` : ""}`;

    // In-app notification
    if (settings.decommissionAlertViaApp) {
      await prisma.notification.create({
        data: {
          type: "SYSTEM_ALERT",
          title: "Daily Decommission Report",
          message,
          priority: failed.length > 0 ? "warning" : "info",
        },
      });
    }

    // Telegram
    if (settings.decommissionAlertViaTelegram && settings.telegramBotToken && settings.telegramChatId) {
      const telegramMessage = `📊 *Daily Decommission Report*\n\n${escapeMarkdown(message)}`;
      await sendTelegramMessage(telegramMessage, settings.telegramChatId);
    }
  }

  // ============================================================================
  // LEGACY COMPATIBILITY - Migrated from decommission-alert.service.ts
  // ============================================================================

  /**
   * Check if an identity has any remaining active accounts
   * Active = not archived AND not suspended/banned
   */
  async checkIdentityHasActiveAccounts(identityId: string): Promise<boolean> {
    const prisma = getPrisma();
    const activeAccounts = await prisma.adAccount.count({
      where: {
        identityProfileId: identityId,
        handoffStatus: { not: "archived" },
        accountHealth: { notIn: ["suspended", "banned"] },
      },
    });
    return activeAccounts > 0;
  }

  /**
   * Called after an account is archived, deleted, or marked as suspended/banned
   * Checks if this triggers a decommission alert for the linked identity
   * Creates a decommission job if account is banned (not just suspended)
   */
  async checkAndFireDecommissionAlert(
    accountId: string,
    identityId: string | null,
    newHealth?: string
  ): Promise<void> {
    if (!identityId) {
      console.log("[Decommission] No identity linked to account, skipping check");
      return;
    }

    const prisma = getPrisma();

    // If account is banned, immediately create a decommission job
    if (newHealth === "banned") {
      console.log(`[Decommission] Account banned, creating decommission job for identity ${identityId}`);
      await this.startDecommission(identityId, {
        triggerType: "banned",
        jobType: "archive",
      });
      return;
    }

    // Check if identity still has active accounts
    const hasActiveAccounts = await this.checkIdentityHasActiveAccounts(identityId);

    if (!hasActiveAccounts) {
      // Fetch identity details for the alert
      const identity = await prisma.identityProfile.findUnique({
        where: { id: identityId },
        select: { id: true, fullName: true, website: true },
      });

      if (identity) {
        console.log(`[Decommission] No active accounts remaining for ${identity.fullName}, creating job`);
        await this.startDecommission(identityId, {
          triggerType: "banned", // Treat as banned for immediate attention
          jobType: "archive",
        });
      }
    } else {
      console.log(`[Decommission] Identity ${identityId} still has active accounts, no alert needed`);
    }
  }

  /**
   * Called when an identity is archived directly
   * Creates a decommission job for the identity
   */
  async fireDecommissionAlertForArchivedIdentity(identityId: string): Promise<void> {
    const prisma = getPrisma();

    const identity = await prisma.identityProfile.findUnique({
      where: { id: identityId },
      select: { id: true, fullName: true, website: true },
    });

    if (identity) {
      console.log(`[Decommission] Identity ${identity.fullName} archived, creating decommission job`);
      await this.startDecommission(identityId, {
        triggerType: "manual",
        jobType: "archive",
      });
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape special characters for Telegram MarkdownV2
 */
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

export const decommissionService = new DecommissionService();
