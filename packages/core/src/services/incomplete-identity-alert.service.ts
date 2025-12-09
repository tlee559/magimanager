// ============================================================================
// INCOMPLETE IDENTITY ALERT SERVICE
// Sends alerts when identity profiles are missing documents, website, or GoLogin profile
// ============================================================================

import { getPrisma } from "../repositories/base.repository";
import { sendMessage as sendTelegramMessage } from "../integrations/telegram-bot";

export interface IncompleteIdentityData {
  identityId: string;
  identityName: string;
  missingItems: string[];
  createdAt: Date;
}

export interface IncompleteIdentityCheckResult {
  isComplete: boolean;
  missingItems: string[];
}

/**
 * Check what items an identity is missing
 */
export async function checkIdentityCompleteness(identityId: string): Promise<IncompleteIdentityCheckResult> {
  const prisma = getPrisma();

  const identity = await prisma.identityProfile.findUnique({
    where: { id: identityId },
    include: {
      documents: true,
      gologinProfile: true,
    },
  });

  if (!identity) {
    return { isComplete: true, missingItems: [] };
  }

  const missingItems: string[] = [];

  // Check for documents
  if (!identity.documents || identity.documents.length === 0) {
    missingItems.push("Documents");
  }

  // Check for website
  if (!identity.website) {
    missingItems.push("Website");
  }

  // Check for GoLogin profile
  if (!identity.gologinProfile || identity.gologinProfile.status !== "ready") {
    missingItems.push("GoLogin Profile");
  }

  return {
    isComplete: missingItems.length === 0,
    missingItems,
  };
}

/**
 * Get all incomplete identities (non-archived)
 */
export async function getIncompleteIdentities(): Promise<IncompleteIdentityData[]> {
  const prisma = getPrisma();

  const identities = await prisma.identityProfile.findMany({
    where: {
      archived: false,
    },
    include: {
      documents: true,
      gologinProfile: true,
    },
  });

  const incomplete: IncompleteIdentityData[] = [];

  for (const identity of identities) {
    const missingItems: string[] = [];

    if (!identity.documents || identity.documents.length === 0) {
      missingItems.push("Documents");
    }

    if (!identity.website) {
      missingItems.push("Website");
    }

    if (!identity.gologinProfile || identity.gologinProfile.status !== "ready") {
      missingItems.push("GoLogin Profile");
    }

    if (missingItems.length > 0) {
      incomplete.push({
        identityId: identity.id,
        identityName: identity.fullName,
        missingItems,
        createdAt: identity.createdAt,
      });
    }
  }

  return incomplete;
}

/**
 * Fire an incomplete identity alert
 * Called when identity is created or during daily check
 */
export async function fireIncompleteIdentityAlert(
  data: IncompleteIdentityData,
  reason: "created" | "daily_reminder"
): Promise<void> {
  const prisma = getPrisma();

  // Load settings to check which alerts are enabled
  const settings = await prisma.appSettings.findFirst();
  if (!settings) {
    console.log("[IncompleteIdentity] No settings found, skipping alert");
    return;
  }

  // Check if alerts are enabled
  if (!settings.incompleteIdentityAlertEnabled) {
    console.log("[IncompleteIdentity] Alerts disabled, skipping");
    return;
  }

  // Check if this trigger type is enabled
  if (reason === "created" && !settings.incompleteIdentityAlertOnCreate) {
    console.log("[IncompleteIdentity] On-create alerts disabled, skipping");
    return;
  }
  if (reason === "daily_reminder" && !settings.incompleteIdentityAlertDaily) {
    console.log("[IncompleteIdentity] Daily alerts disabled, skipping");
    return;
  }

  const missingList = data.missingItems.join(", ");
  const reasonText = reason === "created"
    ? "New identity created with missing items"
    : "Daily reminder: Identity still incomplete";

  // In-app notification
  if (settings.incompleteIdentityAlertViaApp) {
    try {
      await prisma.notification.create({
        data: {
          type: "IDENTITY_INCOMPLETE",
          title: "⚠️ Incomplete Identity Profile",
          message: `${data.identityName} is missing: ${missingList}\n\n${reasonText}`,
          entityId: data.identityId,
          entityType: "identity",
          priority: "medium",
        },
      });
      console.log(`[IncompleteIdentity] In-app notification created for ${data.identityName}`);
    } catch (error) {
      console.error("[IncompleteIdentity] Failed to create in-app notification:", error);
    }
  }

  // Telegram notification
  if (settings.incompleteIdentityAlertViaTelegram) {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      console.log("[IncompleteIdentity] Telegram enabled but not configured in Settings - skipping");
    } else {
      try {
        const telegramMessage =
          `⚠️ *Incomplete Identity Profile*\n\n` +
          `*${escapeMarkdown(data.identityName)}*\n` +
          `Missing: ${escapeMarkdown(missingList)}\n\n` +
          `_${escapeMarkdown(reasonText)}_`;

        await sendTelegramMessage(telegramMessage, settings.telegramChatId);
        console.log(`[IncompleteIdentity] Telegram notification sent for ${data.identityName}`);
      } catch (error) {
        console.error("[IncompleteIdentity] Failed to send Telegram alert:", error);
      }
    }
  }
}

/**
 * Fire alerts for all incomplete identities (used by daily cron)
 */
export async function fireDailyIncompleteIdentityAlerts(): Promise<{
  alertCount: number;
  identities: string[];
}> {
  const prisma = getPrisma();

  // Load settings
  const settings = await prisma.appSettings.findFirst();
  if (!settings?.incompleteIdentityAlertEnabled || !settings?.incompleteIdentityAlertDaily) {
    console.log("[IncompleteIdentity] Daily alerts disabled, skipping");
    return { alertCount: 0, identities: [] };
  }

  const incompleteIdentities = await getIncompleteIdentities();

  if (incompleteIdentities.length === 0) {
    console.log("[IncompleteIdentity] No incomplete identities found");
    return { alertCount: 0, identities: [] };
  }

  // Send consolidated Telegram alert (single message with all incomplete identities)
  if (settings.incompleteIdentityAlertViaTelegram) {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      console.log("[IncompleteIdentity] Telegram enabled but not configured in Settings - skipping");
    } else {
      try {
        const identityList = incompleteIdentities
          .map((i) => `• *${escapeMarkdown(i.identityName)}*: ${escapeMarkdown(i.missingItems.join(", "))}`)
          .join("\n");

        const telegramMessage =
          `⚠️ *Daily Incomplete Identity Report*\n\n` +
          `${incompleteIdentities.length} identity profile${incompleteIdentities.length > 1 ? "s" : ""} need attention:\n\n` +
          `${identityList}`;

        await sendTelegramMessage(telegramMessage, settings.telegramChatId);
        console.log(`[IncompleteIdentity] Telegram daily report sent for ${incompleteIdentities.length} identities`);
      } catch (error) {
        console.error("[IncompleteIdentity] Failed to send Telegram daily report:", error);
      }
    }
  }

  // Create consolidated in-app notification
  if (settings.incompleteIdentityAlertViaApp) {
    try {
      const identityList = incompleteIdentities
        .map((i) => `• ${i.identityName}: ${i.missingItems.join(", ")}`)
        .join("\n");

      await prisma.notification.create({
        data: {
          type: "IDENTITY_INCOMPLETE",
          title: "⚠️ Daily Incomplete Identity Report",
          message: `${incompleteIdentities.length} identity profile${incompleteIdentities.length > 1 ? "s" : ""} need attention:\n\n${identityList}`,
          entityType: "identity",
          priority: "medium",
        },
      });
      console.log(`[IncompleteIdentity] In-app daily report created`);
    } catch (error) {
      console.error("[IncompleteIdentity] Failed to create in-app daily notification:", error);
    }
  }

  return {
    alertCount: incompleteIdentities.length,
    identities: incompleteIdentities.map((i) => i.identityName),
  };
}

/**
 * Escape special characters for Telegram MarkdownV2
 * Preserves markdown links [text](url) and raw URLs
 */
function escapeMarkdown(text: string): string {
  // Match markdown links [text](url) or raw URLs
  const linkPattern = /(\[[^\]]+\]\([^)]+\))|(https?:\/\/[^\s]+)/g;

  // Split text by links, escape non-link parts, keep links intact
  const parts = text.split(linkPattern);

  return parts
    .filter(part => part !== undefined)
    .map(part => {
      // Check if this part is a markdown link or raw URL
      if (/^\[[^\]]+\]\([^)]+\)$/.test(part) || /^https?:\/\//.test(part)) {
        // This is a link - don't escape it
        return part;
      }
      // Escape special characters for non-link text
      return part.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
    })
    .join("");
}
