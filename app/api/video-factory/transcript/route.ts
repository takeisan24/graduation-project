import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";
import { YoutubeTranscript } from "youtube-transcript";
import { extractYouTubeId } from "@/lib/utils/videoUtils";
import { supabase } from "@/lib/supabase";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * Normalize URL by removing query params (signature tokens)
 * This ensures URL comparison works even when presigned URLs change
 */
function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    // Return URL without query params (removes ?X-Amz-... signature)
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch (e) {
    return url;
  }
}

/**
 * GET /api/video-factory/transcript
 * Query params:
 * - sourceType: 'youtube' | 'upload'
 * - youtubeUrl?: string (if sourceType === 'youtube')
 * - uploadUrl?: string (if sourceType === 'upload')
 * - mediaAssetId?: string (if sourceType === 'upload', from media library)
 * 
 * Returns transcript segments with timestamps
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const sourceType = searchParams.get('sourceType');
    const youtubeUrl = searchParams.get('youtubeUrl');
    const uploadUrl = searchParams.get('uploadUrl');
    const mediaAssetId = searchParams.get('mediaAssetId'); // ✅ NEW: Accept from FE

    if (!sourceType || (sourceType !== 'youtube' && sourceType !== 'upload')) {
      return fail("sourceType must be 'youtube' or 'upload'", 400);
    }

    if (sourceType === 'youtube') {
      if (!youtubeUrl) {
        return fail("youtubeUrl is required for YouTube source", 400);
      }

      const videoId = extractYouTubeId(youtubeUrl);
      if (!videoId) {
        return fail("Invalid YouTube URL", 400);
      }

      try {
        // Fetch transcript from YouTube (ưu tiên tiếng Việt)
        const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: 'vi', // Try Vietnamese first, fallback to auto
        });

        // Transform to our format
        const segments = transcriptData.map((item, index) => ({
          index,
          startTime: Math.floor(item.offset / 1000), // Convert ms to seconds
          endTime: Math.floor((item.offset + item.duration) / 1000),
          text: item.text,
          speaker: undefined, // YouTube transcript doesn't provide speaker info
        }));

        // Một số video trả về mảng rỗng thay vì throw error -> ép coi như lỗi để chạy fallback
        if (!segments.length) {
          console.warn("YouTube transcript (vi) returned empty segments, will try auto lang / AWS fallback", {
            videoId,
            youtubeUrl,
          });
          throw new Error("EMPTY_TRANSCRIPT_VI");
        }

        // Save transcript to database via Server B
        try {
          if (SERVER_B_URL && SERVER_B_API_KEY) {
            await fetch(`${SERVER_B_URL}/api/v1/video-factory/save-transcript`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': SERVER_B_API_KEY,
                'x-user-id': user.id,
              },
              body: JSON.stringify({
                source_type: 'youtube',
                source_url: youtubeUrl,
                transcript: segments,
                transcript_source: 'youtube',
              }),
            }).catch((err) => {
              console.error('Failed to save YouTube transcript to database:', err);
              // Don't fail the request if DB save fails
            });
          }
        } catch (dbError) {
          console.error('Error saving YouTube transcript to database:', dbError);
          // Continue even if DB save fails
        }

        return success({ segments, source: 'youtube' });
      } catch (error: any) {
        // If Vietnamese transcript not available, try auto-detect
        try {
          const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
          const segments = transcriptData.map((item, index) => ({
            index,
            startTime: Math.floor(item.offset / 1000),
            endTime: Math.floor((item.offset + item.duration) / 1000),
            text: item.text,
            speaker: undefined,
          }));

          // Nếu auto lang vẫn trả về rỗng -> chuyển sang fallback AWS Transcribe
          if (!segments.length) {
            console.warn("YouTube transcript (auto) returned empty segments, switching to AWS Transcribe fallback", {
              videoId,
              youtubeUrl,
            });
            throw new Error("EMPTY_TRANSCRIPT_AUTO");
          }

          // Save transcript to database via Server B
          try {
            if (SERVER_B_URL && SERVER_B_API_KEY) {
              await fetch(`${SERVER_B_URL}/api/v1/video-factory/save-transcript`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': SERVER_B_API_KEY,
                  'x-user-id': user.id,
                },
                body: JSON.stringify({
                  source_type: 'youtube',
                  source_url: youtubeUrl,
                  transcript: segments,
                  transcript_source: 'youtube',
                }),
              }).catch((err) => {
                console.error('Failed to save YouTube transcript to database:', err);
              });
            }
          } catch (dbError) {
            console.error('Error saving YouTube transcript to database:', dbError);
          }

          return success({ segments, source: 'youtube' });
        } catch (retryError) {
          console.error("YouTube transcript fetch error:", retryError);

          // Fallback: if YouTube captions not available, call Server B to transcribe via AWS Transcribe (ASYNC)
          if (!SERVER_B_URL || !SERVER_B_API_KEY) {
            return fail("Could not fetch transcript from YouTube and Server B is not configured for fallback transcription.", 404);
          }

          try {
            console.log('Calling Server B for async AWS Transcribe fallback (YouTube)', { youtubeUrl });
            const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/transcribe-async`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': SERVER_B_API_KEY,
                'x-user-id': user.id,
              },
              body: JSON.stringify({
                // id: jobId, // jobId is not defined here, it's returned by the server
                userId: user.id,
                video_url: youtubeUrl,
                language: 'vi-VN',
                // ✅ DYNAMIC CALLBACK: Use VIDEO_FACTORY_APP_URL for reliable server-to-server webhooks
                callback_url: `${process.env.VIDEO_FACTORY_APP_URL || 'http://localhost:3000'}/api/webhooks/processing/transcript`,
                metadata: {
                  sourceType: 'youtube',
                  youtubeUrl: youtubeUrl,
                },
              }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              console.error('Server B async transcribe job creation failed', { status: res.status, error: json?.error });
              return fail(json?.error || 'Could not fetch transcript from YouTube (no captions) and fallback transcription job creation failed.', res.status);
            }

            console.log('Server B async transcription job created for YouTube fallback', { jobId: json.data?.job_id });

            // Return job_id immediately - FE will poll /api/video-factory/transcript-status?jobId=...
            return success({
              job_id: json.data?.job_id,
              status: json.data?.status || 'queued',
              estimated_completion_time: json.data?.estimated_completion_time,
              source: 'youtube_fallback_transcribe',
              warning: 'YouTube video không có captions, đã tạo job AWS Transcribe. Vui lòng poll status để lấy kết quả.',
            });
          } catch (fallbackErr: any) {
            console.error("YouTube transcript fetch and fallback transcribe job creation failed:", fallbackErr);
            return fail("Could not fetch transcript from YouTube. The video may not have captions enabled and fallback transcription job creation failed.", 404);
          }
        }
      }
    } else {
      // Upload file - ưu tiên dùng transcript đã có trong DB, fallback mới gọi Server B async
      if (!uploadUrl) {
        return fail("uploadUrl is required for upload source", 400);
      }

      // ========================================
      // 1) REUSE LOGIC: Try to find existing transcript
      // ========================================
      // ✅ STRATEGY: Query by source_media_asset_id (immune to signed URL changes)
      // Priority 1: Use mediaAssetId from FE (most reliable)
      // Priority 2: Resolve from uploadUrl S3 key
      // Priority 3: Normalize URL and search by origin

      try {
        let sourceMediaAssetId: string | null = mediaAssetId || null;

        // -------------------------------------------------------
        // PRIORITY 1: Use mediaAssetId from Frontend (if provided)
        // -------------------------------------------------------
        if (sourceMediaAssetId) {
          console.log("✅ Using mediaAssetId from frontend", {
            userId: user.id,
            sourceMediaAssetId,
            hint: "Frontend provided stable media asset ID",
          });
        }

        // -------------------------------------------------------
        // PRIORITY 2: Resolve from uploadUrl S3 key
        // -------------------------------------------------------
        if (!sourceMediaAssetId && uploadUrl) {
          try {
            const urlObj = new URL(uploadUrl);
            const pathname = urlObj.pathname;
            // Extract S3 key (remove leading slash)
            let s3Key = pathname.startsWith('/') ? pathname.substring(1) : pathname;

            // ✅ CRITICAL: URL Decode to handle spaces and special characters
            // Example: "video%20name.mp4" → "video name.mp4"
            // DB storage_key is stored decoded, so we must decode URL before comparison
            try {
              s3Key = decodeURIComponent(s3Key);
            } catch (decodeError) {
              // If decode fails, use original (already decoded or invalid)
              console.warn("Failed to decode S3 key (using original)", { s3Key, decodeError });
            }

            if (s3Key) {
              // Query media_assets by storage_key (exact match)
              const { data: mediaAsset, error: assetError } = await supabase
                .from("media_assets")
                .select("id")
                .eq("user_id", user.id)
                .eq("storage_key", s3Key)
                .eq("asset_type", "video")
                .limit(1)
                .single();

              if (!assetError && mediaAsset) {
                sourceMediaAssetId = mediaAsset.id;
                console.log("✅ Resolved source_media_asset_id from S3 key", {
                  userId: user.id,
                  s3Key: s3Key.substring(0, 50),
                  sourceMediaAssetId,
                  hint: "Found video asset by storage_key (URL decoded)",
                });
              }
            }
          } catch (resolveError) {
            console.warn("Failed to resolve source_media_asset_id from S3 key", resolveError);
          }
        }

        // -------------------------------------------------------
        // PRIORITY 3: Normalize URL and search by origin (fallback)
        // -------------------------------------------------------
        if (!sourceMediaAssetId && uploadUrl) {
          const cleanUrl = normalizeUrl(uploadUrl);
          if (cleanUrl) {
            console.log("Trying normalized URL lookup", {
              userId: user.id,
              originalUrl: uploadUrl.substring(0, 60),
              normalizedUrl: cleanUrl.substring(0, 60),
              hint: "Searching by normalized URL (without signature)",
            });

            // Search media_assets by origin (normalized URL)
            const { data: mediaAssetByOrigin, error: originError } = await supabase
              .from("media_assets")
              .select("id")
              .eq("user_id", user.id)
              .eq("asset_type", "video")
              .or(`origin.eq.${cleanUrl},public_url.eq.${cleanUrl}`)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (!originError && mediaAssetByOrigin) {
              sourceMediaAssetId = mediaAssetByOrigin.id;
              console.log("✅ Resolved source_media_asset_id from normalized URL", {
                userId: user.id,
                sourceMediaAssetId,
                hint: "Found video asset by origin/public_url",
              });
            }
          }
        }

        // -------------------------------------------------------
        // QUERY TRANSCRIPT: If we have source_media_asset_id
        // -------------------------------------------------------
        if (sourceMediaAssetId) {
          const { data: existingTranscript, error: transcriptError } = await supabase
            .from("video_factory_audio_transcripts")
            .select("id, transcript, transcript_source, audio_s3_uri, created_at")
            .eq("source_media_asset_id", sourceMediaAssetId)
            .not("transcript", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (!transcriptError && existingTranscript?.transcript && Array.isArray(existingTranscript.transcript) && existingTranscript.transcript.length > 0) {
            console.log("♻️ REUSE SUCCESS: Found existing transcript", {
              userId: user.id,
              sourceMediaAssetId,
              audioTranscriptId: existingTranscript.id,
              segmentCount: existingTranscript.transcript.length,
              transcriptSource: existingTranscript.transcript_source,
              hint: "✅ Transcript reused - no new transcription job created",
            });
            return success({
              segments: existingTranscript.transcript,
              source: existingTranscript.transcript_source || "aws_transcribe",
              reused: true,
              audio_transcript_id: existingTranscript.id,
              audio_s3_uri: existingTranscript.audio_s3_uri,
            });
          }
        }

        console.log("No existing transcript found - will create new job", {
          userId: user.id,
          sourceMediaAssetId,
          uploadUrl: uploadUrl?.substring(0, 60),
          hint: "No transcript exists for this video - creating new transcription job",
        });
      } catch (dbErr) {
        console.error("Error while checking existing transcript (non-blocking)", dbErr, {
          userId: user.id,
          uploadUrl: uploadUrl?.substring(0, 60),
          hint: "Will fallback to creating new transcription job",
        });
        // Continue to fallback async flow
      }

      // 2) No existing transcript -> Call Server B to transcribe the uploaded video (ASYNC - returns job_id immediately)
      if (!SERVER_B_URL || !SERVER_B_API_KEY) {
        return fail("Server B is not configured", 500);
      }

      console.log("Calling Server B for async AWS Transcribe (upload)", { uploadUrl });
      const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/transcribe-async`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVER_B_API_KEY,
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          // id: jobId, // jobId is not defined here, it's returned by the server
          userId: user.id,
          video_url: uploadUrl,
          language: "vi-VN",
          // ✅ DYNAMIC CALLBACK: Use VIDEO_FACTORY_APP_URL for reliable server-to-server webhooks
          callback_url: `${process.env.VIDEO_FACTORY_APP_URL || "http://localhost:3000"}/api/webhooks/processing/transcript`,
          metadata: {
            sourceType: 'upload',
            uploadUrl: uploadUrl,
            mediaAssetId: mediaAssetId,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Server B async transcribe job creation failed", { status: res.status, error: json?.error });
        return fail(json?.error || "Failed to create transcription job", res.status);
      }

      console.log("Server B async transcription job created", { jobId: json.data?.job_id });

      // Return job_id immediately - FE will poll /api/video-factory/transcript-status?jobId=...
      return success({
        job_id: json.data?.job_id,
        status: json.data?.status || "queued",
        estimated_completion_time: json.data?.estimated_completion_time,
        message: "Transcription job đã được tạo. Vui lòng poll status để lấy kết quả.",
      });
    }
  } catch (err: any) {
    console.error("GET /api/video-factory/transcript error:", err);
    if (err.name === 'AbortError' || err.message?.includes('timeout')) {
      return fail("Transcription timeout. Video quá dài hoặc quá trình transcribe mất quá nhiều thời gian. Vui lòng thử lại sau.", 504);
    }
    return fail("Server error", 500);
  }
}

