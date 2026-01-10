import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * POST /api/video-factory/upload
 * Forward request to Server B to generate S3 signed URL
 * Server B handles all AWS S3 operations
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      console.error("Server B configuration missing:", {
        SERVER_B_URL: SERVER_B_URL ? 'set' : 'missing',
        SERVER_B_API_KEY: SERVER_B_API_KEY ? 'set' : 'missing',
      });
      return fail(
        "Server B is not configured. Please add SERVER_B_URL and SERVER_B_API_KEY to your .env file. See docs/SERVER_A_ENV_SETUP.md for details.",
        500
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.filename || !body.contentLength) {
      return fail("Missing filename or contentLength", 400);
    }

    const { filename, contentType, contentLength } = body;

    // Forward to Server B to generate presigned URL
    const res = await fetch(`${SERVER_B_URL}/api/v1/files/presign-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SERVER_B_API_KEY,
        'x-user-id': user.id,
      },
      body: JSON.stringify({
        filename,
        contentType: contentType || 'video/mp4',
        contentLength,
        prefix: 'video_factory/uploads',
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return fail(json?.error || 'Server B error', res.status);
    }

    return success(json?.data ?? json);
  } catch (err: any) {
    console.error("POST /api/video-factory/upload error:", err);
    return fail("Server error", 500);
  }
}

