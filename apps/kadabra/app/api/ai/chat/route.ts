import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isFeatureEnabled } from "@magimanager/shared";
import { runAgent } from "../../../../lib/gemini-agent-v2";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature flag
    if (!isFeatureEnabled("ai.chat")) {
      return NextResponse.json({ error: "AI chat is disabled" }, { status: 403 });
    }

    const body = await req.json();
    const { message, chatId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const userId = (session.user as { id: string }).id;

    // Process the message using the Gemini agent
    const result = await runAgent(
      message,
      chatId || `web_${userId}`,
      userId
    );

    return NextResponse.json({
      message: result.response,
      toolCalls: result.toolsUsed.map((name) => ({ name })),
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process message" },
      { status: 500 }
    );
  }
}
