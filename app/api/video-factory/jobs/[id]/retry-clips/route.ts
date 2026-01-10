import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";

// Fallback to local dev port if env missing to avoid ECONNREFUSED
const SERVER_B_URL = process.env.SERVER_B_URL ?? "http://localhost:4000";
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * POST /api/video-factory/jobs/[id]/retry-clips
 * Proxy tới Server B: POST /api/v1/video-factory/jobs/:id/retry-clips
 *
 * Retry nhiều clips FAILED trong cut job chỉ với một request.
 * Body: { clipIndexes: number[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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
    if (!jobId) {
      return fail("Job ID is required", 400);
    }

    const body = await req.json().catch(() => ({}));
    const clipIndexes = Array.isArray(body.clipIndexes) ? body.clipIndexes : undefined;

    if (!clipIndexes || clipIndexes.length === 0) {
      return fail("clipIndexes must be a non-empty array", 400);
    }

    const res = await fetch(
      `${SERVER_B_URL}/api/v1/video-factory/jobs/${jobId}/retry-clips`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVER_B_API_KEY,
          "x-user-id": user.id,
        },
        body: JSON.stringify({ clipIndexes }),
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return fail(json?.error || "Server B error", res.status);
    }

    return success(json?.data ?? json, res.status);
  } catch (err: any) {
    console.error(
      "POST /api/video-factory/jobs/[id]/retry-clips error:",
      err
    );
    return fail("Server error", 500);
  }
}

