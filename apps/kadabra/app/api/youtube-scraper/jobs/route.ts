import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { jobs } from "../download/route";

export async function GET() {
  console.log("[JOBS] GET request received");

  const session = await getServerSession(authOptions);
  console.log("[JOBS] Session:", session?.user?.email || "none");

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get jobs for this user (include debug info)
  const userJobs = Array.from(jobs.values())
    .filter((job) => job.userId === session.user?.email)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log(`[JOBS] Returning ${userJobs.length} jobs for user ${session.user.email}`);
  console.log("[JOBS] Total jobs in memory:", jobs.size);

  return NextResponse.json({ success: true, jobs: userJobs });
}
