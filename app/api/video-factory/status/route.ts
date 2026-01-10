import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

// Fallback to local dev port if env missing to avoid ECONNREFUSED
const SERVER_B_URL = process.env.SERVER_B_URL ?? "http://localhost:4000";
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return fail("Server B is not configured", 500);
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) {
      return fail("jobId is required", 400);
    }

    // Proxy tới Server B Video Factory status endpoint:
    // GET /api/v1/video-factory/jobs/:id/status
    const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/jobs/${jobId}/status`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SERVER_B_API_KEY,
        'x-user-id': user.id,
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return fail(json?.error || 'Server B error', res.status);
    }

    // ✅ FIX: Ensure isFinal and nextPollAfterSec are properly forwarded from Server B
    // Server B returns: { data: { job: {...}, isFinal: boolean, nextPollAfterSec: number } }
    // or: { data: { isFinal: boolean, nextPollAfterSec: number, ... } }
    const data = json?.data ?? json;
    
    // ✅ DEBUG: Log response structure for debugging polling issues
    if (process.env.NODE_ENV === 'development') {
      console.log('[video-factory/status] Server B response', {
        jobId,
        hasData: !!data,
        isFinal: data?.isFinal,
        nextPollAfterSec: data?.nextPollAfterSec,
        jobStatus: data?.job?.status || data?.status,
      });
    }

    return success(data, res.status);
  } catch (err: any) {
    console.error("GET /api/video-factory/status error:", err);
    return fail("Server error", 500);
  }
}

