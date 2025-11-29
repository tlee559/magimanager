// ============================================================================
// NOTIFICATION SERVICE - Pipeline events and notification types
// ============================================================================

import { broadcastEvent, CHANNELS } from "./index";

// ============================================================================
// PIPELINE STAGE DEFINITIONS
// ============================================================================

/**
 * Pipeline stages for account lifecycle
 * These represent the key milestones in account creation and management
 */
export type PipelineStage =
  | "identity_created"       // Identity profile created
  | "gologin_created"        // GoLogin browser profile created
  | "account_created"        // Ad account record created
  | "google_connected"       // Google OAuth completed
  | "cid_linked"             // CID linked to account
  | "billing_setup"          // Billing information added
  | "warmup_started"         // Account started warming up
  | "warmup_milestone"       // Hit a warmup milestone (25%, 50%, 75%)
  | "warmup_complete"        // Warmup target reached
  | "ready_for_handoff"      // Account ready to hand off
  | "handed_off"             // Account handed off to media buyer
  | "active";                // Account actively running ads

/**
 * Pipeline blocker types - things that stop progress
 */
export type PipelineBlocker =
  | "account_suspended"      // Google suspended the account
  | "account_banned"         // Google banned the account
  | "billing_failed"         // Billing verification failed
  | "cert_error"             // Advertiser certification error
  | "cert_suspended"         // Certification suspended
  | "gologin_error"          // GoLogin profile creation failed
  | "oauth_failed"           // OAuth connection failed
  | "sync_error";            // Google Ads sync failed

/**
 * Pipeline enabler types - things that allow progress to continue
 */
export type PipelineEnabler =
  | "account_reactivated"    // Account unsuspended
  | "billing_verified"       // Billing now verified
  | "cert_approved"          // Certification approved
  | "oauth_connected"        // OAuth successfully connected
  | "sync_success";          // Sync completed successfully

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationPriority = "critical" | "high" | "medium" | "low";

export interface PipelineNotification {
  type: "pipeline_progress" | "pipeline_blocked" | "pipeline_enabled";
  stage?: PipelineStage;
  blocker?: PipelineBlocker;
  enabler?: PipelineEnabler;
  accountId: string;
  accountName: string;
  cid?: string;
  message: string;
  priority: NotificationPriority;
  timestamp: Date;
  actionRequired?: boolean;
  actionUrl?: string;
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

/**
 * Get priority for a pipeline blocker
 */
function getBlockerPriority(blocker: PipelineBlocker): NotificationPriority {
  const criticalBlockers: PipelineBlocker[] = [
    "account_suspended",
    "account_banned",
    "billing_failed",
  ];
  const highBlockers: PipelineBlocker[] = [
    "cert_error",
    "cert_suspended",
    "oauth_failed",
  ];

  if (criticalBlockers.includes(blocker)) return "critical";
  if (highBlockers.includes(blocker)) return "high";
  return "medium";
}

/**
 * Get human-readable message for a blocker
 */
function getBlockerMessage(blocker: PipelineBlocker, accountName: string): string {
  const messages: Record<PipelineBlocker, string> = {
    account_suspended: `${accountName} has been SUSPENDED by Google`,
    account_banned: `${accountName} has been BANNED by Google`,
    billing_failed: `Billing verification FAILED for ${accountName}`,
    cert_error: `Advertiser certification ERROR for ${accountName}`,
    cert_suspended: `Certification SUSPENDED for ${accountName}`,
    gologin_error: `GoLogin profile creation failed for ${accountName}`,
    oauth_failed: `OAuth connection failed for ${accountName}`,
    sync_error: `Google Ads sync failed for ${accountName}`,
  };
  return messages[blocker];
}

/**
 * Get human-readable message for an enabler
 */
function getEnablerMessage(enabler: PipelineEnabler, accountName: string): string {
  const messages: Record<PipelineEnabler, string> = {
    account_reactivated: `${accountName} has been REACTIVATED`,
    billing_verified: `Billing verified for ${accountName}`,
    cert_approved: `Certification approved for ${accountName}`,
    oauth_connected: `OAuth connected for ${accountName}`,
    sync_success: `Sync completed for ${accountName}`,
  };
  return messages[enabler];
}

/**
 * Get human-readable message for a stage
 */
function getStageMessage(stage: PipelineStage, accountName: string): string {
  const messages: Record<PipelineStage, string> = {
    identity_created: `Identity created for ${accountName}`,
    gologin_created: `GoLogin profile ready for ${accountName}`,
    account_created: `Account created: ${accountName}`,
    google_connected: `Google OAuth connected for ${accountName}`,
    cid_linked: `CID linked for ${accountName}`,
    billing_setup: `Billing setup for ${accountName}`,
    warmup_started: `Warmup started for ${accountName}`,
    warmup_milestone: `Warmup milestone reached for ${accountName}`,
    warmup_complete: `Warmup COMPLETE for ${accountName} - ready for handoff!`,
    ready_for_handoff: `${accountName} is READY for handoff`,
    handed_off: `${accountName} has been handed off`,
    active: `${accountName} is now ACTIVE`,
  };
  return messages[stage];
}

// ============================================================================
// BROADCAST FUNCTIONS
// ============================================================================

/**
 * Broadcast a pipeline blocker notification
 * Call this when something blocks account progress
 */
export async function notifyPipelineBlocked(
  blocker: PipelineBlocker,
  accountId: string,
  accountName: string,
  cid?: string
): Promise<void> {
  const priority = getBlockerPriority(blocker);
  const message = getBlockerMessage(blocker, accountName);

  const notification: PipelineNotification = {
    type: "pipeline_blocked",
    blocker,
    accountId,
    accountName,
    cid,
    message,
    priority,
    timestamp: new Date(),
    actionRequired: true,
  };

  // Broadcast to alerts channel
  await broadcastEvent(CHANNELS.ALERTS, `alert:${blocker.replace("_", "-")}` as any, notification);

  // Also broadcast as general notification
  await broadcastEvent(CHANNELS.ACCOUNTS, "account:updated" as any, {
    accountId,
    type: "blocker",
    blocker,
    message,
    priority,
  });

  console.log(`[Pipeline] BLOCKED: ${message}`);
}

/**
 * Broadcast a pipeline enabler notification
 * Call this when a blocker is resolved and progress can continue
 */
export async function notifyPipelineEnabled(
  enabler: PipelineEnabler,
  accountId: string,
  accountName: string,
  cid?: string
): Promise<void> {
  const message = getEnablerMessage(enabler, accountName);

  const notification: PipelineNotification = {
    type: "pipeline_enabled",
    enabler,
    accountId,
    accountName,
    cid,
    message,
    priority: "medium",
    timestamp: new Date(),
    actionRequired: false,
  };

  // Broadcast to accounts channel
  await broadcastEvent(CHANNELS.ACCOUNTS, "account:updated" as any, {
    accountId,
    type: "enabler",
    enabler,
    message,
    priority: "medium",
  });

  console.log(`[Pipeline] ENABLED: ${message}`);
}

/**
 * Broadcast a pipeline progress notification
 * Call this when an account moves to a new stage
 */
export async function notifyPipelineProgress(
  stage: PipelineStage,
  accountId: string,
  accountName: string,
  cid?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const message = getStageMessage(stage, accountName);

  // Determine priority based on stage
  let priority: NotificationPriority = "low";
  if (stage === "warmup_complete" || stage === "ready_for_handoff") {
    priority = "high";
  } else if (stage === "handed_off" || stage === "active") {
    priority = "medium";
  }

  const notification: PipelineNotification = {
    type: "pipeline_progress",
    stage,
    accountId,
    accountName,
    cid,
    message,
    priority,
    timestamp: new Date(),
    actionRequired: stage === "ready_for_handoff",
    ...metadata,
  };

  // Broadcast to accounts channel
  await broadcastEvent(CHANNELS.ACCOUNTS, "account:updated" as any, {
    accountId,
    type: "progress",
    stage,
    message,
    priority,
  });

  console.log(`[Pipeline] PROGRESS: ${message}`);
}

/**
 * Notify when an account is ready for handoff (high priority)
 */
export async function notifyReadyForHandoff(
  accountId: string,
  accountName: string,
  cid: string,
  spendTotal: number,
  warmupTarget: number
): Promise<void> {
  await notifyPipelineProgress("ready_for_handoff", accountId, accountName, cid, {
    spendTotal,
    warmupTarget,
    percentComplete: 100,
    actionUrl: `/admin?account=${accountId}`,
  });
}

/**
 * Notify warmup milestone (25%, 50%, 75%)
 */
export async function notifyWarmupMilestone(
  accountId: string,
  accountName: string,
  cid: string,
  percentComplete: number
): Promise<void> {
  const milestone = Math.floor(percentComplete / 25) * 25;
  await notifyPipelineProgress("warmup_milestone", accountId, accountName, cid, {
    milestone,
    percentComplete,
    message: `${accountName} has reached ${milestone}% of warmup target`,
  });
}
