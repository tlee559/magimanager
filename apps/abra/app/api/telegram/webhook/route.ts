import { NextRequest, NextResponse } from "next/server";
import {
  sendMessage,
  sendTypingAction,
  parseCommand,
  isAuthorizedChat,
  isBotMentioned,
  type TelegramUpdate,
} from "@magimanager/core";
import {
  runAgent,
  generateQuickReport,
  generateQuickAlerts,
  generateQuickSummary,
} from "@/lib/gemini-agent-v2";
import { prisma } from "@/lib/db";

const BOT_USERNAME = "mm_boibot";

// Contextual acknowledgment messages - feel natural and varied
const THINKING_MESSAGES = [
  "🤔 Let me check that...",
  "📊 Pulling up the data...",
  "🔍 Looking into it...",
  "⏳ One sec...",
  "🧠 Thinking...",
];

const REPORT_ACKS = {
  report: "📊 Generating your report...",
  alerts: "🔍 Checking for issues...",
  summary: "📈 Getting the overview...",
};

// Get a random thinking message for variety
function getThinkingMessage(): string {
  return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
}

// Detect query complexity to decide acknowledgment style
function getQueryType(text: string): "simple" | "data" | "report" {
  const lowerText = text.toLowerCase();

  // Report-style queries need full acknowledgment
  if (/\b(full|complete|detailed|report|breakdown|overview|all accounts|everything)\b/.test(lowerText)) {
    return "report";
  }

  // Data queries that fetch from DB
  if (/\b(show|list|get|find|how many|what|which|who|status|spend|team|accounts?|alerts?)\b/.test(lowerText)) {
    return "data";
  }

  // Simple conversational queries
  return "simple";
}

// Deduplication: track recently processed message IDs to prevent double-processing
const processedMessages = new Set<number>();
const MESSAGE_DEDUP_TTL = 60000; // 1 minute

function markProcessed(messageId: number): boolean {
  if (processedMessages.has(messageId)) {
    return false; // Already processed
  }
  processedMessages.add(messageId);
  // Auto-cleanup after TTL
  setTimeout(() => processedMessages.delete(messageId), MESSAGE_DEDUP_TTL);
  // Prevent memory leak - keep max 100 entries
  if (processedMessages.size > 100) {
    const oldest = processedMessages.values().next().value;
    if (oldest) processedMessages.delete(oldest);
  }
  return true;
}

// POST /api/telegram/webhook - Handle incoming Telegram messages
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const update: TelegramUpdate = await request.json();

    if (!update.message) {
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const messageId = message.message_id;
    const chatId = message.chat.id;
    const text = message.text || "";
    const userId = message.from?.id?.toString();
    const userName = message.from?.first_name || "there";

    // Deduplicate - Telegram may retry if we're slow
    if (!markProcessed(messageId)) {
      console.log(`[Webhook] Duplicate message ${messageId}, skipping`);
      return NextResponse.json({ ok: true });
    }

    // Check authorization
    if (!isAuthorizedChat(chatId)) {
      console.log(`Unauthorized chat attempt from: ${chatId}`);
      return NextResponse.json({ ok: true });
    }

    // In groups, only respond to commands or mentions
    const isGroupChat = message.chat.type === "group" || message.chat.type === "supergroup";
    const isCommand = text.startsWith("/");
    const isMentioned = isBotMentioned(message, BOT_USERNAME);

    if (isGroupChat && !isCommand && !isMentioned) {
      return NextResponse.json({ ok: true });
    }

    // Parse command if present
    const { command, args } = parseCommand(text);

    // Process the message (this may take time, but we have 60s on Pro)
    if (command) {
      await handleCommand(command, args, chatId.toString(), userName);
    } else {
      const cleanText = text.replace(/@\w+/g, "").trim();
      await handleNaturalLanguage(cleanText || text, chatId.toString(), userId, userName);
    }

    console.log(`[Webhook] Completed in ${Date.now() - startTime}ms`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`[Webhook] Error after ${Date.now() - startTime}ms:`, error);
    return NextResponse.json({ ok: true });
  }
}

// Handle slash commands with proper UX
async function handleCommand(command: string, args: string, chatId: string, userName: string) {
  // Always show typing first - instant feedback
  await sendTypingAction(chatId);

  switch (command) {
    case "report":
      await sendMessage(REPORT_ACKS.report, chatId);
      await sendTypingAction(chatId);
      try {
        const report = await generateQuickReport();
        await sendMessage(report, chatId);
      } catch (error) {
        console.error("Report error:", error);
        await sendMessage(
          "😕 Having trouble generating the report right now. The database might be slow.\n\nTry `/summary` for a quicker overview, or try again in a moment.",
          chatId
        );
      }
      break;

    case "alerts":
      await sendMessage(REPORT_ACKS.alerts, chatId);
      await sendTypingAction(chatId);
      try {
        const alerts = await generateQuickAlerts();
        await sendMessage(alerts, chatId);
      } catch (error) {
        console.error("Alerts error:", error);
        await sendMessage("😕 Couldn't fetch alerts right now. Try again in a moment.", chatId);
      }
      break;

    case "summary":
      await sendMessage(REPORT_ACKS.summary, chatId);
      await sendTypingAction(chatId);
      try {
        const summary = await generateQuickSummary();
        await sendMessage(summary, chatId);
      } catch (error) {
        console.error("Summary error:", error);
        await sendMessage("😕 Couldn't generate summary. Try again in a moment.", chatId);
      }
      break;

    case "help":
    case "start":
      await sendMessage(getHelpMessage(userName), chatId);
      break;

    case "clear":
      try {
        await prisma.botConversation.deleteMany({ where: { chatId } });
        await sendMessage("🧹 Memory cleared! Let's start fresh.", chatId);
      } catch {
        await sendMessage("🧹 Fresh start!", chatId);
      }
      break;

    case "status":
      // Quick status check - useful for debugging
      try {
        const count = await prisma.adAccount.count();
        await sendMessage(`✅ Bot online\n📊 ${count} accounts in database`, chatId);
      } catch {
        await sendMessage("✅ Bot online\n⚠️ Database connection slow", chatId);
      }
      break;

    default:
      await sendMessage(
        `Hmm, I don't know /${command} 🤔\n\nTry /help to see what I can do!`,
        chatId
      );
  }
}

// Global timeout wrapper for agent calls - must complete before Vercel kills the function
async function withGlobalTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("GLOBAL_TIMEOUT")), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// Fast responses for common simple queries - no AI needed
function getFastResponse(text: string, userName: string): string | null {
  const lower = text.toLowerCase();

  // Help/commands queries
  if (/\b(help|commands?|what can you do|how do i use|features?)\b/.test(lower)) {
    return `Hey ${userName}! Here's what I can do:

*Commands:*
• /report - Full daily breakdown
• /alerts - Issues needing attention
• /summary - Quick stats
• /status - Check bot health
• /clear - Reset conversation

*Or just ask me:*
• "How many accounts are active?"
• "Show suspended accounts"
• "Who are top spenders?"
• "Any billing issues?"

I'm powered by AI and remember our conversation! 🤖`;
  }

  // Greetings
  if (/^(hi|hello|hey|yo|sup|what'?s up|howdy)[\s!?.]*$/i.test(lower)) {
    return `Hey ${userName}! 👋 How can I help you today? Try /help to see what I can do!`;
  }

  // Thanks
  if (/^(thanks?|thank you|thx|ty|appreciate it)[\s!?.]*$/i.test(lower)) {
    return `You're welcome! Let me know if you need anything else 👍`;
  }

  return null;
}

// Handle natural language with smart acknowledgment
async function handleNaturalLanguage(text: string, chatId: string, userId?: string, userName?: string) {
  // Always show typing immediately
  await sendTypingAction(chatId);

  // Check for fast responses first - no AI needed
  const fastResponse = getFastResponse(text, userName || "there");
  if (fastResponse) {
    await sendMessage(fastResponse, chatId);
    return;
  }

  const queryType = getQueryType(text);

  // For data/report queries, send an acknowledgment so user knows we're working
  if (queryType === "report") {
    await sendMessage(getThinkingMessage(), chatId);
    await sendTypingAction(chatId);
  }
  // For simple/data queries, just typing indicator is enough

  try {
    // 30s timeout - should be plenty for most queries
    const result = await withGlobalTimeout(runAgent(text, chatId, userId), 30000);

    if (result.toolsUsed.length > 0) {
      console.log(`[Bot] Tools used: ${result.toolsUsed.join(", ")}`);
    }

    await sendMessage(result.response, chatId);
  } catch (error) {
    console.error("Agent error:", error);

    // Check if it was a timeout
    const isTimeout = error instanceof Error && error.message === "GLOBAL_TIMEOUT";

    if (isTimeout) {
      await sendMessage(
        `That's taking longer than expected 😅 Try /report for a quick summary instead!`,
        chatId
      );
    } else {
      // Graceful fallback with helpful message
      await sendMessage(
        `Sorry ${userName || "there"}, I hit a snag processing that! 😅\n\n` +
        `Try one of these instead:\n` +
        `• /report - Full account report\n` +
        `• /alerts - Issues needing attention\n` +
        `• /summary - Quick stats`,
        chatId
      );
    }
  }
}

// Help message - personalized and clear
function getHelpMessage(userName: string): string {
  return `Hey ${userName}! 👋 I'm your MagiManager assistant.

*Quick Commands:*
• /report - Full daily breakdown
• /alerts - What needs attention
• /summary - Quick stats
• /status - Check bot health
• /clear - Reset our conversation

*Just Ask Me Anything:*
I understand natural language and remember our conversation!

📊 *"How many accounts are active?"*
🔍 *"Show suspended accounts"*
💰 *"Who are the top spenders?"*
👥 *"What's assigned to Derek?"*
🚨 *"Any billing issues?"*

Pro tip: Be specific and I'll give you exactly what you need! 🎯`;
}

// Verify webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    bot: BOT_USERNAME,
    timestamp: new Date().toISOString()
  });
}
