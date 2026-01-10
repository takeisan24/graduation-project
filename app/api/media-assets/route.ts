import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * GET /api/media-assets
 *
 * Fetch paginated media assets for the authenticated user.
 * Used by Media Library in VideosSection and Video Factory input.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const offset = Number(searchParams.get("offset") || 0);
    const type = searchParams.get("type"); // optional: image|video|audio|document

    let query = supabase
      .from("media_assets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq("asset_type", type);

      // ✅ UPDATED: Show both uploaded videos AND processed clips from Video Factory
      // Previously we only showed uploaded videos (source_type='uploaded'),
      // but users also want to see:
      // - Cut clips (source_type='processed', metadata.step='cut')
      // - Postprocessed outputs (source_type='processed', metadata.step='postprocess')
      // - AI-generated videos (source_type='ai_generated')
      // 
      // The old filter was too restrictive and hid all Video Factory outputs
    }

    const { data, error } = await query;
    if (error) {
      console.error("[media-assets] query error", error);
      return fail("Failed to fetch media assets", 500);
    }

    // ✅ OPTIMIZATION: Bulk sign thumbnail URLs for all assets at once (instead of per-asset)
    // This reduces API calls from N to 1 batch call, improving performance and reducing log noise
    const assets = data || [];

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      // Server B not configured, return assets as-is
      return success({ assets });
    }

    // ✅ OPTIMIZATION: Helper functions
    const isPresignedUrlExpired = (url: string): boolean => {
      try {
        const urlObj = new URL(url);
        const expiresParam = urlObj.searchParams.get('X-Amz-Expires');
        const dateParam = urlObj.searchParams.get('X-Amz-Date');

        if (!expiresParam || !dateParam) {
          return true; // Not a presigned URL - treat as expired
        }

        // Parse X-Amz-Date (format: YYYYMMDDTHHmmssZ)
        const year = parseInt(dateParam.substring(0, 4), 10);
        const month = parseInt(dateParam.substring(4, 6), 10) - 1;
        const day = parseInt(dateParam.substring(6, 8), 10);
        const hour = parseInt(dateParam.substring(9, 11), 10);
        const minute = parseInt(dateParam.substring(11, 13), 10);
        const second = parseInt(dateParam.substring(13, 15), 10);
        const expiryDate = new Date(Date.UTC(year, month, day, hour, minute, second));

        const expiresInSeconds = parseInt(expiresParam, 10);
        if (isNaN(expiresInSeconds)) {
          return true;
        }
        expiryDate.setSeconds(expiryDate.getSeconds() + expiresInSeconds);

        const now = new Date();
        const oneDayInMs = 24 * 60 * 60 * 1000;
        const timeUntilExpiry = expiryDate.getTime() - now.getTime();

        return timeUntilExpiry < oneDayInMs;
      } catch (err) {
        return true;
      }
    };

    const extractThumbnailS3Key = (asset: any): string | null => {
      if (!asset.thumbnail_url || !asset.thumbnail_url.startsWith('https://')) {
        return null;
      }

      let s3Key: string | null = null;
      const isPresignedUrl = asset.thumbnail_url?.includes('X-Amz-Algorithm') ||
        asset.thumbnail_url?.includes('X-Amz-Signature');

      // Method 1: Extract S3 key from presigned URL
      if (isPresignedUrl) {
        try {
          const url = new URL(asset.thumbnail_url);
          let pathname = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
          const pathParts = pathname.split('/');
          if (pathParts.length > 1 && pathParts[0].includes('project-omni')) {
            s3Key = pathParts.slice(1).join('/');
          } else {
            s3Key = pathname;
          }
        } catch {
          // URL parsing failed, try next method
        }
      }

      // Method 2: Extract S3 key from thumbnail URL if it's a full S3 URL
      if (!s3Key && asset.thumbnail_url.includes('.s3.')) {
        try {
          const url = new URL(asset.thumbnail_url);
          s3Key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
        } catch {
          // URL parsing failed, try next method
        }
      }

      // Method 3: If we have storage_key, try to construct thumbnail key
      if (!s3Key && asset.storage_key) {
        const baseKey = asset.storage_key.replace(/\.(mp4|webm|mov|avi|mkv)$/i, '');
        s3Key = `${baseKey}_thumb.jpg`; // Most common pattern
      }

      // Method 4: If thumbnail_url contains the key pattern, extract it
      if (!s3Key && asset.thumbnail_url.includes('_thumb')) {
        const match = asset.thumbnail_url.match(/media\/[^/]+\/(.+)$/);
        if (match) {
          s3Key = match[1].split('?')[0]; // Remove query params if any
        }
      }

      return s3Key;
    };

    // ✅ OPTIMIZATION: Collect all unique thumbnail keys that need presigned URLs
    const thumbnailKeysToSign = new Map<string, { asset: any; index: number }>();

    assets.forEach((asset: any, index: number) => {
      if (!asset.thumbnail_url || !asset.thumbnail_url.startsWith('https://')) {
        return;
      }

      const isPresignedUrl = asset.thumbnail_url?.includes('X-Amz-Algorithm') ||
        asset.thumbnail_url?.includes('X-Amz-Signature');
      const needsRefresh = isPresignedUrl ? isPresignedUrlExpired(asset.thumbnail_url) : true;

      if (needsRefresh) {
        const s3Key = extractThumbnailS3Key(asset);
        if (s3Key) {
          thumbnailKeysToSign.set(s3Key, { asset, index });
        }
      }
    });

    // ✅ OPTIMIZATION: Bulk sign all thumbnail URLs at once
    const thumbnailUrlMap = new Map<string, string>();

    if (thumbnailKeysToSign.size > 0) {
      // ✅ DEBUG: Check Server B configuration
      if (!SERVER_B_URL || !SERVER_B_API_KEY) {
        console.warn('[media-assets] Server B not configured - skipping presigned URL generation', {
          hasServerBUrl: !!SERVER_B_URL,
          hasServerBApiKey: !!SERVER_B_API_KEY,
          thumbnailKeysCount: thumbnailKeysToSign.size,
        });
      } else {
        await Promise.all(
          Array.from(thumbnailKeysToSign.keys()).map(async (s3Key) => {
            try {
              const url = `${SERVER_B_URL}/api/v1/files/presigned-url?key=${encodeURIComponent(s3Key)}&expiresIn=${7 * 24 * 3600}`;
              const res = await fetch(url, {
                headers: {
                  'x-api-key': SERVER_B_API_KEY,
                  'x-user-id': user.id,
                },
                // ✅ DEBUG: Add timeout to prevent hanging
                signal: AbortSignal.timeout(10000), // 10 second timeout
              });

              if (res.ok) {
                const json = await res.json();
                const presignedUrl = json.data?.url || json.url;
                if (presignedUrl) {
                  thumbnailUrlMap.set(s3Key, presignedUrl);
                } else {
                  console.warn('[media-assets] Server B returned OK but no URL in response', {
                    s3Key,
                    status: res.status,
                    responseKeys: Object.keys(json || {}),
                  });
                }
              } else {
                // ✅ DEBUG: Log non-OK responses
                const errorText = await res.text().catch(() => '');
                console.warn('[media-assets] Server B returned error for presigned URL', {
                  s3Key,
                  status: res.status,
                  statusText: res.statusText,
                  error: errorText.substring(0, 200), // Limit error text length
                });
              }
            } catch (err) {
              // ✅ DEBUG: Enhanced error logging
              const errorMessage = err instanceof Error ? err.message : String(err);
              const errorCause = err instanceof Error && err.cause ? String(err.cause) : undefined;
              const isConnectionError = errorMessage.includes('fetch failed') ||
                errorMessage.includes('ECONNREFUSED') ||
                errorMessage.includes('ENOTFOUND');

              console.warn('[media-assets] Failed to generate presigned URL for thumbnail (non-blocking)', {
                s3Key,
                error: errorMessage,
                errorCause,
                isConnectionError,
                serverBUrl: SERVER_B_URL ? `${SERVER_B_URL.substring(0, 50)}...` : 'not configured',
                hint: isConnectionError
                  ? 'Server B may not be running or SERVER_B_URL is incorrect. Check SERVER_B_URL env variable and ensure Server B is running.'
                  : 'Unknown error - check Server B logs',
              });
            }
          })
        );
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[media-assets] Generated presigned URLs for media assets', {
          totalAssets: assets.length,
          uniqueThumbnailKeys: thumbnailKeysToSign.size,
          thumbnailUrlsGenerated: thumbnailUrlMap.size,
        });
      }
    }

    // ✅ OPTIMIZATION: Map assets with bulk-signed URLs
    const assetsWithPresignedThumbnails = assets.map((asset: any) => {
      if (!asset.thumbnail_url || !asset.thumbnail_url.startsWith('https://')) {
        return asset;
      }

      const s3Key = extractThumbnailS3Key(asset);
      if (s3Key && thumbnailUrlMap.has(s3Key)) {
        return {
          ...asset,
          thumbnail_url: thumbnailUrlMap.get(s3Key)!,
        };
      }

      return asset;
    });

    return success({ assets: assetsWithPresignedThumbnails });
  } catch (err: any) {
    console.error("[media-assets] error", err);
    return fail("Server error", 500);
  }
}

/**
 * POST /api/media-assets
 *
 * Register a new media asset backed by S3 (no Supabase storage upload).
 * Called after a successful S3 upload (e.g., Video Factory file upload).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json().catch(() => null) as {
      asset_type?: string;
      public_url?: string;
      storage_bucket?: string;
      storage_key?: string;
      thumbnail_url?: string | null;
      duration?: number | null;
      mime_type?: string | null;
      metadata?: Record<string, unknown>;
      job_id?: string | null;
    } | null;

    if (!body?.public_url || !body?.storage_bucket || !body?.storage_key) {
      return fail("public_url, storage_bucket and storage_key are required", 400);
    }

    const assetType = body.asset_type || "video";

    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        user_id: user.id,
        job_id: body.job_id || null,
        asset_type: assetType,
        source_type: "uploaded",
        origin: "server_a",
        storage_type: "s3",
        storage_bucket: body.storage_bucket,
        storage_key: body.storage_key,
        public_url: body.public_url,
        thumbnail_url: body.thumbnail_url ?? null,
        file_size: null,
        mime_type: body.mime_type ?? null,
        duration: body.duration ?? null,
        metadata: body.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) {
      console.error("[media-assets] create error", error);
      return fail("Failed to create media asset", 500);
    }

    return success({ asset: data });
  } catch (err: any) {
    console.error("[media-assets] POST error", err);
    return fail("Server error", 500);
  }
}

/**
 * DELETE /api/media-assets?id=...
 *
 * Delete a media asset for the current user:
 * - Calls Server B to delete the S3 object and DB record
 * - Ensures user only deletes their own assets
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return fail("id is required", 400);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      console.error("[media-assets] Server B configuration missing for DELETE", {
        SERVER_B_URL: SERVER_B_URL ? "set" : "missing",
        SERVER_B_API_KEY: SERVER_B_API_KEY ? "set" : "missing",
      });
      return fail("Server B is not configured", 500);
    }

    // Optional: verify ownership before delegating to Server B
    const { data: existing, error } = await supabase
      .from("media_assets")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !existing) {
      console.error("[media-assets] asset not found or not owned by user", { id, userId: user.id, error });
      return fail("Media asset not found", 404);
    }

    // Delegate actual S3 + DB deletion to Server B
    let res: Response;
    try {
      res = await fetch(`${SERVER_B_URL}/api/v1/files/media-assets/${id}`, {
        method: "DELETE",
        headers: {
          "x-api-key": SERVER_B_API_KEY,
          "x-user-id": user.id,
        },
      });
    } catch (fetchError: any) {
      // Handle connection errors (ECONNREFUSED, network issues, etc.)
      const isConnectionError =
        fetchError?.code === "ECONNREFUSED" ||
        fetchError?.message?.includes("fetch failed") ||
        fetchError?.cause?.code === "ECONNREFUSED";

      if (isConnectionError) {
        console.error("[media-assets] Cannot connect to Server B (JQM backend)", {
          SERVER_B_URL,
          error: fetchError?.message || fetchError,
          hint: "Ensure JQM backend is running on the configured port (default: 3001)",
        });
        return fail(
          "Backend service is unavailable. Please ensure the JQM backend server is running.",
          503
        );
      }

      // Re-throw other fetch errors
      throw fetchError;
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[media-assets] Server B delete error", { status: res.status, json });
      return fail(json?.error || "Failed to delete media asset", res.status);
    }

    return success({ id });
  } catch (err: any) {
    console.error("[media-assets] DELETE error", err);
    return fail("Server error", 500);
  }
}

/**
 * PATCH /api/media-assets
 *
 * Update media asset metadata (e.g., editable title) for the current user.
 * Only metadata is updated; storage location (S3) remains unchanged.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const body = await req.json().catch(() => null) as {
      id?: string;
      metadata?: Record<string, unknown>;
    } | null;

    if (!body?.id || !body.metadata) {
      return fail("id and metadata are required", 400);
    }

    const { data, error } = await supabase
      .from("media_assets")
      .update({
        metadata: body.metadata,
      })
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      console.error("[media-assets] PATCH update error", error);
      return fail("Failed to update media asset", 500);
    }

    return success({ asset: data });
  } catch (err: any) {
    console.error("[media-assets] PATCH error", err);
    return fail("Server error", 500);
  }
}
