import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/gemini-agent-v2";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    console.log(`[TestAgent] Testing with message: "${message}"`);

    const result = await runAgent(message, "test-chat", "test-user");

    console.log(`[TestAgent] Response: "${result.response.slice(0, 100)}..."`);
    console.log(`[TestAgent] Tools used: ${result.toolsUsed.join(", ") || "none"}`);

    return NextResponse.json({
      response: result.response,
      toolsUsed: result.toolsUsed,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[TestAgent] Error:", errorMessage);
    if (errorStack) {
      console.error("[TestAgent] Stack:", errorStack);
    }

    return NextResponse.json({
      error: errorMessage,
      stack: errorStack,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "POST with { message: 'your question' } to test the agent",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
}
