import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";

/**
 * POST /api/data/youtube
 * Body: { url: string }
 * For now, returns the provided URL as a direct reference.
 * Note: Robust video download/transcoding requires external tooling (e.g., ytdl-core service or a serverless job).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { url } = await req.json();
    if (!url) return fail("url is required", 400);

    // Placeholder: we don't attempt to download from YouTube here
    return success({ url, isDirect: true });
  } catch (err: any) {
    console.error("POST /api/data/youtube error:", err);
    return fail(err.message || "Server error", 500);
  }
}
