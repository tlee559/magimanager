// ============================================================================
// DECOMMISSION API HANDLER - Shared Next.js route handlers for decommission
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { decommissionService } from "../services";
import { requireAuth, requireManager, requireAdmin } from "@magimanager/auth";
import type { DecommissionTriggerType, DecommissionJobType, DecommissionJobStatus } from "@magimanager/shared";

/**
 * Handler for GET /api/decommission
 * List all decommission jobs
 */
export async function decommissionGetHandler(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as DecommissionJobStatus | null;

    const result = await decommissionService.getJobs(
      status ? { status } : undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ jobs: result.data });
  } catch (error) {
    console.error("GET /api/decommission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/decommission/start
 * Start a new decommission job
 */
export async function decommissionStartHandler(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { identityId, triggerType, jobType, scheduledFor } = body as {
      identityId: string;
      triggerType?: DecommissionTriggerType;
      jobType?: DecommissionJobType;
      scheduledFor?: string;
    };

    if (!identityId) {
      return NextResponse.json({ error: "identityId is required" }, { status: 400 });
    }

    const result = await decommissionService.startDecommission(identityId, {
      triggerType: triggerType || "manual",
      triggeredBy: auth.user?.id,
      jobType: jobType || "archive",
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ job: result.data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/decommission/start error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/decommission/[id]
 * Get a specific decommission job
 */
export async function decommissionGetByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await decommissionService.getJob(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ job: result.data });
  } catch (error) {
    console.error("GET /api/decommission/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/decommission/[id]/execute
 * Execute a pending decommission job immediately
 */
export async function decommissionExecuteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await decommissionService.executeDecommission(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ job: result.data });
  } catch (error) {
    console.error("POST /api/decommission/[id]/execute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/decommission/[id]/cancel
 * Cancel a pending decommission job
 */
export async function decommissionCancelHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const result = await decommissionService.cancelDecommission(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/decommission/[id]/cancel error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for POST /api/decommission/[id]/retry
 * Retry a failed decommission job
 */
export async function decommissionRetryHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    // Get the existing job
    const jobResult = await decommissionService.getJob(id);
    if (!jobResult.success || !jobResult.data) {
      return NextResponse.json({ error: jobResult.error || "Job not found" }, { status: 404 });
    }

    const job = jobResult.data;
    if (job.status !== "failed") {
      return NextResponse.json({ error: "Can only retry failed jobs" }, { status: 400 });
    }

    // Restart the job with same parameters
    const restartResult = await decommissionService.startDecommission(
      job.identityProfileId,
      {
        triggerType: job.triggerType as DecommissionTriggerType,
        triggeredBy: auth.user?.id,
        jobType: job.jobType as DecommissionJobType,
      }
    );

    if (!restartResult.success) {
      return NextResponse.json({ error: restartResult.error }, { status: 400 });
    }

    // Execute immediately
    const executeResult = await decommissionService.executeDecommission(restartResult.data!.id);

    if (!executeResult.success) {
      return NextResponse.json({ error: executeResult.error }, { status: 400 });
    }

    return NextResponse.json({ job: executeResult.data });
  } catch (error) {
    console.error("POST /api/decommission/[id]/retry error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Handler for GET /api/decommission/candidates
 * Get identities that are candidates for auto-decommission
 */
export async function decommissionCandidatesHandler(request: NextRequest) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.error;

  try {
    const result = await decommissionService.getAutoDecommissionCandidates();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ candidates: result.data });
  } catch (error) {
    console.error("GET /api/decommission/candidates error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
