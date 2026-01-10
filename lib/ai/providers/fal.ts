/**
 * Fal.ai Provider Implementation
 */

import { AIProviderConfig } from './index';
import { MEDIA_ERRORS } from '@/lib/messages/errors';

export class FalProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Generate image using Fal.ai
   */
  async generateImage({
    model = 'fal-sdxl',
    prompt,
    imageSize = '1024x1024',
    numInferenceSteps = 20,
    guidanceScale = 7.5
  }: {
    model?: string;
    prompt: string;
    imageSize?: string;
    numInferenceSteps?: number;
    guidanceScale?: number;
  }): Promise<{ url: string; jobId?: string }> {
    const MAX_RETRIES = 2;
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      const response = await fetch(`${this.config.baseUrl}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          image_size: imageSize,
          num_inference_steps: numInferenceSteps,
          guidance_scale: guidanceScale,
          enable_safety_checker: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        const isRetryable = response.status === 429 || response.status === 500 || response.status === 503;

        if (isRetryable && retry < MAX_RETRIES) {
          const delay = response.status === 429 ? 5000 * (retry + 1) : 8000 * (retry + 1);
          console.warn(`[Fal.ai] generateImage: Error ${response.status}, retrying (${retry + 1}/${MAX_RETRIES}) after ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (isRetryable) {
          throw new Error(response.status === 429 ? MEDIA_ERRORS.FAL_RATE_LIMITED : MEDIA_ERRORS.FAL_OVERLOADED);
        }
        throw new Error(`Fal.ai API error: ${response.status} ${error}`);
      }

      const data = await response.json();

      // Check if it's an async job
      if (data.request_id) {
        return {
          url: '', // Will be available after job completion
          jobId: data.request_id
        };
      }

      // Direct result
      return {
        url: data.images?.[0]?.url || data.image_url || '',
        jobId: data.request_id
      };
    }
    throw new Error(MEDIA_ERRORS.FAL_OVERLOADED);
  }

  /**
   * Generate video using Fal.ai
   */
  async generateVideo({
    model = 'fal-runway-gen3',
    prompt,
    duration = 5,
    aspectRatio = '16:9',
    seed
  }: {
    model?: string;
    prompt: string;
    duration?: number;
    aspectRatio?: string;
    seed?: number;
  }): Promise<{ url: string; jobId?: string }> {
    const MAX_RETRIES = 2;
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      const response = await fetch(`${this.config.baseUrl}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          duration,
          aspect_ratio: aspectRatio,
          seed: seed || Math.floor(Math.random() * 1000000)
        })
      });

      if (!response.ok) {
        const error = await response.text();
        const isRetryable = response.status === 429 || response.status === 500 || response.status === 503;

        if (isRetryable && retry < MAX_RETRIES) {
          const delay = response.status === 429 ? 5000 * (retry + 1) : 8000 * (retry + 1);
          console.warn(`[Fal.ai] generateVideo: Error ${response.status}, retrying (${retry + 1}/${MAX_RETRIES}) after ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (isRetryable) {
          throw new Error(response.status === 429 ? MEDIA_ERRORS.FAL_RATE_LIMITED : MEDIA_ERRORS.FAL_OVERLOADED);
        }
        throw new Error(`Fal.ai Video API error: ${response.status} ${error}`);
      }

      const data = await response.json();

      // Check if it's an async job
      if (data.request_id) {
        return {
          url: '', // Will be available after job completion
          jobId: data.request_id
        };
      }

      // Direct result
      return {
        url: data.video?.url || data.video_url || '',
        jobId: data.request_id
      };
    }
    throw new Error(MEDIA_ERRORS.FAL_OVERLOADED);
  }

  /**
   * Check job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }> {
    const response = await fetch(`${this.config.baseUrl}/fal-queue/${jobId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fal.ai Status API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    return {
      status: data.status,
      result: data.result,
      error: data.error
    };
  }

  /**
   * Generate platform-specific image
   */
  async generatePlatformImage({
    platform,
    extracted,
    model = 'fal-sdxl'
  }: {
    platform: string;
    extracted: { title: string; summary: string };
    model?: string;
  }): Promise<{ url: string; jobId?: string }> {
    const platformStyles = {
      instagram: "Instagram feed style, modern, high-quality, vibrant colors, square format",
      tiktok: "TikTok style, vertical format, bold text overlay, trendy, eye-catching",
      x: "Twitter/X style, clean, minimal, professional, square format",
      linkedin: "LinkedIn style, professional, business-focused, clean design",
      facebook: "Facebook style, engaging, colorful, social media optimized",
      threads: "Threads style, modern, clean, Instagram-inspired but more personal",
      bluesky: "Bluesky style, thoughtful, community-focused, clean and modern",
      youtube: "YouTube thumbnail style, bold text, high contrast, click-worthy, 16:9 aspect ratio",
      pinterest: "Pinterest style, vertical format, inspiring, lifestyle-focused, high-quality"
    };

    const style = platformStyles[platform as keyof typeof platformStyles] || "social media style";
    const prompt = `Create a ${style} image for social media. Title: ${extracted.title}. Summary: ${extracted.summary}. Make it visually appealing and on-brand.`;

    return await this.generateImage({
      model,
      prompt,
      imageSize: platform === 'youtube' ? '1792x1024' : '1024x1024'
    });
  }

  /**
   * Generate platform-specific video
   */
  async generatePlatformVideo({
    platform,
    extracted,
    model = 'fal-runway-gen3'
  }: {
    platform: string;
    extracted: { title: string; summary: string };
    model?: string;
  }): Promise<{ url: string; jobId?: string }> {
    const platformStyles = {
      instagram: "Instagram Reels style, vertical, engaging, trendy",
      tiktok: "TikTok style, vertical, viral-worthy, fast-paced",
      x: "Twitter/X style, short, informative, clean",
      linkedin: "LinkedIn style, professional, educational",
      facebook: "Facebook style, engaging, shareable, community-focused",
      threads: "Threads style, vertical, conversational, Instagram-inspired",
      bluesky: "Bluesky style, thoughtful, community-focused, clean",
      youtube: "YouTube Shorts style, vertical, engaging, high-quality",
      pinterest: "Pinterest style, vertical, inspiring, lifestyle-focused"
    };

    const style = platformStyles[platform as keyof typeof platformStyles] || "social media style";
    const prompt = `Create a ${style} video for social media. Title: ${extracted.title}. Summary: ${extracted.summary}. Make it engaging and platform-appropriate.`;

    return await this.generateVideo({
      model,
      prompt,
      aspectRatio: platform === 'youtube' ? '9:16' : '16:9',
      duration: platform === 'tiktok' ? 3 : 5
    });
  }
}
