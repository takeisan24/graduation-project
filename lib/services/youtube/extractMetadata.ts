/**
 * YouTube Metadata Extraction Service
 * 
 * Extracts metadata (title, description, transcript if available) from YouTube videos
 * This is necessary because:
 * - OpenAI cannot directly access YouTube links
 * - Gemini can use Google Search grounding but it's more reliable to extract metadata first
 * 
 * Uses YouTube Data API v3 if API key is available, otherwise falls back to web scraping
 */

interface YouTubeMetadata {
  title: string;
  description: string;
  channelName?: string;
  videoId: string;
  transcript?: string;
  duration?: string;
  publishedAt?: string;
}

/**
 * Extract video ID from various YouTube URL formats
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract metadata using YouTube Data API v3 (if API key is available)
 */
async function extractWithAPI(videoId: string): Promise<YouTubeMetadata | null> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    // Get video details
    const videoResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`
    );

    if (!videoResponse.ok) {
      console.warn(`[YouTube API] Failed to fetch video: ${videoResponse.status}`);
      return null;
    }

    const videoData = await videoResponse.json();
    if (!videoData.items || videoData.items.length === 0) {
      return null;
    }

    const video = videoData.items[0];
    const snippet = video.snippet || {};
    const contentDetails = video.contentDetails || {};

    return {
      videoId,
      title: snippet.title || 'Untitled',
      description: snippet.description || '',
      channelName: snippet.channelTitle || '',
      duration: contentDetails.duration || '',
      publishedAt: snippet.publishedAt || ''
    };
  } catch (error) {
    console.error('[YouTube API] Error extracting metadata:', error);
    return null;
  }
}

/**
 * Extract metadata using web scraping (fallback method)
 * Note: This is less reliable and may break if YouTube changes their HTML structure
 */
async function extractWithScraping(videoId: string): Promise<YouTubeMetadata | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract title from JSON-LD or meta tags
    const titleMatch = html.match(/<title>([^<]+)<\/title>/) ||
      html.match(/"title":"([^"]+)"/);
    const title = titleMatch ? titleMatch[1].replace(/\s*-\s*YouTube$/, '').trim() : 'Untitled';

    // Extract description from JSON-LD
    const descMatch = html.match(/"description":"([^"]{0,5000})"/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n') : '';

    // Extract channel name
    const channelMatch = html.match(/"channelName":"([^"]+)"/) ||
      html.match(/"ownerChannelName":"([^"]+)"/);
    const channelName = channelMatch ? channelMatch[1] : undefined;

    return {
      videoId,
      title,
      description,
      channelName
    };
  } catch (error) {
    console.error('[YouTube Scraping] Error extracting metadata:', error);
    return null;
  }
}

/**
 * Main function to extract YouTube metadata
 * Tries API first, falls back to scraping if API is not available
 */
export async function extractYouTubeMetadata(url: string): Promise<YouTubeMetadata | null> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    console.warn(`[YouTube] Invalid YouTube URL: ${url}`);
    return null;
  }

  // Try API first
  const apiResult = await extractWithAPI(videoId);
  if (apiResult) {
    return apiResult;
  }

  // Fallback to scraping
  console.log(`[YouTube] API not available, using scraping for video: ${videoId}`);
  return await extractWithScraping(videoId);
}

/**
 * Format YouTube metadata into a text prompt for AI
 * 
 * @param metadata - Extracted YouTube metadata
 * @param instructions - Original instructions for content generation
 * @returns Formatted prompt string ready for AI
 */
export function formatYouTubeMetadataForAI(metadata: YouTubeMetadata, instructions: string): string {
  let prompt = `${instructions}\n\n`;
  prompt += `=== THÔNG TIN VIDEO YOUTUBE ===\n`;
  prompt += `Tiêu đề: ${metadata.title}\n`;

  if (metadata.description) {
    // Truncate description if too long (keep first 1500 chars = ~500 tokens)
    // Reduced from 2000 to save tokens
    const description = metadata.description.length > 1500
      ? metadata.description.substring(0, 1500) + '...'
      : metadata.description;
    prompt += `\nMô tả video:\n${description}\n`;
  }

  if (metadata.transcript) {
    // Truncate transcript if too long (keep first 3000 chars = ~1000 tokens)
    // Reduced from 5000 to save tokens
    const transcript = metadata.transcript.length > 3000
      ? metadata.transcript.substring(0, 3000) + '...'
      : metadata.transcript;
    prompt += `\nTranscript (nội dung video):\n${transcript}\n`;
  }

  prompt += `\n=== YÊU CẦU ===\n`;
  prompt += `Dựa trên thông tin video YouTube ở trên, hãy phân tích và tạo bài đăng theo định dạng JSON yêu cầu.`;
  prompt += `\nHãy tập trung vào nội dung chính của video dựa trên tiêu đề, mô tả và transcript (nếu có).`;

  return prompt;
}

