import { extractContent, generateImage, generateVideo, generatePlatformText } from "./generator-v2";
import { askAssistant } from "./assistant-v2";

/**
 * Content generation request interface
 */
export interface ContentGenerationRequest {
  sourceType: 'url' | 'file' | 'prompt';
  sourceContent: string;
  filePublicUrl?: string;
  platforms: string[];
  mediaTypes: ('text' | 'image' | 'video')[];
  userId: string;
}

/**
 * Generated content interface
 */
export interface GeneratedContent {
  platform: string;
  text: string;
  media_urls: string[];
  media_type: 'text' | 'image' | 'video';
}

/**
 * Generate content for multiple platforms and media types
 * 
 * This is the main service function that orchestrates content generation
 * across multiple platforms and media types from a single source input.
 */
export async function generateContentForPlatforms(request: ContentGenerationRequest): Promise<GeneratedContent[]> {
  const { sourceType, sourceContent, filePublicUrl, platforms, mediaTypes } = request;

  // Step 1: Extract content from source
  const extracted = await extractContent({
    sourceType,
    sourceContent,
    filePublicUrl
  });

  // Step 2: Generate content for each platform and media type combination (Parallelized)
  const tasks = platforms.flatMap(platform =>
    mediaTypes.map(async (mediaType) => {
      try {
        return await generateContentForPlatform({
          platform,
          mediaType,
          extracted
        });
      } catch (error) {
        console.error(`Error generating ${mediaType} content for ${platform}:`, error);
        return null;
      }
    })
  );

  const rawResults = await Promise.all(tasks);

  // Filter out null results (failed generations)
  const results = rawResults.filter((item): item is GeneratedContent => item !== null);

  return results;
}

/**
 * Generate content for a specific platform and media type
 * 
 * Internal helper function that generates content for a single platform/media type combination.
 */
async function generateContentForPlatform({
  platform,
  mediaType,
  extracted
}: {
  platform: string;
  mediaType: 'text' | 'image' | 'video';
  extracted: { title: string; summary: string; raw: string };
}): Promise<GeneratedContent> {

  // Generate platform-specific text
  const text = await generatePlatformText(platform, extracted);

  let media_urls: string[] = [];

  // Generate media if requested
  if (mediaType === 'image') {
    const imagePrompt = generateImagePrompt(platform, extracted);
    const imageUrl = await generateImage(imagePrompt);
    media_urls = [imageUrl];
  } else if (mediaType === 'video') {
    const videoPrompt = generateVideoPrompt(platform, extracted);
    const videoUrl = await generateVideo(videoPrompt);
    media_urls = [videoUrl];
  }

  return {
    platform,
    text,
    media_urls,
    media_type: mediaType
  };
}

/**
 * Generate image prompt for platform
 * 
 * Creates platform-specific image generation prompts based on platform style requirements.
 */
function generateImagePrompt(platform: string, extracted: { title: string; summary: string }): string {
  const platformStyles = {
    instagram: "Instagram feed style, modern, high-quality, vibrant colors, square format",
    tiktok: "TikTok style, vertical format, bold text overlay, trendy, eye-catching",
    x: "Twitter/X style, clean, minimal, professional, square format",
    linkedin: "LinkedIn style, professional, business-focused, clean design",
    facebook: "Facebook style, engaging, colorful, social media optimized",
    threads: "Threads style, modern, clean, Instagram-inspired but more personal",
    youtube: "YouTube thumbnail style, bold text, high contrast, click-worthy, 16:9 aspect ratio",
    pinterest: "Pinterest style, vertical format, inspiring, lifestyle-focused, high-quality"
  };

  const style = platformStyles[platform as keyof typeof platformStyles] || "social media style";

  return `Create a ${style} image for social media. Title: ${extracted.title}. Summary: ${extracted.summary}. Make it visually appealing and on-brand.`;
}

/**
 * Generate video prompt for platform
 * 
 * Creates platform-specific video generation prompts based on platform style requirements.
 */
function generateVideoPrompt(platform: string, extracted: { title: string; summary: string }): string {
  const platformStyles = {
    instagram: "Instagram Reels style, vertical, engaging, trendy",
    tiktok: "TikTok style, vertical, viral-worthy, fast-paced",
    x: "Twitter/X style, short, informative, clean",
    linkedin: "LinkedIn style, professional, educational",
    facebook: "Facebook style, engaging, shareable, community-focused",
    threads: "Threads style, vertical, conversational, Instagram-inspired",
    youtube: "YouTube Shorts style, vertical, engaging, high-quality",
    pinterest: "Pinterest style, vertical, inspiring, lifestyle-focused"
  };

  const style = platformStyles[platform as keyof typeof platformStyles] || "social media style";

  return `Create a ${style} video for social media. Title: ${extracted.title}. Summary: ${extracted.summary}. Make it engaging and platform-appropriate.`;
}

/**
 * AI Assistant for content refinement
 * 
 * Allows users to refine content using AI assistant with conversation history.
 */
export async function refineContentWithAI({
  content,
  instruction,
  history = []
}: {
  content: string;
  instruction: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<string> {
  const response = await askAssistant({
    draftText: content,
    history,
    newMessage: instruction
  });

  return response.reply;
}

/**
 * Batch generate content for all supported platforms
 * 
 * Convenience function that generates content (text, image, video) for all supported platforms.
 * This is the main entry point for full content generation workflows.
 */
export async function generateAllPlatformContent(
  request: Omit<ContentGenerationRequest, 'platforms' | 'mediaTypes'>
): Promise<GeneratedContent[]> {
  const platforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'threads', 'linkedin', 'pinterest'];
  const mediaTypes: ('text' | 'image' | 'video')[] = ['text', 'image', 'video'];

  return generateContentForPlatforms({
    ...request,
    platforms,
    mediaTypes
  });
}

/**
 * Generate only text content for all platforms
 * 
 * Convenience function for text-only content generation across all platforms.
 */
export async function generateTextOnlyContent(
  request: Omit<ContentGenerationRequest, 'platforms' | 'mediaTypes'>
): Promise<GeneratedContent[]> {
  const platforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'threads', 'linkedin', 'pinterest'];
  const mediaTypes: ('text' | 'image' | 'video')[] = ['text'];

  return generateContentForPlatforms({
    ...request,
    platforms,
    mediaTypes
  });
}

/**
 * Generate only image content for all platforms
 * 
 * Convenience function for image content generation (includes text captions) across all platforms.
 */
export async function generateImageOnlyContent(
  request: Omit<ContentGenerationRequest, 'platforms' | 'mediaTypes'>
): Promise<GeneratedContent[]> {
  const platforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'threads', 'linkedin', 'pinterest'];
  const mediaTypes: ('text' | 'image' | 'video')[] = ['text', 'image'];

  return generateContentForPlatforms({
    ...request,
    platforms,
    mediaTypes
  });
}

/**
 * Generate only video content for all platforms
 * 
 * Convenience function for video content generation (includes text captions) across all platforms.
 */
export async function generateVideoOnlyContent(
  request: Omit<ContentGenerationRequest, 'platforms' | 'mediaTypes'>
): Promise<GeneratedContent[]> {
  const platforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'threads', 'linkedin', 'pinterest'];
  const mediaTypes: ('text' | 'image' | 'video')[] = ['text', 'video'];

  return generateContentForPlatforms({
    ...request,
    platforms,
    mediaTypes
  });
}

/**
 * Re-export generatePlatformText for convenience
 * This allows direct access to the platform text generator without going through generator-v2
 */
export { generatePlatformText } from "./generator-v2";
