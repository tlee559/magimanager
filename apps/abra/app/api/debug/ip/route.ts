import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

// GET /api/debug/ip - Check outgoing IP address
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    // Get the IP by making a request to an external service
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();

    return NextResponse.json({
      outgoingIp: data.ip,
      note: "This is the IP address that ABRA uses for outgoing requests. Whitelist this in Namecheap API settings."
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to determine IP address" },
      { status: 500 }
    );
  }
}
