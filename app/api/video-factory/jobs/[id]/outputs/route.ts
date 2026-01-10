import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";

// Fallback to local dev port if env missing to avoid ECONNREFUSED
const SERVER_B_URL = process.env.SERVER_B_URL ?? "http://localhost:4000";
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * GET /api/video-factory/jobs/[id]/outputs
 * ✅ NEW: Proxy tới Server B: GET /api/v1/video-factory/jobs/:cutJobId/outputs
 * Get all final video outputs from postprocess jobs linked to a cut job
 * 
 * Note: Uses [id] slug to match Next.js routing requirements (same level must use same slug name)
 */
export async function GET(
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

    const cutJobId = params.id; // ✅ FIX: Use 'id' to match Next.js routing requirements
    if (!cutJobId) {
      return fail("Cut Job ID is required", 400);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    try {
      const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/jobs/${cutJobId}/outputs`, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVER_B_API_KEY,
          "x-user-id": user.id,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return fail(json?.error || "Server B error", res.status);
      }

      return success(json?.data ?? json, res.status);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        console.error("GET /api/video-factory/jobs/[id]/outputs timeout:", fetchError);
        return fail("Request timeout - Server B took too long to respond", 504);
      }
      throw fetchError;
    }
  } catch (err: any) {
    console.error("GET /api/video-factory/jobs/[id]/outputs error:", err);
    return fail("Server error", 500);
  }
}

