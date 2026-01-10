import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";

/**
 * POST /api/data/audio
 * Body: { url: string }
 * Fetch audio by URL and return base64 + mimeType
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { url } = await req.json();
    if (!url) return fail("url is required", 400);

    const res = await fetch(url);
    if (!res.ok) return fail(`Failed to fetch audio: ${res.statusText}`, 400);

    const contentType = res.headers.get('content-type') || 'audio/mpeg';
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return success({ base64, mimeType: contentType, size: buffer.byteLength });
  } catch (err: any) {
    console.error("POST /api/data/audio error:", err);
    return fail(err.message || "Server error", 500);
  }
}
