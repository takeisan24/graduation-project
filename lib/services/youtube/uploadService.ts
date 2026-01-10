import { google } from "googleapis";
import { getValidAccessToken } from "./tokenService";
import { supabase } from "@/lib/supabase";
import { Readable } from "stream";
import { createScheduledPost } from "@/lib/services/db/posts";

// Helper: Tách bài đăng thành Title và Description
// YouTube bắt buộc có Title (max 100 ký tự).
// Logic: Lấy dòng đầu tiên làm Title, phần còn lại làm Description.
function parseContentForYouTube(content: string) {
  const lines = content.split('\n');
  let title = lines[0].trim();
  let description = lines.slice(1).join('\n').trim();

  // Nếu title quá dài (>100), cắt bớt
  if (title.length > 100) {
    title = title.substring(0, 97) + "...";
    // Phần bị cắt và phần còn lại đưa xuống description
    description = content;
  }

  // Nếu không có description (bài viết 1 dòng), dùng chính title làm desc hoặc để trống
  if (!description) {
    description = title;
  }
  return { title, description };
}
interface VideoMetadata {
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: 'public' | 'private' | 'unlisted';
  madeForKids?: boolean;
}

/**
 * Xử lý upload video lên YouTube bằng cách native (không qua 3rd-party)
  * @param userId ID người dùng trong hệ thống
  * @param connection Kết nối ConnectedAccount
  * @param text Nội dung bài đăng (dùng để tách Title & Desc)
  * @param mediaUrls Mảng URL media (chỉ lấy phần tử đầu tiên làm video)
  * @param scheduledAt Thời gian lên lịch (nếu có)
  */
export async function handleNativeYoutubeUpload(
  userId: string,
  connection: any, // ConnectedAccount object
  text: string,
  mediaUrls: string[],
  scheduledAt?: string | null,
  isShorts: boolean = false
) {
  try {
    // 1. Validate
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error("YouTube requires a video file.");
    }
    const videoUrl = mediaUrls[0];

    // 2. Metadata
    let { title, description } = parseContentForYouTube(text);

    // Append #shorts if requested
    if (isShorts) {
      if (!title.toLowerCase().includes('#shorts')) {
        title += ' #shorts';
      }
      if (!description.toLowerCase().includes('#shorts')) {
        description += ' #shorts';
      }
    }

    // 3. Token
    const accessToken = await getValidAccessToken(connection.id);

    // 4. Google Client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // 5. Fetch Video (Buffer approach for stability)
    console.log(`[YouTube Native] Fetching video from: ${videoUrl}`);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error("Failed to download video from storage");

    const arrayBuffer = await videoResponse.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);
    console.log(`[YouTube Native] Video downloaded. Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // --- LOGIC MỚI: XỬ LÝ LỊCH ĐĂNG ---
    const resourceBody: any = {
      snippet: {
        title,
        description,
        tags: ["Maiovo", "AI Content"],
      },
      status: {
        selfDeclaredMadeForKids: false,
      },
    };

    // Kiểm tra kỹ scheduledAt có giá trị hợp lệ không
    const hasSchedule = scheduledAt && scheduledAt.trim() !== "";

    if (hasSchedule) {
      // Ép kiểu về ISO String chuẩn để tránh lỗi định dạng
      const publishTimeISO = new Date(scheduledAt).toISOString();

      console.log(`[YouTube Native] SCHEDULING video: "${title}" at ${publishTimeISO}`);

      // BẮT BUỘC: privacyStatus phải là 'private' khi dùng publishAt
      resourceBody.status.privacyStatus = "private";
      resourceBody.status.publishAt = publishTimeISO;
    } else {
      console.log(`[YouTube Native] PUBLISHING video NOW: "${title}"`);
      // Đăng ngay -> Public
      resourceBody.status.privacyStatus = "public";
    }
    // ---------------------------------

    // 6. Upload
    const res = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: resourceBody,
      media: {
        body: Readable.from(videoBuffer), // Wrap Buffer in Readable stream
      },
    });

    const youtubeId = res.data.id;
    if (!youtubeId) throw new Error("Upload failed: No video ID returned");

    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    // Log kết quả trả về từ Google để debug
    console.log(`[YouTube Native] Upload Success. Google Status:`, res.data.status?.privacyStatus);

    // 7. Lưu DB
    const finalStatus = hasSchedule ? 'scheduled' : 'posted';

    const scheduledPost = await createScheduledPost({
      user_id: userId,
      platform: "youtube",
      scheduled_at: hasSchedule ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
      late_job_id: null,
      status: finalStatus,
      post_url: youtubeUrl,
      payload: {
        connected_account_id: connection.id,
        text_content: text,
        media_urls: mediaUrls,
        youtube_id: youtubeId,
        title,
        description,
        is_native_schedule: hasSchedule,
        is_shorts: isShorts,
        google_response_status: res.data.status // Lưu lại để debug nếu cần
      }
    });

    return {
      success: true,
      scheduledPost,
      status: finalStatus,
      message: hasSchedule
        ? "Video uploaded and scheduled on YouTube"
        : "Video uploaded successfully to YouTube"
    };

  } catch (error: any) {
    console.error("[YouTube Native] Upload Error:", error);
    return {
      success: false,
      status: "failed",
      errorMessage: error.message || "Native upload failed",
      errorDetails: error
    };
  }
}

/**
 * Upload video lên YouTube
 * @param connectionId ID kết nối trong DB
 * @param videoUrl URL public của video (từ Supabase Storage hoặc link ngoài)
 * @param metadata Thông tin tiêu đề, mô tả...
 */
export async function uploadVideoToYouTube(
  connectionId: string,
  videoUrl: string,
  metadata: VideoMetadata
) {
  // 1. Lấy Token xịn
  const accessToken = await getValidAccessToken(connectionId);

  // 2. Setup Google Client
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  // 3. Tải video từ URL về dạng Buffer (để ổn định hơn Stream)
  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const videoBuffer = Buffer.from(arrayBuffer);

  console.log(`[YouTube] Starting upload: ${metadata.title}`);

  // 4. Gọi API Upload
  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags || [],
      },
      status: {
        privacyStatus: metadata.privacyStatus || 'public',
        selfDeclaredMadeForKids: metadata.madeForKids || false,
      },
    },
    media: {
      body: Readable.from(videoBuffer),
    },
  });

  console.log(`[YouTube] Upload success! Video ID: ${res.data.id}`);

  return {
    videoId: res.data.id,
    videoUrl: `https://www.youtube.com/watch?v=${res.data.id}`,
    channelId: res.data.snippet?.channelId
  };

}