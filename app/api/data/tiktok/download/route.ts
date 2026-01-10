import { NextRequest } from 'next/server';
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { uploadFile, getPublicUrl } from "@/lib/services/storage/storageService";
import crypto from "crypto";

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'public';

export async function POST(request: NextRequest) {
  // Add authentication
  const user = await requireAuth(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const { url } = await request.json();

    if (!url) {
      return fail('URL is required', 400);
    }

    // 1) Try tikwm first
    try {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch TikTok info from third-party service');

      const data = await response.json();
      if (data.code === 0 && (data.data?.hdplay || data.data?.play)) {
        const videoUrl = data.data.hdplay || data.data.play;
        return success({
          playUrl: videoUrl,
          mimeType: 'video/mp4', // tikwm không luôn trả mime; dùng mp4 fallback
          title: data.data.title || 'TikTok Video',
          cover: data.data.cover || '',
          size: data.data.size || undefined,
          source: 'tikwm'
        });
      }
      console.warn('[TikTok] tikwm returned invalid response or missing play URL');
    } catch (err) {
      console.warn('[TikTok] tikwm fetch failed, fallback to direct download:', err);
    }

    // 2) Fallback: try to fetch the video directly and upload to Supabase
    try {
      const videoResponse = await fetch(url);
      if (!videoResponse.ok) {
        return fail('Failed to download TikTok video directly', 502);
      }

      const arrayBuffer = await videoResponse.arrayBuffer();
      const videoBuffer = Buffer.from(arrayBuffer);
      const contentType = videoResponse.headers.get('content-type') || 'video/mp4';

      const key = `tiktok/${user.id}/${Date.now()}-${crypto.randomUUID()}.mp4`;
      const uploadResult = await uploadFile(STORAGE_BUCKET, key, videoBuffer, {
        contentType,
        upsert: true
      });

      if (!uploadResult.success || !uploadResult.data?.path) {
        return fail(uploadResult.error || 'Failed to upload video to storage', 502);
      }

      const publicUrl = getPublicUrl(STORAGE_BUCKET, uploadResult.data.path);

      return success({
        playUrl: publicUrl,
        mimeType: contentType,
        title: 'TikTok Video',
        cover: '',
        size: videoBuffer.byteLength,
        source: 'supabase-fallback'
      });
    } catch (fallbackErr) {
      console.error('[TikTok] Direct download + upload fallback failed:', fallbackErr);
      return fail('Failed to fetch and upload TikTok video', 502);
    }

  } catch (error) {
    console.error('Error downloading TikTok video:', error);
    return fail(
      `Failed to download TikTok video: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}