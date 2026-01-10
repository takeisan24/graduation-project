import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";

// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * GET /api/video-factory/jobs
 * Proxy tới Server B: GET /api/v1/video-factory/jobs?limit=&offset=
 */
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
    const limit = searchParams.get("limit") || "10";
    const offset = searchParams.get("offset") || "0";

    const res = await fetch(
      `${SERVER_B_URL}/api/v1/video-factory/jobs?limit=${encodeURIComponent(
        limit
      )}&offset=${encodeURIComponent(offset)}`,
      {
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
    console.error("GET /api/video-factory/jobs error:", err);
    return fail("Server error", 500);
  }
}


