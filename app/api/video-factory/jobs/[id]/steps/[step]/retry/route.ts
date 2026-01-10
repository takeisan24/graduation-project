import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * POST /api/video-factory/jobs/[id]/steps/[step]/retry
 * Proxy tới Server B: POST /api/v1/video-factory/jobs/:id/steps/:step/retry
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; step: string } }
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
    const stepName = params.step;
    if (!jobId || !stepName) {
      return fail("Job ID and step are required", 400);
    }

    const res = await fetch(
      `${SERVER_B_URL}/api/v1/video-factory/jobs/${jobId}/steps/${stepName}/retry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVER_B_API_KEY,
          "x-user-id": user.id,
        },
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return fail(json?.error || "Server B error", res.status);
    }

    return success(json?.data ?? json, res.status);
  } catch (err: any) {
    console.error("POST /api/video-factory/jobs/[id]/steps/[step]/retry error:", err);
    return fail("Server error", 500);
  }
}


