/**
 * AI Content Generator v2
 * Refactored to use multiple AI providers (OpenAI, Gemini, Fal.ai)
 */

import { aiManager } from './providers/manager';
import { getModelsByType } from './providers/index';
import { getBestModel } from './config';
import { supabase } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export interface GeneratedContent {
  platform: string;
  text: string;
  media_urls: string[];
  media_type: 'text' | 'image' | 'video';
}

export interface ContentGenerationRequest {
  sourceType: 'url' | 'file' | 'prompt';
  sourceContent?: string;
  filePublicUrl?: string;
  userId: string;
  platforms?: string[];
  mediaTypes?: ('text' | 'image' | 'video')[];
  textModel?: string;
  imageModel?: string;
  videoModel?: string;
}

/**
 * Generate content for multiple platforms and media types
 */
export async function generateContentForPlatforms({
  sourceType,
  sourceContent,
  filePublicUrl,
  userId,
  platforms = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'threads', 'linkedin', 'pinterest'],
  mediaTypes = ['text', 'image'],
  textModel,
  imageModel,
  videoModel
}: ContentGenerationRequest): Promise<GeneratedContent[]> {


  // Get default models if not specified
  const defaultTextModel = textModel || getBestModel('text');
  const defaultImageModel = imageModel || getBestModel('image');
  const defaultVideoModel = videoModel || getBestModel('video');

  // Extract content first
  const extracted = await aiManager.extractContent({
    modelId: defaultTextModel,
    sourceType,
    sourceContent,
    filePublicUrl
  });

  // Generate content for each platform and media type combination (Parallelized)
  const tasks = platforms.flatMap(platform =>
    mediaTypes.map(async (mediaType) => {
      try {
        return await generateContentForPlatform({
          platform,
          mediaType,
          extracted,
          userId,
          textModel: defaultTextModel,
          imageModel: defaultImageModel,
          videoModel: defaultVideoModel
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
 */
async function generateContentForPlatform({
  platform,
  mediaType,
  extracted,
  userId,
  textModel,
  imageModel,
  videoModel
}: {
  platform: string;
  mediaType: 'text' | 'image' | 'video';
  extracted: { title: string; summary: string; raw: string };
  userId: string;
  textModel: string;
  imageModel: string;
  videoModel: string;
}): Promise<GeneratedContent> {

  // Generate platform-specific text
  const text = await aiManager.generatePlatformContent({
    modelId: textModel,
    platform,
    contentType: 'text',
    extracted
  }) as string;

  let media_urls: string[] = [];

  // Generate media if requested
  if (mediaType === 'image') {
    const imageResult = await aiManager.generatePlatformContent({
      modelId: imageModel,
      platform,
      contentType: 'image',
      extracted
    }) as { url: string; jobId?: string; revisedPrompt?: string };

    if (imageResult.url) {
      // Upload to Supabase Storage
      const uploadedUrl = await uploadToSupabase(imageResult.url, 'image', userId);
      media_urls = [uploadedUrl];
    } else if (imageResult.jobId) {
      // Handle async job - store job ID for webhook processing
      media_urls = [`fal_job:${imageResult.jobId}`];
    }
  } else if (mediaType === 'video') {
    const videoResult = await aiManager.generatePlatformContent({
      modelId: videoModel,
      platform,
      contentType: 'video',
      extracted
    }) as { url: string; jobId?: string };

    if (videoResult.url) {
      // Upload to Supabase Storage
      const uploadedUrl = await uploadToSupabase(videoResult.url, 'video', userId);
      media_urls = [uploadedUrl];
    } else if (videoResult.jobId) {
      // Handle async job - store job ID for webhook processing
      media_urls = [`fal_job:${videoResult.jobId}`];
    }
  }

  return {
    platform,
    text,
    media_urls,
    media_type: mediaType
  };
}

/**
 * Upload media to Supabase Storage
 */
async function uploadToSupabase(url: string, type: 'image' | 'video', userId: string): Promise<string> {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    const contentType = type === 'image' ? 'image/png' : 'video/mp4';
    const extension = type === 'image' ? 'png' : 'mp4';
    const key = `generated-${type}s/${userId}/${randomUUID()}.${extension}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(key, buffer, {
        contentType,
        upsert: true
      });

    if (error) throw error;

    // Supabase JS v2 returns { data: { publicUrl } }
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicData.publicUrl;
  } catch (error) {
    console.error(`Error uploading ${type} to Supabase:`, error);
    // Return original URL as fallback
    return url;
  }
}

/**
 * Generate platform-specific text content
 */
export async function generatePlatformText(
  platform: string,
  extracted: { title: string; summary: string },
  modelId?: string
): Promise<string> {
  const textModel = modelId || getBestModel('text');

  return await aiManager.generatePlatformContent({
    modelId: textModel,
    platform,
    contentType: 'text',
    extracted
  }) as string;
}

/**
 * Generate image using specified model
 */
export async function generateImage(
  prompt: string,
  modelId?: string
): Promise<string> {
  const imageModel = modelId || getBestModel('image');

  const result = await aiManager.generateImage({
    modelId: imageModel,
    prompt
  });

  if (result.jobId) {
    // Return job ID for async processing
    return JSON.stringify({
      job_id: result.jobId,
      status: 'processing',
      prompt: prompt
    });
  }

  return result.url;
}

/**
 * Generate video using specified model
 */
export async function generateVideo(
  prompt: string,
  modelId?: string
): Promise<string> {
  const videoModel = modelId || getBestModel('video');

  const result = await aiManager.generateVideo({
    modelId: videoModel,
    prompt
  });

  if (result.jobId) {
    // Return job ID for async processing
    return JSON.stringify({
      job_id: result.jobId,
      status: 'processing',
      prompt: prompt
    });
  }

  return result.url;
}

/**
 * Extract content from various sources
 */
export async function extractContent({
  sourceType,
  sourceContent,
  filePublicUrl,
  modelId
}: {
  sourceType: 'url' | 'file' | 'prompt';
  sourceContent?: string;
  filePublicUrl?: string;
  modelId?: string;
}): Promise<{ title: string; summary: string; raw: string }> {
  const extractionModel = modelId || getBestModel('extraction');

  return await aiManager.extractContent({
    modelId: extractionModel,
    sourceType,
    sourceContent,
    filePublicUrl
  });
}

/**
 * Get available models for a specific type
 */
export function getAvailableModels(type: 'text' | 'image' | 'video' | 'extraction'): string[] {
  return aiManager.getAvailableModels(type);
}

/**
 * Check if a model is available
 */
export function isModelAvailable(modelId: string): boolean {
  try {
    const models = getAvailableModels('text');
    return models.includes(modelId);
  } catch {
    return false;
  }
}
