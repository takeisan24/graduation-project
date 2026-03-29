/**
 * Google Gemini Provider Implementation
 * Consolidates all Gemini service logic from geminiService.ts
 */

import { AIProviderConfig, MODEL_IDS } from './index';
import { MEDIA_ERRORS } from '@/lib/messages/errors';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Part } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

export class GeminiProvider {
  private config: AIProviderConfig;
  private genAI: GoogleGenerativeAI;
  private genAI_Advanced: GoogleGenAI;
  private fileManager: GoogleAIFileManager;

  constructor(config: AIProviderConfig) {
    this.config = config;
    // Initialize Google Generative AI clients (default key for text tasks)
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.genAI_Advanced = new GoogleGenAI({ apiKey: config.apiKey });
    this.fileManager = new GoogleAIFileManager(config.apiKey);
  }

  /**
   * Create a temporary GoogleGenAI (Advanced) client with a rotated media key
   */
  private getMediaGenAIAdvanced(): { client: GoogleGenAI; apiKey: string } {
    const apiKey = process.env.GEMINI_API_KEY || '';
    return { client: new GoogleGenAI({ apiKey }), apiKey };
  }

  /**
   * Get chat response with history support
   * Equivalent to getChatResponse from geminiService.ts
   */
  async getChatResponse({
    model,
    history,
    newMessage
  }: {
    model: string;
    history: any[];
    newMessage: string;
  }): Promise<string> {
    const MAX_RETRIES = 2;
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      try {
        const modelInstance = this.genAI.getGenerativeModel({ model });
        const generationConfig = {
          temperature: 0.7,
          maxOutputTokens: 10000,
        };
        const safetySettings = this.getSafetySettings();

        const chat = modelInstance.startChat({
          history,
          generationConfig,
          safetySettings
        });
        const result = await chat.sendMessage(newMessage);
        return result.response.text();
      } catch (error: any) {
        const status = error?.status || error?.httpStatusCode;
        const msg = error?.message || '';
        const isRetryable = status === 429 || status === 500 || status === 503
          || msg.includes('429') || msg.includes('500') || msg.includes('503')
          || msg.includes('UNAVAILABLE') || msg.includes('INTERNAL') || msg.includes('RESOURCE_EXHAUSTED');

        if (isRetryable && retry < MAX_RETRIES) {
          const delay = status === 429 ? 3000 * (retry + 1) : 8000 * (retry + 1);
          console.warn(`[Gemini] getChatResponse: Error ${status || msg.substring(0, 50)}, retrying (${retry + 1}/${MAX_RETRIES}) after ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        console.error("Gemini Provider Error (getChatResponse):", error);
        if (isRetryable) {
          throw new Error(status === 429 ? MEDIA_ERRORS.MODEL_RATE_LIMITED : MEDIA_ERRORS.MODEL_OVERLOADED);
        }
        throw new Error("Failed to get response from Gemini.");
      }
    }
    throw new Error("Failed to get response from Gemini.");
  }

  /**
   * Generate content from promptParts (multimodal support)
   * Equivalent to generateContent from geminiService.ts
   */
  async generateContentFromParts({
    model,
    promptParts,
    systemInstruction,
    generationConfig
  }: {
    model: string;
    promptParts: (string | Part)[] | string;
    systemInstruction?: string;
    generationConfig?: {
      maxOutputTokens?: number;
      temperature?: number;
      topP?: number;
      topK?: number;
    }
  }): Promise<string> {
    try {
      const modelInstance = this.genAI.getGenerativeModel({
        model,
        systemInstruction
      });

      const config = {
        maxOutputTokens: generationConfig?.maxOutputTokens || 10000,
        temperature: generationConfig?.temperature || 0.7,
        topP: generationConfig?.topP,
        topK: generationConfig?.topK,
      };

      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE
        }
      ];

      const result = await modelInstance.generateContent({
        contents: Array.isArray(promptParts)
          ? [{ role: 'user', parts: promptParts.map(p => typeof p === 'string' ? { text: p } : p) }]
          : [{ role: 'user', parts: [{ text: promptParts }] }],
        generationConfig: config,
        safetySettings
      });
      return result.response.text();
    } catch (error: any) {
      const status = error?.status || error?.httpStatusCode;
      const msg = error?.message || '';
      const isRetryable = status === 429 || status === 500 || status === 503
        || msg.includes('429') || msg.includes('500') || msg.includes('503')
        || msg.includes('UNAVAILABLE') || msg.includes('INTERNAL') || msg.includes('RESOURCE_EXHAUSTED');

      console.error(`Gemini Provider Error (generateContentFromParts with ${model}):`, error);
      if (isRetryable) {
        throw new Error(status === 429 ? MEDIA_ERRORS.MODEL_RATE_LIMITED : MEDIA_ERRORS.MODEL_OVERLOADED);
      }
      throw new Error(`Failed to generate content from ${model}.`);
    }
  }

  /**
   * Generate images using Gemini image generation model via REST API
   * Uses key rotation for rate-limit avoidance.
   */
  private async generateWithSDK(
    model: string,
    prompt: string,
    n: number,
    aspectRatio: string,
    useSearch: boolean = false,
    imageSize: "1K" | "2K" | "4K" = "1K"
  ) {
    // Import prompt helper
    const { getImagePrompt } = await import("@/lib/prompts");
    const imagePrompt = getImagePrompt(prompt, undefined, 1, aspectRatio);

    // NO RETRY at SDK level — retry is handled by Manager layer (generateImageWithFallback).
    // This avoids triple-retry explosion (frontend × manager × SDK).
    // Each image request: 1 attempt, fail fast, let Manager decide to retry with a different key.
    const promises = Array(n).fill(null).map(async (_, index) => {
      // Get a rotated API key for this request
      const mediaApiKey = (process.env.GEMINI_API_KEY || '');

      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${mediaApiKey}`;

        const payload: any = {
          contents: [{
            parts: [{ text: imagePrompt }]
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio: aspectRatio || "1:1",
              imageSize: imageSize || "1K"
            }
          }
        };

        if (useSearch) {
          payload.tools = [{ google_search: {} }];
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(55000) // 55s — stay under Vercel's 60s limit
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Gemini] Request ${index + 1}/${n} API error (${response.status}):`, errorText);

          if (response.status === 429) {
            // Key rate-limited (single key mode, no rotation available)
            throw new Error(MEDIA_ERRORS.MODEL_RATE_LIMITED);
          }
          if (response.status === 500 || response.status === 503) {
            throw new Error(MEDIA_ERRORS.MODEL_OVERLOADED);
          }

          let userMessage = `Gemini API Error (${response.status})`;
          try {
            const parsed = JSON.parse(errorText);
            if (parsed?.error?.message) userMessage = parsed.error.message;
          } catch { /* use default */ }
          throw new Error(userMessage);
        }

        const data = await response.json();
        return { candidates: data.candidates };

      } catch (e: any) {
        // Propagate user-friendly errors directly
        if (e.message === MEDIA_ERRORS.MODEL_OVERLOADED || e.message === MEDIA_ERRORS.MODEL_RATE_LIMITED) {
          throw e;
        }
        // Timeout → throw clear overloaded error
        if (e.name === 'TimeoutError' || e.name === 'AbortError') {
          throw new Error(MEDIA_ERRORS.MODEL_OVERLOADED);
        }
        console.error(`[Gemini] Request ${index + 1}/${n} failed:`, e.message);
        throw e;
      }
    });

    const responses = await Promise.all(promises);
    const successfulResponses = responses.filter(r => r !== null);

    if (successfulResponses.length === 0) {
      throw new Error(`Model ${model} failed to generate any images.`);
    }

    const allImages: Array<{ base64: string; mimeType: string }> = [];
    successfulResponses.forEach((response: any) => {
      if (response?.candidates) {
        response.candidates.forEach((candidate: any) => {
          const parts = candidate.content?.parts;
          if (parts) {
            parts.forEach((part: any) => {
              if (part.inlineData) {
                allImages.push({
                  base64: part.inlineData.data,
                  mimeType: part.inlineData.mimeType,
                });
              }
            });
          }
        });
      }
    });

    if (allImages.length === 0) {
      throw new Error(`Model ${model} returned response but no image data found.`);
    }

    return { url: '', images: allImages };
  }

  /**
   * Helper: Gọi qua REST API (Dành cho Imagen Models)
   */
  private async generateWithRestAPI(model: string, prompt: string, n: number, aspectRatio: string) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

    // Use rotated key for media generation
    const mediaApiKey = (process.env.GEMINI_API_KEY || '');

    // Map Aspect Ratio cho Imagen
    let googleAspectRatio = aspectRatio;
    if (aspectRatio === '1024x1024') googleAspectRatio = '1:1';
    if (aspectRatio === '4:5') googleAspectRatio = '3:4';

    const payload = {
      instances: [{ prompt: prompt }],
      parameters: {
        sampleCount: n,
        aspectRatio: googleAspectRatio || "1:1"
      }
    };

    const response = await fetch(`${apiUrl}?key=${mediaApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini REST] API error (${response.status}):`, errorText);
      if (response.status === 429) {
        console.warn(`[Gemini REST] Rate limited (429). Single key mode, no rotation available.`);
      }
      throw new Error(`Imagen API Error (${response.status})`);
    }

    const data = await response.json();

    // Handle multiple predictions
    const predictions = data.predictions || [];
    if (!predictions.length) throw new Error("API thành công nhưng không có dữ liệu ảnh.");

    const images = predictions.map((p: any) => ({
      base64: p.bytesBase64Encoded || p.output,
      mimeType: 'image/png'
    }));

    return {
      url: '',
      images: images
    };
  }

  /**
   * Main function: Generate Image
   * Uses key rotation for all image generation requests.
   */
  async generateImage({
    model = "gemini-3-pro-image-preview",
    prompt,
    n = 1,
    size = "1024x1024",
    aspectRatio = "1:1",
    useSearch = false,
    imageSize = "1K"
  }: {
    model?: string;
    prompt: string;
    n?: number;
    size?: string;
    aspectRatio?: string;
    useSearch?: boolean;
    imageSize?: "1K" | "2K" | "4K";
  }): Promise<{ url: string; images?: Array<{ base64: string; mimeType: string }> }> {
    try {
      // Imagen models -> REST API (:predict endpoint)
      if (model.toLowerCase().includes('imagen') || model.toLowerCase().includes('image-generation')) {
        return await this.generateWithRestAPI(model, prompt, n, aspectRatio);
      } else {
        // Gemini models (3.1 Flash, etc.) -> REST API (:generateContent endpoint)
        return await this.generateWithSDK(model, prompt, n, aspectRatio, useSearch, imageSize);
      }
    } catch (error: any) {
      console.error(`[Gemini] Error generating with ${model}:`, error.message);

      // Không fallback sang model khác - throw lỗi rõ ràng để user biết chính xác nguyên nhân
      if (model === MODEL_IDS.GEMINI_3_PRO_IMAGE) {
        throw new Error(MEDIA_ERRORS.GEMINI_3_PRO_FAILED);
      }

      throw error;
    }
  }

  /**
   * Generate videos using Gemini Veo model
   * Equivalent to generateVideos from geminiService.ts
   */
  async generateVideo({
    model = "veo-3.0-fast-generate-001",
    prompt,
    negativePrompt,
    aspectRatio,
    resolution,
    userId
  }: {
    model?: string;
    prompt: string;
    negativePrompt?: string;
    aspectRatio: string;
    resolution: string;
    userId?: string;
  }): Promise<{ url: string; jobId?: string; blob?: Blob }> {
    const maxAttempts = 5; // Reduced from 3 to allow fallback across attempts if needed, but the main timeout is inside the poll loop
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Use rotated key for each video generation attempt
      const { client: mediaGenAI, apiKey: mediaApiKey } = this.getMediaGenAIAdvanced();

      try {
        // Start video generation operation
        let operation = await mediaGenAI.models.generateVideos({
          model,
          source: { prompt },
          config: {
            numberOfVideos: 1,
            aspectRatio,
            resolution,
            negativePrompt,
          }
        });

        // Save operation ID to DB for tracking
        if (userId && operation.name) {
          try {
            const { supabase } = await import('@/lib/supabase');
            await supabase.from('jobs').insert({
              job_type: 'video_generation',
              status: 'processing',
              payload: {
                user_id: userId,
                operation_name: operation.name,
                prompt,
                aspectRatio,
                resolution
              }
            });
          } catch (dbError) {
            console.warn("Failed to track video generation operation:", dbError);
          }
        }

        // Poll for completion
        let pollCount = 0;
        while (!operation.done) {
          await new Promise((resolve) => setTimeout(resolve, 20000)); // Increased from 10s to 20s
          pollCount++;
          operation = await mediaGenAI.operations.getVideosOperation({ operation });

          // Check for errors during polling
          if ((operation as any).error) {
            const errorDetails = (operation as any).error;
            console.error(`[Gemini] Operation error during polling:`, errorDetails);
            throw new Error(`Video generation failed: ${errorDetails.message || JSON.stringify(errorDetails)}`);
          }

          if (pollCount >= 90) { // 90 polls * 20s = 1800s = 30 minutes
            throw new Error("Video generation timed out after 30 minutes.");
          }
        }

        // Safety filter response without video
        const filteredCount = (operation as any)?.response?.raiMediaFilteredCount || 0;
        const filteredReasons = (operation as any)?.response?.raiMediaFilteredReasons || [];
        if (filteredCount > 0 || (Array.isArray(filteredReasons) && filteredReasons.length > 0)) {
          const reasonText = Array.isArray(filteredReasons) ? filteredReasons.join(' | ') : 'Content blocked by safety filters';
          throw new Error(`SAFETY_FILTER: ${reasonText || 'Content blocked by safety filters. You have not been charged.'}`);
        }

        // Check for errors after operation completes
        if ((operation as any).error) {
          const errorDetails = (operation as any).error;
          console.error(`[Gemini] Operation completed with error:`, errorDetails);
          throw new Error(`Video generation failed: ${errorDetails.message || JSON.stringify(errorDetails)}`);
        }

        if (!operation.response?.generatedVideos?.[0]?.video) {
          // Log full operation for debugging
          console.error(`[Gemini] Operation completed but no video found. Full operation:`, JSON.stringify(operation, null, 2));
          throw new Error("SAFETY_FILTER: Provider did not return video (possible safety block). You have not been charged. Please modify prompt and try again.");
        }

        const videoFile = operation.response.generatedVideos[0].video;
        const videoUri = (videoFile as any).uri || (videoFile as any).fileUri;
        if (!videoUri) {
          throw new Error("Could not find video URI in the response.");
        }

        // Add API key to video download URL if needed (use same rotated key)
        let fetchUrl = videoUri;
        if (mediaApiKey) {
          try {
            const urlObj = new URL(videoUri);
            if (urlObj.hostname.includes('generativelanguage.googleapis.com') ||
              urlObj.hostname.includes('googleapis.com') ||
              urlObj.hostname.includes('storage.googleapis.com')) {
              urlObj.searchParams.set('key', mediaApiKey);
              fetchUrl = urlObj.toString();
            }
          } catch (urlError) {
            console.warn("Could not modify URL, using original:", urlError);
          }
        } else {
          console.warn("API key not available for video download");
        }

        // Fetch video with retry mechanism
        // Retry up to 3 times with exponential backoff if video download fails
        let videoBlob: Blob | null = null;
        const maxRetries = 3;
        let downloadError: Error | null = null;

        for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
          try {
            if (retryAttempt > 0) {
              // Exponential backoff: 2s, 4s, 8s
              const delayMs = Math.pow(2, retryAttempt) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }

            const response = await fetch(fetchUrl, {
              headers: {
                'Accept': 'video/*',
              },
              // Add timeout to prevent hanging
              signal: AbortSignal.timeout(60000) // 60 seconds timeout
            });

            if (!response.ok) {
              // For 404/403, retry might help if video is still processing
              if (response.status === 404 || response.status === 403) {
                if (retryAttempt < maxRetries) {
                  console.warn(`[Gemini] Video download returned ${response.status}, retrying...`);
                  downloadError = new Error(`Video not available yet (${response.status} ${response.statusText})`);
                  continue;
                }
              }

              let errorDetails = '';
              try {
                const errorText = await response.clone().text();
                errorDetails = errorText.substring(0, 200);
              } catch {
                // Ignore error reading error response
              }
              throw new Error(`Failed to download video file: ${response.status} ${response.statusText}${errorDetails ? '. ' + errorDetails : ''}`);
            }

            videoBlob = await response.blob();

            // Verify blob is valid video
            if (!videoBlob || videoBlob.size === 0) {
              throw new Error("Downloaded video blob is empty");
            }

            // Check if blob is actually a video
            if (!videoBlob.type.startsWith('video/') && !videoBlob.type.startsWith('application/octet-stream')) {
              console.warn(`[Gemini] Downloaded blob has unexpected type: ${videoBlob.type}`);
              // Still accept it, might be valid video with wrong content-type
            }

            break; // Success, exit retry loop

          } catch (fetchError: any) {
            downloadError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
            console.error(`[Gemini] Video download attempt ${retryAttempt + 1} failed:`, downloadError.message);

            // If timeout or network error, retry
            if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError' || fetchError.message.includes('fetch')) {
              if (retryAttempt < maxRetries) {
                continue; // Retry
              }
            }

            // For other errors, only retry if it's a 404/403 (video might still be processing)
            if (retryAttempt >= maxRetries) {
              throw downloadError;
            }
          }
        }

        if (!videoBlob) {
          throw downloadError || new Error("Failed to download video after all retry attempts");
        }

        // Return blob for direct use, or could upload to storage and return URL
        return {
          url: '', // Empty URL, use blob instead
          blob: videoBlob
        };

      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isSafety = typeof errorMessage === 'string' && errorMessage.startsWith('SAFETY_FILTER:');
        lastError = error instanceof Error ? error : new Error(errorMessage);

        // Detect Google API server errors (429/500/503)
        const status = error?.status || error?.httpStatusCode;
        const isOverloaded = status === 500 || status === 503
          || errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE')
          || errorMessage.includes('500') || errorMessage.includes('INTERNAL')
          || errorMessage.includes('high demand');
        const isRateLimited = status === 429
          || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');

        if ((isOverloaded || isRateLimited) && attempt < maxAttempts) {
          const delay = isRateLimited ? 3000 * attempt : 8000 * attempt;
          console.warn(`[Gemini] Video: Server error (${status || errorMessage.substring(0, 50)}), retrying (${attempt}/${maxAttempts}) after ${delay / 1000}s...`);
          if (isRateLimited) // Key rate-limited (single key mode, no rotation available)
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (isOverloaded) throw new Error(MEDIA_ERRORS.MODEL_OVERLOADED);
        if (isRateLimited) throw new Error(MEDIA_ERRORS.MODEL_RATE_LIMITED);

        // Retry on safety filter up to maxAttempts
        if (isSafety && attempt < maxAttempts) {
          console.warn(`[Gemini] Safety filter triggered (attempt ${attempt}/${maxAttempts}), retrying with same prompt...`);
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          continue;
        }

        console.error("Gemini Provider Error (generateVideo):", error);
        throw new Error(`Failed to generate video from Gemini: ${errorMessage}`);
      }
    }

    // If loop exits without return, throw last error
    throw lastError || new Error("Failed to generate video from Gemini after retries");
  }

  /**
   * Get safety settings for Gemini API
   */
  private getSafetySettings() {
    return [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];
  }

  /**
   * Generate text using Gemini API
   */
  async generateText({
    model,
    messages,
    maxTokens = 10000,
    temperature = 0.7,
    systemPrompt
  }: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  }): Promise<string> {
    const contents = this.convertMessagesToGeminiFormat(messages, systemPrompt);
    const MAX_RETRIES = 2;

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      const response = await fetch(`${this.config.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
            topP: 0.8,
            topK: 40
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE'
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isRetryable = response.status === 429 || response.status === 500 || response.status === 503;

        if (isRetryable && retry < MAX_RETRIES) {
          const delay = response.status === 429 ? 3000 * (retry + 1) : 8000 * (retry + 1);
          console.warn(`[Gemini] generateText: Error ${response.status}, retrying (${retry + 1}/${MAX_RETRIES}) after ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (isRetryable) {
          throw new Error(response.status === 429 ? MEDIA_ERRORS.MODEL_RATE_LIMITED : MEDIA_ERRORS.MODEL_OVERLOADED);
        }
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.candidates[0]?.content?.parts[0]?.text || '';
    }

    throw new Error(MEDIA_ERRORS.MODEL_OVERLOADED);
  }

  /**
   * Extract content from various sources using Gemini
   */
  async extractContent({
    model,
    sourceType,
    sourceContent,
    filePublicUrl,
    systemPrompt
  }: {
    model: string;
    sourceType: 'url' | 'file' | 'prompt';
    sourceContent?: string;
    filePublicUrl?: string;
    systemPrompt?: string;
  }): Promise<{ title: string; summary: string; raw: string }> {
    // Use centralized prompts from lib/prompts
    const { getExtractionPrompt } = await import("@/lib/prompts");

    let userPrompt = '';
    if (sourceType === 'prompt') {
      userPrompt = getExtractionPrompt('prompt', sourceContent || '');
    } else if (sourceType === 'url') {
      userPrompt = getExtractionPrompt('url', sourceContent || '');
    } else {
      userPrompt = getExtractionPrompt('file', filePublicUrl || '');
    }

    const defaultSystemPrompt = systemPrompt || `You are a content extraction assistant. Extract the title and create a concise summary. Return the response in JSON format with keys: title, summary.`;

    const response = await this.generateText({
      model,
      messages: [{ role: 'user', content: userPrompt }],
      systemPrompt: defaultSystemPrompt,
      maxTokens: 10000,
      temperature: 0.7
    });

    // Parse JSON response
    try {
      const parsed = JSON.parse(response);
      return {
        title: parsed.title || 'Untitled',
        summary: parsed.summary || response,
        raw: response
      };
    } catch {
      // Fallback parsing
      const lines = response.split('\n').map(l => l.trim()).filter(Boolean);
      return {
        title: lines[0] || 'Untitled',
        summary: lines.slice(1).join(' ') || response,
        raw: response
      };
    }
  }

  /**
   * Generate platform-specific content using Gemini
   */
  async generatePlatformContent({
    model,
    platform,
    contentType,
    extracted,
    context = 'general'
  }: {
    model: string;
    platform: string;
    contentType: 'text' | 'image' | 'video';
    extracted: { title: string; summary: string };
    context?: string;
  }): Promise<string> {
    const platformPrompts = {
      instagram: `Create an engaging Instagram caption for this content. Use emojis, hashtags, and make it visually appealing. Title: ${extracted.title}. Summary: ${extracted.summary}`,
      tiktok: `Create a catchy TikTok caption that's short and viral-worthy. Title: ${extracted.title}. Summary: ${extracted.summary}`,
      x: `Create a concise X (Twitter) post that captures the essence. Title: ${extracted.title}. Summary: ${extracted.summary}`,
      linkedin: `Create a professional LinkedIn post that adds value. Title: ${extracted.title}. Summary: ${extracted.summary}`,
      facebook: `Create an engaging Facebook post. Post length should be flexible. Title: ${extracted.title}. Summary: ${extracted.summary}`,
      threads: `Create a Threads post that's conversational and engaging, similar to Twitter but more personal. Title: ${extracted.title}. Summary: ${extracted.summary}`,
      youtube: `Create a YouTube video description that's SEO-optimized and engaging. Title: ${extracted.title}. Summary: ${extracted.summary}`,
      pinterest: `Create a Pinterest pin description that's keyword-rich and inspiring. Title: ${extracted.title}. Summary: ${extracted.summary}`
    };

    const prompt = platformPrompts[platform as keyof typeof platformPrompts] ||
      `Create a social media post for ${platform}. Title: ${extracted.title}. Summary: ${extracted.summary}`;

    return await this.generateText({
      model,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 10000,
      temperature: 0.75
    });
  }

  /**
   * Convert OpenAI-style messages to Gemini format
   */
  private convertMessagesToGeminiFormat(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add system prompt as first user message if provided
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I will follow your instructions.' }]
      });
    }

    // Convert messages
    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are handled above
        continue;
      }

      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      });
    }

    return contents;
  }

  /**
   * Generate content with multimodal support (text + image)
   */
  async generateMultimodalContent({
    model,
    textPrompt,
    imageUrl,
    maxTokens = 10000,
    temperature = 0.7
  }: {
    model: string;
    textPrompt: string;
    imageUrl: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: textPrompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageUrl // This should be base64 encoded image data
              }
            }
          ]
        }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          topP: 0.8,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini multimodal API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  }

  /**
   * Upload file to Gemini for multimodal processing
   */
  async uploadFile(filePath: string, mimeType: string, displayName?: string): Promise<{ fileUri: string; name: string }> {
    try {
      const uploadResponse = await this.fileManager.uploadFile(filePath, {
        mimeType,
        displayName: displayName || "Uploaded File",
      });

      return {
        fileUri: uploadResponse.file.uri,
        name: uploadResponse.file.name
      };
    } catch (error) {
      console.error("Gemini Provider Error (uploadFile):", error);
      throw new Error(`Failed to upload file to Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * WaitForActiveFile: Polls until the file is in ACTIVE state
   */
  async waitForActiveFile(name: string): Promise<void> {
    let state = "PROCESSING";
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s timeout

    while (state === "PROCESSING" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const file = await this.fileManager.getFile(name);
      state = file.state;

      if (state === "FAILED") {
        throw new Error("File processing failed by Gemini.");
      }
      attempts++;
    }

    if (state !== "ACTIVE") {
      throw new Error("File processing timed out or failed to become active.");
    }
  }

  /**
   * Delete file from Gemini
   */
  async deleteFile(name: string): Promise<void> {
    try {
      await this.fileManager.deleteFile(name);
    } catch (error) {
      console.warn(`[Gemini] Failed to delete file ${name}:`, error);
      // Non-fatal
    }
  }
}
