// ============================================================================
// IDENTITY ARCHIVED ALERT SERVICE
// Sends alerts when identity profiles are archived
// ============================================================================

import { getPrisma } from "../repositories/base.repository";
import { sendMessage as sendTelegramMessage } from "../integrations/telegram-bot";

export interface IdentityArchivedData {
  identityId: string;
  identityName: string;
  website?: string | null;
}

/**
 * Fire an alert when an identity is archived
 */
export async function fireIdentityArchivedAlert(data: IdentityArchivedData): Promise<void> {
  const prisma = getPrisma();

  // Load settings to check which alerts are enabled
  const settings = await prisma.appSettings.findFirst();
  if (!settings) {
    console.log("[IdentityArchived] No settings found, skipping alert");
    return;
  }

  // Check if alerts are enabled
  if (!settings.identityArchivedAlertEnabled) {
    console.log("[IdentityArchived] Alerts disabled, skipping");
    return;
  }

  const websiteInfo = data.website ? `Website: ${data.website}` : "No website";

  // In-app notification
  if (settings.identityArchivedAlertViaApp) {
    try {
      await prisma.notification.create({
        data: {
          type: "IDENTITY_ARCHIVED",
          title: "📦 Identity Archived",
          message: `${data.identityName} has been archived. ${websiteInfo}`,
          entityId: data.identityId,
          entityType: "identity",
          priority: "medium",
        },
      });
      console.log(`[IdentityArchived] In-app notification created for ${data.identityName}`);
    } catch (error) {
      console.error("[IdentityArchived] Failed to create in-app notification:", error);
    }
  }

  // Telegram notification
  if (settings.identityArchivedAlertViaTelegram) {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      console.log("[IdentityArchived] Telegram enabled but not configured in Settings - skipping");
    } else {
      try {
        const websiteLine = data.website
          ? `Website: ${formatTelegramUrl(data.website)}`
          : "_No website_";

        const telegramMessage =
          `📦 *Identity Archived*\n\n` +
          `*${escapeMarkdown(data.identityName)}*\n` +
          `${websiteLine}`;

        await sendTelegramMessage(telegramMessage, settings.telegramChatId);
        console.log(`[IdentityArchived] Telegram notification sent for ${data.identityName}`);
      } catch (error) {
        console.error("[IdentityArchived] Failed to send Telegram alert:", error);
      }
    }
  }
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

/**
 * Format a URL as a clickable Telegram link
 */
function formatTelegramUrl(url: string): string {
  const displayUrl = url.replace(/\/+$/, "").replace(/^https?:\/\//, "");
  return `[${displayUrl}](${url})`;
}
