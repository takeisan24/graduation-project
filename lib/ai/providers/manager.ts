/**
 * AI Provider Manager
 * Centralized management of different AI providers
 */

import { AIProvider, getProviderConfig, getModelConfig, isModelAvailable } from './index';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

export class AIProviderManager {
  private providers: Map<AIProvider, any> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   * Logs API key info (masked) for debugging
   */
  private initializeProviders() {
    // Initialize OpenAI
    const openaiConfig = getProviderConfig('openai');
    if (openaiConfig && openaiConfig.apiKey) {
      this.providers.set('openai', new OpenAIProvider(openaiConfig));
    } else {
      console.warn('[AIProviderManager] OpenAI provider not available (missing API key)');
    }

    // Initialize Gemini
    const geminiConfig = getProviderConfig('gemini');
    if (geminiConfig && geminiConfig.apiKey) {
      this.providers.set('gemini', new GeminiProvider(geminiConfig));
    } else {
      console.warn('[AIProviderManager] Gemini provider not available (missing API key)');
    }

  }

  /**
   * Mask API key for logging (show first 8 and last 4 characters)
   */
  private maskApiKey(key: string): string {
    if (!key || key.length < 12) return '***';
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  }

  /**
   * Reload providers (useful when environment variables change)
   * Note: This will recreate all provider instances with new configs
   */
  reloadProviders() {
    this.providers.clear();
    this.initializeProviders();
  }

  /**
   * Get provider instance
   */
  getProvider(provider: AIProvider): any {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not available or not configured`);
    }
    return providerInstance;
  }

  /**
   * Generate text content using specified model
   * 
   * @param fileIds - Optional file_ids for OpenAI (PDF files uploaded via Files API)
   */
  async generateText({
    modelId,
    messages,
    maxTokens = 10000,
    temperature = 0.7,
    systemPrompt,
    fileIds
  }: {
    modelId: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    fileIds?: string[]; // Optional file_ids for OpenAI Files API
  }): Promise<string> {
    const model = getModelConfig(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available (missing API key)`);
    }

    const provider = this.getProvider(model.provider);

    // Only pass fileIds to OpenAI provider (other providers don't support it)
    if (model.provider === 'openai' && fileIds && fileIds.length > 0) {
      return await provider.generateText({
        model: modelId,
        messages,
        maxTokens,
        temperature,
        systemPrompt,
        fileIds
      });
    }

    return await provider.generateText({
      model: modelId,
      messages,
      maxTokens,
      temperature,
      systemPrompt
    });
  }

  /**
   * Generate image using specified model
   * Supports: OpenAI DALL-E, Fal.ai, Gemini
   */
  async generateImage({
    modelId,
    prompt,
    ...options
  }: {
    modelId: string;
    prompt: string;
    [key: string]: any;
  }): Promise<{ url: string; jobId?: string; revisedPrompt?: string; images?: Array<{ base64: string; mimeType: string }> }> {
    const model = getModelConfig(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available (missing API key)`);
    }

    const provider = this.getProvider(model.provider);

    if (model.provider === 'openai') {
      const result = await provider.generateImage({ model: modelId, prompt, ...options });
      return { url: result.url, revisedPrompt: result.revisedPrompt };
    } else if (model.provider === 'gemini') {
      // Gemini returns { url, images } format
      const result = await provider.generateImage({
        model: modelId,
        prompt,
        n: options.n || 1,
        size: options.size || '1024x1024',
        aspectRatio: options.aspectRatio || '1:1',
        useSearch: options.useSearch || false,
        imageSize: options.imageSize || '1K'
      });
      return {
        url: result.url,
        images: result.images
      };
    } else {
      throw new Error(`Image generation not supported for provider ${model.provider}`);
    }
  }

  /**
   * Generate image with automatic retry using the SAME model + key rotation.
   *
   * Only gemini-3-pro-image-preview renders text in images well.
   * Other models (dall-e, gemini-2.5-flash-image) produce broken text.
   * So instead of switching models, we retry the same model with a different API key
   * (Gemini key rotator will pick a fresh key each attempt).
   *
   * MAX_RETRIES = 2 → up to 3 total attempts with different keys + backoff.
   */
  async generateImageWithFallback({
    modelId,
    prompt,
    onProviderSwitch,
    ...options
  }: {
    modelId: string;
    prompt: string;
    onProviderSwitch?: (fromModel: string, toModel: string) => void;
    [key: string]: any;
  }): Promise<{ url: string; jobId?: string; revisedPrompt?: string; images?: Array<{ base64: string; mimeType: string }>; usedModel: string }> {
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.generateImage({ modelId, prompt, ...options });
        return { ...result, usedModel: modelId };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const errorMsg = lastError.message;

        // Check if this is a provider-level error worth retrying
        const isRetryable =
          errorMsg.includes('quá tải') || errorMsg.includes('đang bận') ||
          errorMsg.includes('OVERLOADED') || errorMsg.includes('RATE_LIMITED') ||
          errorMsg.includes('failed to generate') || errorMsg.includes('timeout') ||
          errorMsg.includes('503') || errorMsg.includes('429') ||
          errorMsg.includes('UNAVAILABLE') || errorMsg.includes('không thể tạo ảnh');

        if (!isRetryable) {
          // Non-retryable error (invalid prompt, auth, etc.) — throw immediately
          throw err;
        }

        if (attempt < MAX_RETRIES) {
          const delay = 3000 * (attempt + 1); // 3s, 6s backoff
          console.warn(`[AIManager] Attempt ${attempt + 1} failed (${errorMsg.substring(0, 80)}), retrying in ${delay / 1000}s with rotated key...`);

          if (onProviderSwitch) {
            onProviderSwitch(modelId, modelId); // Same model, different key
          }

          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('Tạo ảnh thất bại sau nhiều lần thử. Vui lòng thử lại sau.');
  }

  /**
   * Generate video using specified model
   * Supports: Fal.ai, Gemini Veo
   */
  async generateVideo({
    modelId,
    prompt,
    ...options
  }: {
    modelId: string;
    prompt: string;
    [key: string]: any;
  }): Promise<{ url: string; jobId?: string; blob?: Blob }> {
    const model = getModelConfig(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available (missing API key)`);
    }

    const provider = this.getProvider(model.provider);

    if (model.provider === 'gemini') {
      // Gemini returns { url, blob } format (blob is the video file)
      const result = await provider.generateVideo({
        model: modelId,
        prompt,
        negativePrompt: options.negativePrompt,
        aspectRatio: options.aspectRatio || '16:9',
        resolution: options.resolution || '1080p',
        userId: options.userId
      });
      return {
        url: result.url,
        jobId: result.jobId,
        blob: result.blob
      };
    } else {
      throw new Error(`Video generation not supported for provider ${model.provider}`);
    }
  }

  /**
   * Extract content from various sources
   */
  async extractContent({
    modelId,
    sourceType,
    sourceContent,
    filePublicUrl,
    systemPrompt
  }: {
    modelId: string;
    sourceType: 'url' | 'file' | 'prompt';
    sourceContent?: string;
    filePublicUrl?: string;
    systemPrompt?: string;
  }): Promise<{ title: string; summary: string; raw: string }> {
    const model = getModelConfig(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available (missing API key)`);
    }

    const provider = this.getProvider(model.provider);
    return await provider.extractContent({
      model: modelId,
      sourceType,
      sourceContent,
      filePublicUrl,
      systemPrompt
    });
  }

  /**
   * Generate platform-specific content
   */
  async generatePlatformContent({
    modelId,
    platform,
    contentType,
    extracted,
    context = 'general'
  }: {
    modelId: string;
    platform: string;
    contentType: 'text' | 'image' | 'video';
    extracted: { title: string; summary: string };
    context?: string;
  }): Promise<string | { url: string; jobId?: string; revisedPrompt?: string; images?: Array<{ base64: string; mimeType: string }>; blob?: Blob }> {
    const model = getModelConfig(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available (missing API key)`);
    }

    const provider = this.getProvider(model.provider);

    if (contentType === 'text') {
      return await provider.generatePlatformContent({
        model: modelId,
        platform,
        contentType,
        extracted,
        context
      });
    } else if (contentType === 'image') {
      if (model.provider === 'gemini') {
        // Generate image prompt for platform
        const imagePrompt = this.generateImagePrompt(platform, extracted);
        const result = await provider.generateImage({
          model: modelId,
          prompt: imagePrompt,
          n: 1,
          aspectRatio: '1:1'
        });
        // Return first image URL or base64
        if (result.images && result.images.length > 0) {
          return { url: result.images[0].base64, images: result.images };
        }
        return { url: result.url };
      } else if (model.provider === 'openai') {
        const prompt = this.generateImagePrompt(platform, extracted);
        return await provider.generateImage({
          model: modelId,
          prompt
        });
      }
    } else if (contentType === 'video') {
      if (model.provider === 'gemini') {
        // Generate video prompt for platform
        const videoPrompt = this.generateVideoPrompt(platform, extracted);
        const result = await provider.generateVideo({
          model: modelId,
          prompt: videoPrompt,
          aspectRatio: '16:9',
          resolution: '1080p'
        });
        // Return blob URL or job ID
        if (result.blob) {
          // Would need to upload to storage first
          return { url: '', blob: result.blob };
        }
        return { url: result.url, jobId: result.jobId };
      }
    }

    throw new Error(`Content type ${contentType} not supported for provider ${model.provider}`);
  }

  /**
   * Generate image prompt for platform
   */
  private generateImagePrompt(platform: string, extracted: { title: string; summary: string }): string {
    const platformStyles = {
      instagram: "Instagram feed style, modern, high-quality, vibrant colors, square format",
      tiktok: "TikTok style, vertical format, bold text overlay, trendy, eye-catching",
      x: "X style, clean, minimal, professional, square format",
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
   */
  private generateVideoPrompt(platform: string, extracted: { title: string; summary: string }): string {
    const platformStyles = {
      instagram: "Instagram Reels style, vertical, engaging, trendy",
      tiktok: "TikTok style, vertical, viral-worthy, fast-paced",
      x: "X style, short, informative, clean",
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
   * Check job status for async operations
   */
  async getJobStatus(provider: AIProvider, _jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }> {
    throw new Error(`Job status checking not supported for provider ${provider}`);
  }

  /**
   * Get available models for a specific type and provider
   */
  getAvailableModels(type: 'text' | 'image' | 'video' | 'extraction', provider?: AIProvider): string[] {
    const models = Object.keys(getModelConfig('') || {});
    return models.filter(modelId => {
      const model = getModelConfig(modelId);
      if (!model) return false;
      if (provider && model.provider !== provider) return false;
      if (model.type !== type) return false;
      return isModelAvailable(modelId);
    });
  }
}

// Export singleton instance
export const aiManager = new AIProviderManager();
