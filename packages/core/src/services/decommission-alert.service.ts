// ============================================================================
// DECOMMISSION ALERT SERVICE
// Sends alerts when identities lose all active accounts or are archived
// ============================================================================

import { getPrisma } from "../repositories/base.repository";
import { sendMessage as sendTelegramMessage } from "../integrations/telegram-bot";

export interface DecommissionAlertData {
  identityId: string;
  identityName: string;
  website: string | null;
  reason: "last_account_gone" | "identity_archived";
  triggeringAccountId?: string;
}

/**
 * Check if an identity has any remaining active accounts
 * Active = not archived AND not suspended/banned
 */
async function checkIdentityHasActiveAccounts(identityId: string): Promise<boolean> {
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
 * Fire a decommission alert for an identity
 * Sends to in-app notifications and/or Telegram based on settings
 */
async function fireDecommissionAlert(data: DecommissionAlertData): Promise<void> {
  const prisma = getPrisma();

  // Load settings to check which alerts are enabled
  const settings = await prisma.appSettings.findFirst();
  if (!settings) {
    console.log("[Decommission] No settings found, skipping alert");
    return;
  }

  // Check if this trigger type is enabled
  if (data.reason === "last_account_gone" && !settings.decommissionAlertOnAccountDeath) {
    console.log("[Decommission] Account death alerts disabled, skipping");
    return;
  }
  if (data.reason === "identity_archived" && !settings.decommissionAlertOnIdentityArchive) {
    console.log("[Decommission] Identity archive alerts disabled, skipping");
    return;
  }

  const websiteInfo = data.website ? `Website: ${data.website}` : "No website on file";

  const reasonText =
    data.reason === "identity_archived"
      ? "Identity was archived directly"
      : "Last active account was decommissioned";

  // Build custom message section if provided
  const customMessageSection = settings.decommissionAlertCustomMessage
    ? `\n\n${settings.decommissionAlertCustomMessage}`
    : "";

  // In-app notification
  if (settings.decommissionAlertViaApp) {
    try {
      await prisma.notification.create({
        data: {
          type: "IDENTITY_DECOMMISSIONED",
          title: "🔴 Identity Decommissioned",
          message: `${data.identityName} no longer has any active accounts.\n\n${websiteInfo}\n\nReason: ${reasonText}${customMessageSection}`,
          entityId: data.identityId,
          entityType: "identity",
          priority: "high",
        },
      });
      console.log(`[Decommission] In-app notification created for ${data.identityName}`);
    } catch (error) {
      console.error("[Decommission] Failed to create in-app notification:", error);
    }
  }

  // Telegram notification
  if (settings.decommissionAlertViaTelegram && settings.telegramBotToken && settings.telegramChatId) {
    try {
      const telegramCustomMessage = settings.decommissionAlertCustomMessage
        ? `\n\n${escapeMarkdown(settings.decommissionAlertCustomMessage)}`
        : "";

      const telegramMessage =
        `🔴 *Identity Decommissioned*\n\n` +
        `*${escapeMarkdown(data.identityName)}*\n` +
        `${escapeMarkdown(websiteInfo)}\n\n` +
        `_Reason: ${escapeMarkdown(reasonText)}_${telegramCustomMessage}`;

      await sendTelegramMessage(telegramMessage, settings.telegramChatId);
      console.log(`[Decommission] Telegram notification sent for ${data.identityName}`);
    } catch (error) {
      console.error("[Decommission] Failed to send Telegram alert:", error);
    }
  }
}

/**
 * Escape special characters for Telegram MarkdownV2
 * Preserves URLs by not escaping them
 */
function escapeMarkdown(text: string): string {
  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;

  // Split text by URLs, escape non-URL parts, keep URLs intact
  const parts = text.split(urlPattern);

  return parts.map(part => {
    if (urlPattern.test(part)) {
      // This is a URL - don't escape it
      return part;
    }
    // Escape special characters for non-URL text
    return part.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
  }).join("");
}

/**
 * Called after an account is archived, deleted, or marked as suspended/banned
 * Checks if this triggers a decommission alert for the linked identity
 */
export async function checkAndFireDecommissionAlert(
  accountId: string,
  identityId: string | null
): Promise<void> {
  if (!identityId) {
    console.log("[Decommission] No identity linked to account, skipping check");
    return;
  }

  const prisma = getPrisma();

  // Check if identity still has active accounts
  const hasActiveAccounts = await checkIdentityHasActiveAccounts(identityId);

  if (!hasActiveAccounts) {
    // Fetch identity details for the alert
    const identity = await prisma.identityProfile.findUnique({
      where: { id: identityId },
      select: { id: true, fullName: true, website: true },
    });

    if (identity) {
      console.log(`[Decommission] Firing alert for identity ${identity.fullName} - no active accounts remaining`);
      await fireDecommissionAlert({
        identityId: identity.id,
        identityName: identity.fullName,
        website: identity.website,
        reason: "last_account_gone",
        triggeringAccountId: accountId,
      });
    }
  } else {
    console.log(`[Decommission] Identity ${identityId} still has active accounts, no alert needed`);
  }
}

/**
 * Called when an identity is archived directly
 * Always fires the alert (settings permitting)
 */
export async function fireIdentityArchivedAlert(identityId: string): Promise<void> {
  const prisma = getPrisma();

  const identity = await prisma.identityProfile.findUnique({
    where: { id: identityId },
    select: { id: true, fullName: true, website: true },
  });

  if (identity) {
    console.log(`[Decommission] Firing alert for identity ${identity.fullName} - identity archived`);
    await fireDecommissionAlert({
      identityId: identity.id,
      identityName: identity.fullName,
      website: identity.website,
      reason: "identity_archived",
    });
  }
}
