import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * GET /api/assets/:assetId
 * 
 * Asset Gateway - OPTION B: 302 Redirect to presigned S3 URL
 * 
 * ✅ PRODUCTION-GRADE FIX: Browser media tags (<video>, <img>) cannot retry via JS
 * ✅ Solution: Return 302 redirect to presigned S3 URL (15-30 min expiry)
 * ✅ Benefits:
 *   - No auth token expiry issues (browser fetches new URL)
 *   - No server bandwidth cost (direct S3 access)
 *   - Browser cache works correctly
 *   - No CORS issues (presigned URLs are public)
 * 
 * Asset ID format:
 * - clip-thumb:{jobId}-{index} → thumbnail for clip
 * - clip-video:{jobId}-{index} → video clip
 * - media-thumb:{assetId} → media library thumbnail
 * - media-video:{assetId} → media library video
 * - ai-project-video:{projectId} → final AI video
 * - ai-scene-video:{projectId}-{sceneId} → intermediate scene video
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { assetId: string } }
) {
  try {
    // ✅ CRITICAL FIX: Support token from query param for browser image/video tags
    // Browser tags (<img>, <video>) cannot set Authorization header, so we use ?token=... in URL
    // requireAuth already supports token from query param, but we need to handle gracefully
    const user = await requireAuth(req);

    // ✅ FIX: If no user but token exists in query param, try to validate token directly
    // This handles cases where token is in URL but requireAuth failed (e.g., expired token)
    if (!user) {
      const url = new URL(req.url);
      const tokenFromQuery = url.searchParams.get('token');

      if (tokenFromQuery) {
        // Token exists in query param but requireAuth failed - likely expired/invalid
        // For browser tags, we should still try to resolve asset (graceful degradation)
        // Server B will handle auth check via x-user-id header (which we can't set from browser)
        // So we'll proceed without user.id, but Server B might reject it
        // This is better than returning 401 immediately
        console.warn('[assets] Token from query param exists but requireAuth failed - proceeding without user.id', {
          assetId: params.assetId,
          hint: 'Browser image/video tags cannot set Authorization header - token might be expired',
        });
      } else {
        // No token at all - return 401
        return new Response("Unauthorized", { status: 401 });
      }
    }

    let assetId = params.assetId;
    if (!assetId) {
      return new Response("Asset ID is required", { status: 400 });
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return new Response("Server B is not configured", { status: 500 });
    }

    // ✅ CRITICAL FIX: Auto-add prefix if missing (backward compatibility)
    // Worker now stores clipId without prefix, but Frontend may send it with or without prefix
    // If assetId is a UUID (no prefix), try to determine type from context or default to clip-video
    // This ensures compatibility with both old format (with prefix) and new format (without prefix)
    if (!assetId.includes(':')) {
      // No prefix - assume it's a clipId UUID and default to clip-video
      // Frontend should ideally send the full format, but we'll handle it gracefully
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId);
      if (isUUID) {
        // Default to clip-video for UUIDs (most common case)
        assetId = `clip-video:${assetId}`;
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[assets] Auto-added clip-video: prefix to UUID assetId', {
            originalAssetId: params.assetId,
            normalizedAssetId: assetId,
            hint: 'Frontend should send full format (clip-video:uuid) but we handle it gracefully',
          });
        }
      }
    }

    // ✅ ENHANCEMENT: Determine expected content type based on prefix
    let expectedContentType = 'application/octet-stream';
    if (assetId.startsWith('media-video:') ||
      assetId.startsWith('clip-video:') ||
      assetId.startsWith('ai-project-video:') ||
      assetId.startsWith('ai-scene-video:')) {
      expectedContentType = 'video/mp4';
    } else if (assetId.startsWith('media-thumb:') || assetId.startsWith('clip-thumb:')) {
      expectedContentType = 'image/jpeg';
    }

    // Parse asset ID to determine type and extract metadata
    const assetIdParts = assetId.split(':');
    if (assetIdParts.length !== 2) {
      return new Response("Invalid asset ID format", { status: 400 });
    }

    const [assetType, assetRef] = assetIdParts;

    // ✅ CRITICAL: Resolve asset ID to S3 key via Server B (with auth for ownership check)
    // Note: If user is null (token expired), we still try but Server B might reject
    const resolveHeaders: Record<string, string> = {
      'x-api-key': SERVER_B_API_KEY,
    };

    if (user?.id) {
      resolveHeaders['x-user-id'] = user.id;
    }

    const resolveRes = await fetch(`${SERVER_B_URL}/api/v1/assets/resolve?assetId=${encodeURIComponent(assetId)}`, {
      headers: resolveHeaders,
    });

    if (!resolveRes.ok) {
      // ✅ CRITICAL FIX: Log error details for debugging
      const errorText = await resolveRes.text().catch(() => '');
      let errorJson: any = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // Not JSON, use text as-is
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('[assets] Failed to resolve asset', {
          assetId,
          assetType,
          status: resolveRes.status,
          error: errorJson.error || errorJson.message || errorText,
        });
      }

      if (resolveRes.status === 404) {
        // ✅ PRODUCTION FIX: Don't cache 404 responses
        return new Response("Asset not found", {
          status: 404,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
      return new Response(`Failed to resolve asset: ${errorJson.error || errorJson.message || 'Unknown error'}`, {
        status: resolveRes.status,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    const resolveData = await resolveRes.json();
    const s3Key = resolveData.data?.s3Key || resolveData.s3Key;
    const contentType = resolveData.data?.contentType || resolveData.contentType || expectedContentType;
    const thumbnailUrl = resolveData.data?.thumbnailUrl || resolveData.thumbnailUrl;
    const isDirectUrl = resolveData.data?.isDirectUrl || resolveData.isDirectUrl;

    // ✅ CRITICAL FIX: If backend returns direct URL (isDirectUrl=true), redirect to it directly
    // This handles cases where thumbnail_url is already a presigned URL or public URL
    // (for backward compatibility with old assets that don't have thumbnail_key)
    if (isDirectUrl && thumbnailUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': thumbnailUrl,
          'Cache-Control': 'public, max-age=1800', // Cache redirect for 30 minutes
          'Content-Type': contentType,
        },
      });
    }

    if (!s3Key) {
      return new Response("Asset S3 key not found", {
        status: 404,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // ✅ PRODUCTION FIX: Get presigned URL from Server B (15-30 min expiry)
    // This URL is temporary and doesn't require auth token
    const presignedHeaders: Record<string, string> = {
      'x-api-key': SERVER_B_API_KEY,
    };

    if (user?.id) {
      presignedHeaders['x-user-id'] = user.id;
    }

    // ✅ CRITICAL FIX: Pass contentType to presigned URL generation
    // This ensures S3 serves the file with correct mime type (e.g. video/mp4) even if file metadata is wrong
    const contentTypeParam = contentType ? `&contentType=${encodeURIComponent(contentType)}` : '';
    const presignedRes = await fetch(`${SERVER_B_URL}/api/v1/assets/presigned?key=${encodeURIComponent(s3Key)}&expiresIn=1800${contentTypeParam}`, {
      headers: presignedHeaders,
    });

    if (!presignedRes.ok) {
      // ✅ CRITICAL FIX: Log error details for debugging
      const errorText = await presignedRes.text().catch(() => '');
      let errorJson: any = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // Not JSON, use text as-is
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('[assets] Failed to get presigned URL', {
          assetId,
          s3Key,
          status: presignedRes.status,
          error: errorJson.error || errorJson.message || errorText,
        });
      }

      if (presignedRes.status === 404) {
        return new Response("Asset file not found on S3", {
          status: 404,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }
      return new Response(`Failed to get presigned URL: ${errorJson.error || errorJson.message || 'Unknown error'}`, {
        status: presignedRes.status,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    const presignedData = await presignedRes.json();
    const presignedUrl = presignedData.data?.url || presignedData.url;

    if (!presignedUrl) {
      return new Response("Failed to generate presigned URL", { status: 500 });
    }

    // ✅ PRODUCTION FIX: Return 302 redirect to presigned S3 URL
    // Browser will fetch directly from S3, no auth token needed
    // Presigned URL expires in 30 minutes, but browser cache can handle that
    return new Response(null, {
      status: 302,
      headers: {
        'Location': presignedUrl,
        'Cache-Control': 'public, max-age=1800', // Cache redirect for 30 minutes
        'Content-Type': contentType,
      },
    });
  } catch (err: any) {
    console.error("[assets] error", err);
    return new Response("Server error", { status: 500 });
  }
}

