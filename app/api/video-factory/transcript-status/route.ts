import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * GET /api/video-factory/transcript-status
 * Query params: jobId (required)
 * 
 * Returns job status and transcript segments if completed
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return fail("jobId is required", 400);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return fail("Server B is not configured", 500);
    }

    // Get job status from Server B
    const res = await fetch(`${SERVER_B_URL}/api/v1/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SERVER_B_API_KEY,
        'x-user-id': user.id,
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return fail(json?.error || 'Failed to get job status', res.status);
    }

    const job = json.data?.job;
    if (!job) {
      return fail("Job not found", 404);
    }

    // Log response status for monitoring
    const jobStatus = job.status || 'unknown';
    const jobType = job.job_type || 'unknown';
    console.log(`[transcript-status] Response status job: ${jobStatus} (job_type: ${jobType}, jobId: ${jobId})`);

    // Return job status and transcript if completed
    // ✅ OPTIMIZED: Read from transcript field only (primary source of truth)
    // Fallback to segments only for backward compatibility with old jobs
    const transcriptData = job.status === 'completed' 
      ? (job.output_data?.transcript || job.output_data?.segments || [])
      : undefined;
    
    return success({
      job_id: job.id,
      status: job.status,
      segments: transcriptData, // ✅ OPTIMIZED: Primary source is transcript field, fallback to segments for old jobs
      source: job.status === 'completed' ? (job.output_data?.source || 'upload') : undefined,
      error: job.status === 'failed' ? (job.error_message || 'Transcription failed') : undefined,
      progress: job.progress || 0,
      progress_message: job.progress_message || undefined,
    });
  } catch (err: any) {
    console.error("GET /api/video-factory/transcript-status error:", err);
    return fail("Server error", 500);
  }
}

