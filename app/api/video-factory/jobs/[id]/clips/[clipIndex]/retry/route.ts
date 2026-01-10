import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";

// Fallback to local dev port if env missing to avoid ECONNREFUSED
const SERVER_B_URL = process.env.SERVER_B_URL ?? "http://localhost:4000";
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * POST /api/video-factory/jobs/[id]/clips/[clipIndex]/retry
 * Proxy tới Server B: POST /api/v1/video-factory/jobs/:id/clips/:clipIndex/retry
 * 
 * Retry a failed clip from a cut job
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; clipIndex: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return fail("Server B is not configured", 500);
    }

    const jobId = params.id;
    const clipIndex = params.clipIndex;
    
    if (!jobId) {
      return fail("Job ID is required", 400);
    }
    
    if (!clipIndex || isNaN(parseInt(clipIndex, 10))) {
      return fail("Clip index is required and must be a number", 400);
    }

    const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/jobs/${jobId}/clips/${clipIndex}/retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SERVER_B_API_KEY,
        "x-user-id": user.id,
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return fail(json?.error || "Server B error", res.status);
    }

    return success(json?.data ?? json, res.status);
  } catch (err: any) {
    console.error("POST /api/video-factory/jobs/[id]/clips/[clipIndex]/retry error:", err);
    return fail("Server error", 500);
  }
}

