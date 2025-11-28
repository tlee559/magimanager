// Gemini AI Agent for MagiManager Telegram Bot
// Handles natural language processing and intent detection

import {
  AccountData,
  AlertData,
  ActivityData,
  CheckInData,
  MediaBuyerData,
  RequestData,
  IdentityData,
  DatabaseStats,
} from "./telegram-bot";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Intent types the agent can detect
export type Intent =
  | "report" // User wants a full report
  | "alerts" // User wants to see alerts/issues
  | "summary" // User wants a quick summary
  | "account_status" // User asks about a specific account
  | "action_request" // User wants to perform an action (not yet implemented)
  | "question" // General question about the data
  | "help" // User needs help
  | "greeting" // User is greeting
  | "unknown"; // Cannot determine intent

export interface IntentResult {
  intent: Intent;
  confidence: number;
  accountIdentifier?: string; // For account-specific queries
  actionType?: string; // For action requests (pause, enable, etc.)
  originalQuery: string;
}

export interface AgentResponse {
  text: string;
  intent: Intent;
  shouldFetchData: boolean;
  dataType?: "accounts" | "alerts" | "specific_account";
  accountIdentifier?: string;
}

// System prompt that defines the agent's personality and capabilities
const SYSTEM_PROMPT = `You are MagiManager Bot (aka "MM Bot" or "Boi Bot"), a friendly and helpful AI assistant for an internal Google Ads account management team.

PERSONALITY:
- You're casual, friendly, and personable - like a helpful coworker, not a corporate robot
- Keep responses concise but warm
- Use occasional emojis when appropriate (but don't overdo it)
- If you don't know something, say so naturally - "Hmm, I'm not sure about that" or "Let me think..."
- Always try to be helpful even if you can't answer directly

WHAT YOU CAN DO:
1. Pull reports on ad account status (health, spend, ads, performance)
2. Show alerts for accounts needing attention (suspended, billing issues, cert problems)
3. Provide quick summaries of overall performance
4. Answer questions about account data, identities, media buyers, and operations
5. Help users understand their ad account pipeline and status
6. Track who's doing what - account assignments, check-ins, status changes

WHAT YOU CAN'T DO YET (be friendly about it):
- Pause or enable ads directly
- Create new accounts or identities
- Modify account settings
- Link/unlink accounts
- Make any changes to the database

EXAMPLE QUESTIONS YOU CAN ANSWER:
- "How many accounts got suspended this week?"
- "Which accounts are spending?"
- "Who's assigned to what?"
- "Show me accounts needing attention"
- "What's Derek's account status?"
- "How many identities do we have?"
- "What happened yesterday?"

When responding:
- Be conversational and natural
- Use markdown for formatting (bold, lists, etc)
- Include relevant numbers/metrics when you have them
- If asked about capabilities, explain what you can do in a friendly way
- Never leave users hanging - always respond with something helpful

Remember: You're part of the team, helping manage Google Ads accounts. Be helpful and human-like!`;

// Detect user intent from natural language
export async function detectIntent(message: string): Promise<IntentResult> {
  // First try rule-based detection for common patterns
  const lowerMessage = message.toLowerCase().trim();

  // Help/capability patterns - catch various ways users ask about what the bot can do
  const helpPatterns = [
    "help",
    "what can you do",
    "what do you do",
    "what are you",
    "who are you",
    "what questions",
    "what can i ask",
    "what else can",
    "what other",
    "your capabilities",
    "your features",
    "how do i use",
    "how does this work",
    "what kind of",
  ];
  if (helpPatterns.some((p) => lowerMessage.includes(p))) {
    return { intent: "help", confidence: 1.0, originalQuery: message };
  }

  // Greeting patterns - more flexible to handle variations
  if (/^(hi|hello|hey|yo|sup|what'?s up|good morning|good afternoon|good evening|gm|howdy)[\s!.,?]*$/i.test(lowerMessage)) {
    return { intent: "greeting", confidence: 1.0, originalQuery: message };
  }

  // Also catch greetings with trailing words like "hi there", "hello bot"
  if (/^(hi|hello|hey)\s+(there|bot|everyone|all|team)[\s!.,?]*$/i.test(lowerMessage)) {
    return { intent: "greeting", confidence: 1.0, originalQuery: message };
  }

  // Report patterns
  if (lowerMessage.includes("full report") || lowerMessage.includes("daily report") || lowerMessage === "report") {
    return { intent: "report", confidence: 0.95, originalQuery: message };
  }

  // Alert patterns
  if (
    lowerMessage.includes("alert") ||
    lowerMessage.includes("need attention") ||
    lowerMessage.includes("issues") ||
    lowerMessage.includes("problems")
  ) {
    return { intent: "alerts", confidence: 0.9, originalQuery: message };
  }

  // Summary patterns
  if (
    lowerMessage.includes("summary") ||
    lowerMessage.includes("quick overview") ||
    lowerMessage.includes("how are we doing")
  ) {
    return { intent: "summary", confidence: 0.9, originalQuery: message };
  }

  // Action request patterns (things we can't do yet)
  const actionPatterns = [
    /pause|stop|disable/i,
    /enable|start|activate/i,
    /create|add|new/i,
    /delete|remove/i,
    /update|change|modify|edit/i,
    /link|unlink|connect|disconnect/i,
  ];

  for (const pattern of actionPatterns) {
    if (pattern.test(lowerMessage)) {
      const actionMatch = lowerMessage.match(pattern);
      return {
        intent: "action_request",
        confidence: 0.85,
        actionType: actionMatch?.[0],
        originalQuery: message,
      };
    }
  }

  // Account-specific query patterns
  const accountPatterns = [
    /account\s+([a-z0-9-]+)/i,
    /status\s+(?:of\s+)?([a-z0-9-]+)/i,
    /how\s+is\s+([a-z0-9-]+)/i,
    /([a-z]{1,3}\d{1,3})\b/i, // Match patterns like A2, SA17, C1
  ];

  for (const pattern of accountPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      return {
        intent: "account_status",
        confidence: 0.8,
        accountIdentifier: match[1],
        originalQuery: message,
      };
    }
  }

  // If no clear pattern, use Gemini for intent classification
  if (GEMINI_API_KEY) {
    try {
      const classificationPrompt = `Classify this message into one of these intents: report, alerts, summary, account_status, action_request, question, help, greeting, unknown.

Message: "${message}"

Respond with ONLY a JSON object like: {"intent": "report", "confidence": 0.9}`;

      const response = await callGemini(classificationPrompt);
      const parsed = JSON.parse(response);
      return {
        intent: parsed.intent as Intent,
        confidence: parsed.confidence || 0.7,
        originalQuery: message,
      };
    } catch {
      // Fall back to question intent
      return { intent: "question", confidence: 0.5, originalQuery: message };
    }
  }

  return { intent: "question", confidence: 0.5, originalQuery: message };
}

// Call Gemini API
async function callGemini(prompt: string, context?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

  const fullPrompt = context ? `${SYSTEM_PROMPT}\n\nContext:\n${context}\n\nUser: ${prompt}` : prompt;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
}

// Full database context for comprehensive queries
export interface FullDatabaseContext {
  accounts?: AccountData[];
  alerts?: AlertData[];
  activities?: ActivityData[];
  checkIns?: CheckInData[];
  mediaBuyers?: MediaBuyerData[];
  requests?: RequestData[];
  identities?: IdentityData[];
  stats?: DatabaseStats;
}

// Process a query and generate a response
export async function processQuery(
  message: string,
  accounts?: AccountData[],
  alerts?: AlertData[],
  activities?: ActivityData[],
  fullContext?: FullDatabaseContext
): Promise<AgentResponse> {
  const intentResult = await detectIntent(message);

  switch (intentResult.intent) {
    case "help":
      return {
        text: generateHelpResponse(),
        intent: "help",
        shouldFetchData: false,
      };

    case "greeting":
      // Randomize greeting for a more human feel
      const greetings = [
        `Hey there! 👋 What can I help you with today?`,
        `Hey! 👋 Ready to help - what do you need?`,
        `Yo! What's up? Ask me anything about our accounts.`,
        `Hey! 🙂 Need a report, alerts, or have a question?`,
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      return {
        text: `${randomGreeting}

Quick commands: /report | /alerts | /summary
Or just ask me anything naturally!`,
        intent: "greeting",
        shouldFetchData: false,
      };

    case "report":
      return {
        text: "", // Will be filled by formatted report
        intent: "report",
        shouldFetchData: true,
        dataType: "accounts",
      };

    case "alerts":
      return {
        text: "", // Will be filled by formatted alerts
        intent: "alerts",
        shouldFetchData: true,
        dataType: "alerts",
      };

    case "summary":
      return {
        text: "", // Will be filled by formatted summary
        intent: "summary",
        shouldFetchData: true,
        dataType: "accounts",
      };

    case "account_status":
      return {
        text: "", // Will be filled after fetching specific account
        intent: "account_status",
        shouldFetchData: true,
        dataType: "specific_account",
        accountIdentifier: intentResult.accountIdentifier,
      };

    case "action_request":
      return {
        text: `Ah, I wish I could help with that! 😅 I can't ${intentResult.actionType || "make changes"} yet - still in read-only mode for now.

But I *can* tell you about account status, pull reports, show alerts, and answer questions about the data.

For actions like pausing ads or making changes, you'll need to hop into the MagiManager dashboard directly.

Anything else I can help you look up?`,
        intent: "action_request",
        shouldFetchData: false,
      };

    case "question":
    default:
      // Use Gemini to answer questions if we have data context
      if (accounts || alerts || activities || fullContext) {
        const context = buildContext(accounts, alerts, activities, fullContext);
        try {
          const response = await callGemini(message, context);
          return {
            text: response,
            intent: "question",
            shouldFetchData: false,
          };
        } catch (error) {
          console.error("Gemini query error:", error);
          return {
            text: "Hmm, my brain got a bit tangled on that one! 🤯 Could you try rephrasing? Or use /report, /alerts, or /summary for quick data.",
            intent: "unknown",
            shouldFetchData: false,
          };
        }
      }

      // If no data, let me fetch it and answer
      return {
        text: "Good question! Let me grab the latest data to answer that...",
        intent: "question",
        shouldFetchData: true,
        dataType: "accounts",
      };
  }
}

// Build context string from account data
function buildContext(
  accounts?: AccountData[],
  alerts?: AlertData[],
  activities?: ActivityData[],
  fullContext?: FullDatabaseContext
): string {
  let context = "";
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const todayTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Los_Angeles" });
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  context += `=== MAGIMANAGER DATABASE SNAPSHOT ===\n`;
  context += `Current Date/Time: ${todayStr} ${todayTime} PT\n\n`;

  if (accounts && accounts.length > 0) {
    context += `Current Date: ${todayStr}\n`;
    context += `Current Account Data (${accounts.length} accounts):\n`;

    const active = accounts.filter((a) => a.accountHealth === "active").length;
    const limited = accounts.filter((a) => a.accountHealth === "limited").length;
    const suspended = accounts.filter((a) => a.accountHealth === "suspended").length;
    const banned = accounts.filter((a) => a.accountHealth === "banned").length;
    const totalSpend = accounts.reduce((sum, a) => sum + a.currentSpendTotal, 0) / 100;
    const totalAds = accounts.reduce((sum, a) => sum + a.adsCount, 0);

    // Calculate accounts created this week (last 7 days)
    const createdThisWeek = accounts.filter((a) => new Date(a.createdAt) >= oneWeekAgo).length;

    // Calculate accounts handed off this week
    const handedOffThisWeek = accounts.filter((a) =>
      a.handoffDate && new Date(a.handoffDate) >= oneWeekAgo
    ).length;

    context += `- Active: ${active}, Limited: ${limited}, Suspended: ${suspended}, Banned: ${banned}\n`;
    context += `- Total Spend: $${totalSpend.toFixed(2)}, Total Ads: ${totalAds}\n`;
    context += `- Created this week: ${createdThisWeek}, Handed off this week: ${handedOffThisWeek}\n\n`;

    context += "Account Details (ID, Name, Health, Ads, Spend, Created, Handoff Status, Assigned To):\n";
    accounts.forEach((a) => {
      const name = a.identityProfile?.fullName || a.googleCid || "Unknown";
      const internalId = `MM${String(a.internalId).padStart(3, "0")}`;
      const createdDate = a.createdAt.split("T")[0];
      const assignedTo = a.mediaBuyer?.name || "Unassigned";
      context += `- ${internalId} ${name}: ${a.accountHealth}, ${a.adsCount} ads, $${(a.currentSpendTotal / 100).toFixed(2)} spend, created ${createdDate}, ${a.handoffStatus}, ${assignedTo}\n`;
    });
  }

  if (alerts && alerts.length > 0) {
    context += `\nAlerts (${alerts.length} accounts need attention):\n`;
    alerts.forEach((a) => {
      const name = a.identityProfile?.fullName || a.googleCid || "Unknown";
      context += `- ${name} (${a.alertPriority}): ${a.alertReason}\n`;
    });
  }

  if (activities && activities.length > 0) {
    // Filter to this week's activities
    const thisWeekActivities = activities.filter((a) => new Date(a.createdAt) >= oneWeekAgo);

    // Calculate status change stats for the week
    const suspendedThisWeek = thisWeekActivities.filter((a) =>
      a.action === "HEALTH_SUSPENDED" || a.action.includes("SUSPENDED")
    ).length;
    const bannedThisWeek = thisWeekActivities.filter((a) =>
      a.action === "HEALTH_BANNED" || a.action.includes("BANNED")
    ).length;
    const billingFailedThisWeek = thisWeekActivities.filter((a) =>
      a.action === "BILLING_FAILED" || a.action.includes("BILLING_FAILED")
    ).length;
    const assignedThisWeek = thisWeekActivities.filter((a) =>
      a.action === "ASSIGNED"
    ).length;

    context += `\nStatus Change Activity This Week:\n`;
    context += `- Suspended this week: ${suspendedThisWeek}\n`;
    context += `- Banned this week: ${bannedThisWeek}\n`;
    context += `- Billing failed this week: ${billingFailedThisWeek}\n`;
    context += `- Accounts assigned this week: ${assignedThisWeek}\n`;

    // Show recent activities (last 10)
    const recentActivities = thisWeekActivities.slice(0, 10);
    if (recentActivities.length > 0) {
      context += `\nRecent Activity Log:\n`;
      recentActivities.forEach((a) => {
        const date = a.createdAt.split("T")[0];
        const accountName = a.accountName || "Unknown";
        context += `- ${date}: ${accountName} - ${a.action}${a.details ? `: ${a.details}` : ""}\n`;
      });
    }
  }

  // Add full context data if available
  if (fullContext) {
    // Database stats overview
    if (fullContext.stats) {
      const s = fullContext.stats;
      context += `\n=== DATABASE STATISTICS ===\n`;
      context += `Total Accounts: ${s.totalAccounts} | Active: ${s.activeAccounts} | Suspended: ${s.suspendedAccounts} | Banned: ${s.bannedAccounts} | Limited: ${s.limitedAccounts}\n`;
      context += `Total Spend (all time): $${s.totalSpend.toFixed(2)} | Total Ads: ${s.totalAds}\n`;
      context += `Created This Week: ${s.accountsCreatedThisWeek} | Created This Month: ${s.accountsCreatedThisMonth}\n`;
      context += `Identities: ${s.identityCount} | Media Buyers: ${s.mediaBuyerCount} | Pending Requests: ${s.pendingRequests}\n`;
      context += `Check-ins Today: ${s.checkInsToday} | Check-ins This Week: ${s.checkInsThisWeek}\n`;
    }

    // Media buyers performance
    if (fullContext.mediaBuyers && fullContext.mediaBuyers.length > 0) {
      context += `\n=== MEDIA BUYERS ===\n`;
      fullContext.mediaBuyers.forEach((mb) => {
        const status = mb.isActive ? "Active" : "Inactive";
        context += `- ${mb.name}: ${mb.accountCount} accounts, $${mb.totalSpend.toFixed(2)} total spend (${status})\n`;
      });
    }

    // Identity profiles
    if (fullContext.identities && fullContext.identities.length > 0) {
      context += `\n=== IDENTITY PROFILES (${fullContext.identities.length}) ===\n`;
      fullContext.identities.forEach((id) => {
        const goLogin = id.hasGoLoginProfile ? `GoLogin: ${id.goLoginStatus}` : "No GoLogin";
        context += `- ${id.fullName} (${id.geo}): ${id.accountCount} accounts, ${goLogin}, created ${id.createdAt.split("T")[0]}\n`;
      });
    }

    // Pending requests
    if (fullContext.requests && fullContext.requests.length > 0) {
      const pendingReqs = fullContext.requests.filter((r) => r.status === "PENDING");
      if (pendingReqs.length > 0) {
        context += `\n=== PENDING REQUESTS (${pendingReqs.length}) ===\n`;
        pendingReqs.forEach((r) => {
          context += `- ${r.requesterName}: ${r.type} request, submitted ${r.createdAt.split("T")[0]}\n`;
        });
      }
    }

    // Recent check-ins
    if (fullContext.checkIns && fullContext.checkIns.length > 0) {
      context += `\n=== RECENT CHECK-INS (Last 10) ===\n`;
      fullContext.checkIns.slice(0, 10).forEach((ci) => {
        const dateTime = ci.checkedAt.replace("T", " ").split(".")[0];
        context += `- ${dateTime}: ${ci.accountName || "Unknown"} - $${ci.dailySpend} daily, ${ci.accountHealth}, ${ci.billingStatus}${ci.issues ? ` [ISSUES: ${ci.issues}]` : ""}\n`;
      });
    }
  }

  return context;
}

// Generate help response - friendly and comprehensive
function generateHelpResponse(): string {
  return `Hey! 👋 I'm your MagiManager assistant. Here's what I can help you with:

*Quick Commands:*
• /report - Get the full daily breakdown
• /alerts - See what needs attention
• /summary - Quick stats at a glance

*Ask Me Anything About:*
📊 *Account Status*
  "How many accounts are active?"
  "Which accounts got suspended?"
  "What's the status of [name]?"

💰 *Spending & Performance*
  "What's our total spend?"
  "Who are the top performers?"
  "Which accounts are spending well?"

👥 *Team & Assignments*
  "Who's assigned to what?"
  "How many accounts does Derek have?"
  "Show me unassigned accounts"

🔔 *Issues & Alerts*
  "What needs my attention?"
  "Any billing issues?"
  "Show me suspended accounts"

📈 *Trends & History*
  "How many accounts created this week?"
  "What happened yesterday?"

*Pro tip:* Just ask naturally - I'll figure out what you need! 🙂`;
}

// Generate a response about a specific account
export async function generateAccountResponse(
  accountIdentifier: string,
  accounts: AccountData[]
): Promise<string> {
  // Find the account by various identifiers
  const account = accounts.find(
    (a) =>
      a.googleCid?.toLowerCase().includes(accountIdentifier.toLowerCase()) ||
      a.identityProfile?.fullName.toLowerCase().includes(accountIdentifier.toLowerCase()) ||
      a.id.toLowerCase().includes(accountIdentifier.toLowerCase())
  );

  if (!account) {
    return `I couldn't find an account matching "${accountIdentifier}". Try using the Google CID or identity name.`;
  }

  const name = account.identityProfile?.fullName || account.googleCid || "Unknown";
  const geo = account.identityProfile?.geo || "Unknown location";
  const spend = (account.currentSpendTotal / 100).toFixed(2);
  const warmupTarget = (account.warmupTargetSpend / 100).toFixed(2);
  const progress = account.warmupTargetSpend > 0
    ? Math.min(100, (account.currentSpendTotal / account.warmupTargetSpend) * 100).toFixed(0)
    : 0;

  let response = `*Account: ${name}*\n`;
  response += `_${geo}_\n\n`;

  // Health status with emoji
  const healthEmoji = {
    active: "green_circle",
    limited: "warning",
    suspended: "red_circle",
    banned: "no_entry",
    pending: "hourglass_flowing_sand",
  }[account.accountHealth] || "question";

  response += `*Status:* ${account.accountHealth} :${healthEmoji}:\n`;
  response += `*Billing:* ${account.billingStatus}\n`;
  if (account.certStatus) {
    response += `*Certification:* ${account.certStatus}\n`;
  }
  response += `*Handoff:* ${account.handoffStatus}\n\n`;

  response += `*Performance:*\n`;
  response += `- Ads: ${account.adsCount}\n`;
  response += `- Campaigns: ${account.campaignsCount}\n`;
  response += `- Current Spend: $${spend}\n`;
  response += `- Warmup Target: $${warmupTarget} (${progress}%)\n`;

  if (account.mediaBuyer) {
    response += `\n*Assigned to:* ${account.mediaBuyer.name}`;
  }

  return response;
}
