/**
 * YouTube Metadata Extraction (Simplified)
 *
 * Trích xuất metadata cơ bản từ URL YouTube
 */

export interface YouTubeMetadata {
  title: string;
  description: string;
  duration: number;
  channelName: string;
  viewCount: number;
  transcript?: string;
}

/**
 * Trích xuất metadata từ YouTube URL
 * Phiên bản đơn giản - chỉ trả về thông tin cơ bản từ URL
 */
export async function extractYouTubeMetadata(url: string): Promise<YouTubeMetadata | null> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) return null;

    return {
      title: `YouTube Video (${videoId})`,
      description: '',
      duration: 0,
      channelName: '',
      viewCount: 0,
    };
  } catch (error) {
    console.error('[YouTube] Failed to extract metadata:', error);
    return null;
  }
}

/**
 * Format metadata cho AI prompt
 */
export function formatYouTubeMetadataForAI(metadata: YouTubeMetadata): string {
  return `Video YouTube: ${metadata.title}\n${metadata.description}`;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
