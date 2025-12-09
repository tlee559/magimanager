// ============================================================================
// IDENTITY PROGRESS ALERT SERVICE
// Sends alerts when items are added to identity profiles (docs, website, gologin, accounts)
// ============================================================================

import { getPrisma } from "../repositories/base.repository";
import { sendMessage as sendTelegramMessage } from "../integrations/telegram-bot";

export type IdentityProgressType =
  | "document_added"
  | "website_added"
  | "website_completed"
  | "gologin_created"
  | "account_linked";

export interface IdentityProgressData {
  identityId: string;
  identityName: string;
  progressType: IdentityProgressType;
  details?: string; // e.g., document type, account CID
}

/**
 * Fire an identity progress alert
 * Called when a document, website, gologin profile, or ad account is added to an identity
 */
export async function fireIdentityProgressAlert(data: IdentityProgressData): Promise<void> {
  const prisma = getPrisma();

  // Load settings to check which alerts are enabled
  const settings = await prisma.appSettings.findFirst();
  if (!settings) {
    console.log("[IdentityProgress] No settings found, skipping alert");
    return;
  }

  // Check if alerts are enabled
  if (!settings.identityProgressAlertEnabled) {
    console.log("[IdentityProgress] Alerts disabled, skipping");
    return;
  }

  // Check if this specific trigger is enabled
  const triggerEnabled = checkTriggerEnabled(settings, data.progressType);
  if (!triggerEnabled) {
    console.log(`[IdentityProgress] ${data.progressType} alerts disabled, skipping`);
    return;
  }

  const { title, message, emoji } = formatProgressMessage(data);

  // In-app notification
  if (settings.identityProgressAlertViaApp) {
    try {
      await prisma.notification.create({
        data: {
          type: "IDENTITY_PROGRESS",
          title: `${emoji} ${title}`,
          message,
          entityId: data.identityId,
          entityType: "identity",
          priority: "low",
        },
      });
      console.log(`[IdentityProgress] In-app notification created for ${data.identityName}`);
    } catch (error) {
      console.error("[IdentityProgress] Failed to create in-app notification:", error);
    }
  }

  // Telegram notification
  if (settings.identityProgressAlertViaTelegram) {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      console.log("[IdentityProgress] Telegram enabled but not configured in Settings - skipping");
    } else {
      try {
        const telegramMessage =
          `${emoji} *${escapeMarkdown(title)}*\n\n` +
          `*${escapeMarkdown(data.identityName)}*\n` +
          `${escapeMarkdown(message)}`;

        await sendTelegramMessage(telegramMessage, settings.telegramChatId);
        console.log(`[IdentityProgress] Telegram notification sent for ${data.identityName}`);
      } catch (error) {
        console.error("[IdentityProgress] Failed to send Telegram alert:", error);
      }
    }
  }
}

/**
 * Check if a specific trigger type is enabled in settings
 */
function checkTriggerEnabled(settings: {
  identityProgressAlertOnDocAdded?: boolean;
  identityProgressAlertOnWebsiteAdded?: boolean;
  identityProgressAlertOnWebsiteCompleted?: boolean;
  identityProgressAlertOnGologinCreated?: boolean;
  identityProgressAlertOnAccountLinked?: boolean;
}, progressType: IdentityProgressType): boolean {
  switch (progressType) {
    case "document_added":
      return settings.identityProgressAlertOnDocAdded ?? true;
    case "website_added":
      return settings.identityProgressAlertOnWebsiteAdded ?? true;
    case "website_completed":
      return settings.identityProgressAlertOnWebsiteCompleted ?? true;
    case "gologin_created":
      return settings.identityProgressAlertOnGologinCreated ?? true;
    case "account_linked":
      return settings.identityProgressAlertOnAccountLinked ?? true;
    default:
      return true;
  }
}

/**
 * Format the progress message based on type
 */
function formatProgressMessage(data: IdentityProgressData): {
  title: string;
  message: string;
  emoji: string;
} {
  switch (data.progressType) {
    case "document_added":
      return {
        title: "Document Added",
        message: data.details
          ? `Document "${data.details}" uploaded`
          : "New document uploaded",
        emoji: "📄",
      };
    case "website_added":
      return {
        title: "Website Added",
        message: data.details
          ? `Website set to: ${formatTelegramUrl(data.details)}`
          : "Website URL added",
        emoji: "🌐",
      };
    case "website_completed":
      return {
        title: "Website Completed",
        message: data.details
          ? `${formatTelegramUrl(data.details)} marked as completed`
          : "Website marked as completed and ready",
        emoji: "✅",
      };
    case "gologin_created":
      return {
        title: "GoLogin Profile Created",
        message: data.details
          ? `GoLogin profile "${data.details}" created`
          : "Browser profile ready",
        emoji: "🖥️",
      };
    case "account_linked":
      return {
        title: "Ad Account Linked",
        message: data.details
          ? `Account ${data.details} linked`
          : "Ad account linked to identity",
        emoji: "🔗",
      };
    default:
      return {
        title: "Identity Updated",
        message: "Identity profile was updated",
        emoji: "✅",
      };
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
  // Remove trailing slashes for cleaner display
  const displayUrl = url.replace(/\/+$/, "").replace(/^https?:\/\//, "");
  return `[${displayUrl}](${url})`;
}
