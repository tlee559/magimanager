import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@magimanager/auth";
import { put } from "@vercel/blob";
import { prisma } from "@magimanager/database";

export const maxDuration = 120; // 2 minutes for search + screenshots

const ADSPY_SERVICE_URL = process.env.ADSPY_SERVICE_URL || "http://localhost:8080";
const ADSPY_SERVICE_API_KEY = process.env.ADSPY_SERVICE_API_KEY || "adspy-dev-key";

interface AdSpySearchRequest {
  keyword: string;
  location?: string;
  businessContext?: string;
}

export async function POST(req: NextRequest) {
  console.log("[ADSPY:SEARCH] POST request received");

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: AdSpySearchRequest = await req.json();
    const { keyword, location = "us", businessContext } = body;

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Keyword is required" },
        { status: 400 }
      );
    }

    // Create job in database
    const job = await prisma.adSpyJob.create({
      data: {
        userId: session.user.email,
        keyword: keyword.trim(),
        location,
        businessContext,
        status: "PENDING",
        progress: 0,
        debug: [`[${new Date().toISOString()}] Job created`],
      },
    });

    console.log("[ADSPY:SEARCH] Created job:", job.id);

    // Process the search synchronously
    try {
      await processSearch(job.id, keyword.trim(), location, session.user.email);
    } catch (error) {
      console.error("[ADSPY:SEARCH] Process error:", error);
      await prisma.adSpyJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Search failed",
          debug: {
            push: `[${new Date().toISOString()}] ERROR: ${error instanceof Error ? error.message : String(error)}`,
          },
        },
      });
    }

    // Fetch and return updated job
    const updatedJob = await prisma.adSpyJob.findUnique({
      where: { id: job.id },
    });

    return NextResponse.json({
      success: true,
      job: formatJob(updatedJob || job),
    });
  } catch (error) {
    console.error("[ADSPY:SEARCH] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start search" },
      { status: 500 }
    );
  }
}

async function processSearch(
  jobId: string,
  keyword: string,
  location: string,
  userId: string
) {
  const addDebug = async (msg: string) => {
    await prisma.adSpyJob.update({
      where: { id: jobId },
      data: {
        debug: { push: `[${new Date().toISOString()}] ${msg}` },
      },
    });
    console.log(`[ADSPY:${jobId.slice(0, 8)}] ${msg}`);
  };

  try {
    // Update status to searching
    await addDebug(`Searching for ads: "${keyword}" (location: ${location})`);
    await prisma.adSpyJob.update({
      where: { id: jobId },
      data: { status: "SEARCHING", progress: 10 },
    });

    // Call Python service
    await addDebug(`Calling AdSpy Python service...`);
    const response = await fetch(`${ADSPY_SERVICE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: ADSPY_SERVICE_API_KEY,
        keyword,
        location,
        num_results: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Python service error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    await addDebug(`Got ${result.ads?.length || 0} ads from SerpApi`);

    if (!result.success) {
      throw new Error(result.error || "Search failed");
    }

    // Update status to screenshotting
    await prisma.adSpyJob.update({
      where: { id: jobId },
      data: { status: "SCREENSHOTTING", progress: 50 },
    });

    // Process screenshots - upload base64 to Vercel Blob
    const screenshotUrls: Record<number, string> = {};
    const ads = result.ads || [];

    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      if (ad.landing_page_screenshot_base64) {
        try {
          await addDebug(`Uploading screenshot for ad ${i + 1}...`);

          // Convert base64 to buffer
          const buffer = Buffer.from(ad.landing_page_screenshot_base64, "base64");

          // Upload to Vercel Blob
          const timestamp = Date.now();
          const blobPath = `adspy/${userId}/${jobId}/landing-${i}-${timestamp}.jpg`;
          const blob = await put(blobPath, buffer, {
            access: "public",
            contentType: "image/jpeg",
          });

          screenshotUrls[i] = blob.url;

          // Remove base64 from ad object (we'll use the URL instead)
          delete ad.landing_page_screenshot_base64;
          ad.landing_page_screenshot_url = blob.url;
        } catch (err) {
          await addDebug(`Failed to upload screenshot ${i}: ${err}`);
        }
      }

      // Update progress
      const progress = 50 + Math.round((i / ads.length) * 40);
      await prisma.adSpyJob.update({
        where: { id: jobId },
        data: { progress },
      });
    }

    await addDebug(`Uploaded ${Object.keys(screenshotUrls).length} screenshots`);

    // Update job with results
    await prisma.adSpyJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        ads: ads,
        screenshotUrls: screenshotUrls,
      },
    });

    await addDebug("Search completed successfully!");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ADSPY:${jobId.slice(0, 8)}] ERROR:`, error);

    await prisma.adSpyJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: errorMsg,
        debug: { push: `[${new Date().toISOString()}] FATAL ERROR: ${errorMsg}` },
      },
    });

    throw error;
  }
}

function formatJob(job: any) {
  return {
    id: job.id,
    keyword: job.keyword,
    location: job.location,
    businessContext: job.businessContext,
    status: job.status.toLowerCase(),
    progress: job.progress,
    ads: job.ads,
    aiAnalysis: job.aiAnalysis,
    screenshotUrls: job.screenshotUrls,
    error: job.error,
    debug: job.debug,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
