// Telegram Bot Client for MagiManager
// Handles sending messages and formatting reports

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Types
export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    title?: string;
    type: string;
  };
  date: number;
  text?: string;
  entities?: Array<{
    offset: number;
    length: number;
    type: string;
  }>;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface AccountData {
  id: string;
  internalId: number;
  googleCid: string | null;
  origin: string;
  status: string;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  handoffStatus: string;
  currentSpendTotal: number;
  warmupTargetSpend: number;
  adsCount: number;
  campaignsCount: number;
  createdAt: string;
  updatedAt: string;
  handoffDate: string | null;
  identityProfile?: {
    fullName: string;
    geo: string;
  } | null;
  mediaBuyer?: {
    name: string;
  } | null;
}

export interface AlertData {
  id: string;
  googleCid: string | null;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  alertPriority: "critical" | "warning" | "info";
  alertReason: string;
  daysSinceCheckIn: number | null;
  identityProfile?: {
    fullName: string;
    geo: string;
  } | null;
}

export interface ActivityData {
  id: string;
  adAccountId: string;
  action: string;
  details: string | null;
  createdAt: string;
  accountName?: string; // For display purposes
  createdBy?: string | null; // User ID who made the change
  createdByName?: string | null; // User name for display
}

export interface CheckInData {
  id: string;
  adAccountId: string;
  dailySpend: number;
  totalSpend: number;
  adsCount: number;
  campaignsCount: number;
  accountHealth: string;
  billingStatus: string;
  certStatus: string | null;
  issues: string | null;
  notes: string | null;
  checkedAt: string;
  accountName?: string;
}

export interface MediaBuyerData {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  accountCount: number;
  totalSpend: number;
  createdAt: string;
}

export interface RequestData {
  id: string;
  requesterName: string;
  type: string;
  status: string;
  justification: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface IdentityData {
  id: string;
  fullName: string;
  geo: string;
  hasGoLoginProfile: boolean;
  goLoginStatus: string | null;
  accountCount: number;
  createdAt: string;
}

export interface DatabaseStats {
  totalAccounts: number;
  activeAccounts: number;
  suspendedAccounts: number;
  bannedAccounts: number;
  limitedAccounts: number;
  totalSpend: number;
  totalAds: number;
  accountsCreatedThisWeek: number;
  accountsCreatedThisMonth: number;
  identityCount: number;
  mediaBuyerCount: number;
  pendingRequests: number;
  checkInsToday: number;
  checkInsThisWeek: number;
}

// Send "typing..." indicator to show bot is thinking
export async function sendTypingAction(chatId: string = DEFAULT_CHAT_ID): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${BOT_TOKEN}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        action: "typing",
      }),
    });

    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error("Failed to send typing action:", error);
    return false;
  }
}

// Send a message to Telegram
export async function sendMessage(
  text: string,
  chatId: string = DEFAULT_CHAT_ID,
  options: {
    parseMode?: "Markdown" | "MarkdownV2" | "HTML";
    disableWebPagePreview?: boolean;
    replyToMessageId?: number;
  } = {}
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parseMode || "Markdown",
        disable_web_page_preview: options.disableWebPagePreview ?? true,
        reply_to_message_id: options.replyToMessageId,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error("Telegram API error:", data);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

// Format a daily account report
export function formatDailyReport(accounts: AccountData[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Calculate stats
  const total = accounts.length;
  const active = accounts.filter((a) => a.accountHealth === "active").length;
  const limited = accounts.filter((a) => a.accountHealth === "limited").length;
  const suspended = accounts.filter((a) => a.accountHealth === "suspended").length;
  const banned = accounts.filter((a) => a.accountHealth === "banned").length;
  const pendingBilling = accounts.filter((a) => a.billingStatus === "pending").length;
  const pendingCert = accounts.filter((a) => a.certStatus === "pending").length;
  const archived = accounts.filter((a) => a.handoffStatus === "archived").length;

  // Total spend (stored in cents)
  const totalSpend = accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0) / 100;
  const totalAds = accounts.reduce((sum, a) => sum + a.adsCount, 0);

  // Top performers (by spend, excluding archived)
  const topPerformers = accounts
    .filter((a) => a.handoffStatus !== "archived" && a.currentSpendTotal > 0)
    .sort((a, b) => b.currentSpendTotal - a.currentSpendTotal)
    .slice(0, 5);

  let report = `📊 *Daily Account Report*\n`;
  report += `_${dateStr}_\n\n`;

  report += `*Summary:*\n`;
  report += `• Total Accounts: ${total}\n`;
  report += `• Active: ${active} ✅\n`;
  if (limited > 0) report += `• Limited: ${limited} ⚠️\n`;
  if (suspended > 0) report += `• Suspended: ${suspended} 🔴\n`;
  if (banned > 0) report += `• Banned: ${banned} ⛔\n`;
  if (pendingBilling > 0) report += `• Pending Billing: ${pendingBilling} 💳\n`;
  if (pendingCert > 0) report += `• Pending Cert: ${pendingCert} 📋\n`;
  if (archived > 0) report += `• Archived: ${archived} 📦\n`;

  report += `\n*Metrics:*\n`;
  report += `• Total Spend: $${totalSpend.toFixed(2)}\n`;
  report += `• Total Ads: ${totalAds}\n`;

  if (topPerformers.length > 0) {
    report += `\n*Top Performers:*\n`;
    topPerformers.forEach((a) => {
      const name = a.identityProfile?.fullName || a.googleCid || "Unknown";
      const spend = (a.currentSpendTotal / 100).toFixed(0);
      report += `• ${name} - ${a.adsCount} ads, $${spend} spend\n`;
    });
  }

  return report;
}

// Format alerts report
export function formatAlertsReport(alerts: AlertData[]): string {
  if (alerts.length === 0) {
    return "✅ *No Alerts*\nAll accounts are in good standing!";
  }

  const critical = alerts.filter((a) => a.alertPriority === "critical");
  const warning = alerts.filter((a) => a.alertPriority === "warning");
  const info = alerts.filter((a) => a.alertPriority === "info");

  let report = `🚨 *Accounts Needing Attention*\n\n`;

  if (critical.length > 0) {
    report += `*Critical (${critical.length}):*\n`;
    critical.forEach((a) => {
      const name = a.identityProfile?.fullName || a.googleCid || "Unknown";
      report += `• 🔴 ${name} - ${a.alertReason}\n`;
    });
    report += "\n";
  }

  if (warning.length > 0) {
    report += `*Warning (${warning.length}):*\n`;
    warning.forEach((a) => {
      const name = a.identityProfile?.fullName || a.googleCid || "Unknown";
      report += `• ⚠️ ${name} - ${a.alertReason}\n`;
    });
    report += "\n";
  }

  if (info.length > 0) {
    report += `*Info (${info.length}):*\n`;
    info.forEach((a) => {
      const name = a.identityProfile?.fullName || a.googleCid || "Unknown";
      report += `• ℹ️ ${name} - ${a.alertReason}\n`;
    });
  }

  return report;
}

// Format a quick summary
export function formatSummary(accounts: AccountData[]): string {
  const total = accounts.length;
  const active = accounts.filter((a) => a.accountHealth === "active").length;
  const issues = accounts.filter(
    (a) => a.accountHealth === "suspended" || a.accountHealth === "banned" || a.billingStatus === "failed"
  ).length;
  const totalSpend = accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0) / 100;

  return (
    `📈 *Quick Summary*\n\n` +
    `Accounts: ${total} total, ${active} active\n` +
    `Issues: ${issues > 0 ? `${issues} need attention ⚠️` : "None ✅"}\n` +
    `Total Spend: $${totalSpend.toFixed(2)}`
  );
}

// Format help message
export function formatHelpMessage(): string {
  return (
    `🤖 *MagiManager Bot*\n\n` +
    `*Commands:*\n` +
    `/report - Full daily account report\n` +
    `/alerts - Accounts needing attention\n` +
    `/summary - Quick stats overview\n` +
    `/help - Show this help message\n\n` +
    `*Natural Language:*\n` +
    `You can also ask me questions like:\n` +
    `• "Show suspended accounts"\n` +
    `• "Which accounts are spending?"\n` +
    `• "Status of account X"\n`
  );
}

// Parse command from message
export function parseCommand(text: string): { command: string | null; args: string } {
  if (!text.startsWith("/")) {
    return { command: null, args: text };
  }

  const parts = text.split(" ");
  const commandPart = parts[0].split("@")[0]; // Remove @botname if present
  const command = commandPart.substring(1).toLowerCase();
  const args = parts.slice(1).join(" ");

  return { command, args };
}

// Check if message is from authorized chat
export function isAuthorizedChat(chatId: number): boolean {
  return chatId.toString() === DEFAULT_CHAT_ID;
}

// Check if message mentions the bot
export function isBotMentioned(message: TelegramMessage, botUsername: string): boolean {
  if (!message.text || !message.entities) return false;

  return message.entities.some(
    (entity) =>
      entity.type === "mention" &&
      message.text?.substring(entity.offset, entity.offset + entity.length).toLowerCase() === `@${botUsername.toLowerCase()}`
  );
}
