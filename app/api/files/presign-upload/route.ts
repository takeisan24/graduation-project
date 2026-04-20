import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * POST /api/files/presign-upload
 * 
 * Generate a presigned upload URL via Server B so FE can upload directly to S3.
 * This route only handles metadata validation and forwarding to Server B.
 * 
 * Body: { filename: string; contentType: string; contentLength: number; prefix?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Auth: ensure only logged-in users can request presigned URLs
    const auth = await withAuthOnly(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      console.error("[files/presign-upload] Server B configuration missing", {
        SERVER_B_URL: SERVER_B_URL ? "set" : "missing",
        SERVER_B_API_KEY: SERVER_B_API_KEY ? "set" : "missing",
      });
      return fail(
        "Server B is not configured. Please add SERVER_B_URL and SERVER_B_API_KEY to your .env file.",
        500
      );
    }

    const body = await req.json().catch(() => null) as {
      filename?: string;
      contentType?: string;
      contentLength?: number;
      prefix?: string;
    } | null;

    if (!body || !body.filename || !body.contentType || typeof body.contentLength !== "number") {
      return fail("filename, contentType and contentLength are required", 400);
    }

    const { filename, contentType, contentLength } = body;
    const prefix = body.prefix || "posts/media";

    // Basic metadata validation on Server A to avoid abuse
    const MAX_SIZE_BYTES = 1_000_000_000; // 1GB hard limit for post media (aligned với Server B)
    if (contentLength <= 0 || contentLength > MAX_SIZE_BYTES) {
      return fail(`File size is invalid or exceeds limit (${MAX_SIZE_BYTES} bytes).`, 400);
    }

    // Only allow common image/video MIME types for post media
    const allowedPrefixes = ["image/", "video/"];
    if (!allowedPrefixes.some((p) => contentType.startsWith(p))) {
      return fail("Only image and video uploads are allowed for posts.", 400);
    }

    // Forward to Server B to generate presigned URL
    const res = await fetch(`${SERVER_B_URL}/api/v1/files/presign-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SERVER_B_API_KEY,
        "x-user-id": user.id,
      },
      body: JSON.stringify({
        filename,
        contentType,
        contentLength,
        prefix,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[files/presign-upload] Server B error", { status: res.status, json });
      return fail(json?.error || "Server B error while generating presigned URL", res.status);
    }

    // json.data should contain { signed_url, upload_url, key, bucket }
    return success(json?.data ?? json);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/files/presign-upload error:", message);
    return fail(message, 500);
  }
}


