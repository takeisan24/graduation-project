import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * GET /api/media-assets/presigned-url?key=...
 * 
 * Get presigned URL for a thumbnail key (used by Video Factory clips)
 * This follows the same pattern as media library thumbnails - all thumbnails go through media-assets serving layer
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    
    if (!key) {
      return fail("key parameter is required", 400);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return fail("Server B is not configured", 500);
    }

    // Call Server B to get presigned URL (7 days expiry)
    const res = await fetch(`${SERVER_B_URL}/api/v1/files/presigned-url?key=${encodeURIComponent(key)}&expiresIn=${7 * 24 * 3600}`, {
      headers: {
        'x-api-key': SERVER_B_API_KEY,
        'x-user-id': user.id,
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let errorJson: Record<string, unknown> = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // Not JSON, use text as-is
      }
      
      // 404 is expected if file doesn't exist
      if (res.status === 404) {
        return fail("Thumbnail not found", 404);
      }
      
      console.warn('[media-assets/presigned-url] Backend returned error', {
        key,
        status: res.status,
        error: errorJson.error || errorJson.message || errorText,
      });
      return fail(errorJson.error || "Failed to get presigned URL", res.status);
    }

    const json = await res.json();
    const presignedUrl = json.data?.url || json.url;
    
    if (!presignedUrl) {
      return fail("No presigned URL in response", 500);
    }

    return success({ url: presignedUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[media-assets/presigned-url] error", message);
    return fail(message, 500);
  }
}

