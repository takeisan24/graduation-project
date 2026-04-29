/**
 * OpenAI Provider Implementation
 */

import { AIProviderConfig } from './index';
import { MEDIA_ERRORS } from '@/lib/messages/errors';
import { logger } from "@/lib/logger";

export class OpenAIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Upload file to OpenAI Files API
   * 
   * @param fileUrl - Public URL of the file to upload
   * @param fileName - Name of the file
   * @param purpose - Purpose of the file (default: 'assistants')
   * @returns file_id from OpenAI
   */
  /**
   * Upload file to OpenAI Files API
   * 
   * @param fileUrl - Public URL of the file to upload
   * @param fileName - Name of the file
   * @param purpose - Purpose of the file (default: 'assistants')
   * @returns file_id from OpenAI
   */
  async uploadFile(
    fileUrl: string,
    fileName: string,
    purpose: string = 'assistants'
  ): Promise<string> {
    try {
      // Download file from URL
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file from URL: ${fileResponse.status} ${fileResponse.statusText}`);
      }

      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      // Use FormData (Node/undici) to avoid manual boundary issues
      const formData = new FormData();
      formData.append('purpose', purpose);
      formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' }), fileName);

      const uploadResponse = await fetch(`${this.config.baseUrl}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
          // Let fetch set Content-Type with boundary
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(`OpenAI Files API error: ${uploadResponse.status} ${error}`);
      }

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.id;

      if (!fileId) {
        throw new Error('OpenAI Files API did not return file_id');
      }

      // function log is imported but we want to use logger.debug for these verbose logs
      logger.debug("[OpenAIProvider] uploadFile", {
        fileName,
        fileId,
        fileSize: fileBuffer.length
      });

      return fileId;
    } catch (error) {
      logger.debug("[OpenAIProvider] uploadFile error", {
        fileName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete file from OpenAI Files API
   * 
   * @param fileId - File ID to delete
   * @returns true if deleted successfully, false otherwise
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const deleteResponse = await fetch(`${this.config.baseUrl}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!deleteResponse.ok) {
        const error = await deleteResponse.text();
        logger.debug("[OpenAIProvider] deleteFile error", {
          fileId,
          error: `OpenAI Files API error: ${deleteResponse.status} ${error}`
        });
        return false;
      }

      const deleteData = await deleteResponse.json();
      const deleted = deleteData.deleted === true;

      logger.debug("[OpenAIProvider] deleteFile", {
        fileId,
        deleted
      });

      return deleted;
    } catch (error) {
      logger.debug("[OpenAIProvider] deleteFile error", {
        fileId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Generate text using OpenAI Chat Completions API
   *
   * NOTE:
   * - Newer OpenAI chat models (gpt-4.1, gpt-5-mini, o3, ...) no longer accept `max_tokens`
   * - They require `max_completion_tokens` instead, so we always send that field here
   * - Call sites can keep using the logical `maxTokens` name; this method handles the mapping
   * - Supports file_id in messages for PDF and other file types
   */
  async generateText({
    model,
    messages,
    maxTokens = 10000,
    temperature = 0.7,
    systemPrompt,
    fileIds
  }: {
    model: string;
    messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; file_id?: string }> }>;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    fileIds?: string[]; // Optional file_ids to include in messages
  }): Promise<string> {
    // Convert messages to OpenAI format
    // If fileIds provided, convert text messages to content array format
    const requestMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; file_id?: string }> }> = [];

    // Add system prompt if provided
    if (systemPrompt) {
      requestMessages.push({ role: 'system', content: systemPrompt });
    }

    // Convert user messages to support file_id format
    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are handled above
        continue;
      }

      // If message has fileIds and content is string, convert to content array format
      if (fileIds && fileIds.length > 0 && typeof message.content === 'string') {
        const contentArray: Array<{ type: string; text?: string; file_id?: string }> = [
          { type: 'text', text: message.content }
        ];

        // Add file_ids to content array
        for (const fileId of fileIds) {
          contentArray.push({ type: 'file', file_id: fileId });
        }

        requestMessages.push({
          role: message.role,
          content: contentArray
        });
      } else {
        // Normal message format
        requestMessages.push(message);
      }
    }

    // Log master/system prompt + metadata for debugging ChatGPT calls
    // Chỉ log một phần đầu prompt để tránh spam log và lộ full nội dung người dùng
    logger.debug("[OpenAIProvider] generateText", {
      model,
      hasSystemPrompt: !!systemPrompt,
      systemPromptPreview: systemPrompt ? systemPrompt.slice(0, 200) : undefined,
      messagesCount: requestMessages.length
    });

    // Một số model mới của OpenAI (ví dụ: gpt-5-mini, gpt-4.1, o3, ...)
    // chỉ hỗ trợ temperature = 1 (mặc định) hoặc không cho phép truyền temperature.
    // Để tránh lỗi "Unsupported value: 'temperature'...", ta sẽ:
    // - Chỉ truyền temperature cho các model cũ linh hoạt (gpt-3.5-turbo, gpt-4o, ...)
    // - Với các model bị cố định temperature, không gửi field này (để dùng default 1).
    const fixedTemperatureModels = new Set<string>([
      'gpt-5-mini'
    ]);

    const requestBody: any = {
      model,
      messages: requestMessages,
      // Sử dụng `max_completion_tokens` theo chuẩn API mới
      max_completion_tokens: maxTokens,
      stream: false
    };

    // Chỉ set temperature nếu model cho phép custom
    if (!fixedTemperatureModels.has(model) && typeof temperature === 'number') {
      requestBody.temperature = temperature;
    }

    const MAX_RETRIES = 2;
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        const isRetryable = response.status === 429 || response.status === 500 || response.status === 503;

        if (isRetryable && retry < MAX_RETRIES) {
          const delay = response.status === 429 ? 5000 * (retry + 1) : 8000 * (retry + 1);
          console.warn(`[OpenAI] generateText: Error ${response.status}, retrying (${retry + 1}/${MAX_RETRIES}) after ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (isRetryable) {
          throw new Error(response.status === 429 ? MEDIA_ERRORS.OPENAI_RATE_LIMITED : MEDIA_ERRORS.OPENAI_OVERLOADED);
        }
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    }
    throw new Error(MEDIA_ERRORS.OPENAI_OVERLOADED);
  }

  /**
   * Generate image using DALL-E API
   */
  async generateImage({
    model = 'dall-e-3',
    prompt,
    n = 1,
    size = '1024x1024',
    quality = 'standard',
    style = 'vivid'
  }: {
    model?: string;
    prompt: string;
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
  }): Promise<{ url: string; revisedPrompt?: string; images?: Array<{ base64: string; mimeType: string }> }> {
    const MAX_RETRIES = 2;
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      const response = await fetch(`${this.config.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt,
          n,
          size,
          quality,
          style
        })
      });

      if (!response.ok) {
        const error = await response.text();
        const isRetryable = response.status === 429 || response.status === 500 || response.status === 503;

        if (isRetryable && retry < MAX_RETRIES) {
          const delay = response.status === 429 ? 5000 * (retry + 1) : 8000 * (retry + 1);
          console.warn(`[OpenAI] generateImage: Error ${response.status}, retrying (${retry + 1}/${MAX_RETRIES}) after ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (isRetryable) {
          throw new Error(response.status === 429 ? MEDIA_ERRORS.OPENAI_RATE_LIMITED : MEDIA_ERRORS.OPENAI_OVERLOADED);
        }
        throw new Error(`OpenAI DALL-E API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return {
        url: data.data[0].url,
        revisedPrompt: data.data[0].revised_prompt
      };
    }
    throw new Error(MEDIA_ERRORS.OPENAI_OVERLOADED);
  }

  /**
   * Extract content from various sources
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
    let userPrompt = '';

    if (sourceType === 'prompt') {
      userPrompt = `Extract and summarize the key information from this content:\n\n${sourceContent}`;
    } else if (sourceType === 'url') {
      userPrompt = `Extract the title and create a concise summary (2-3 sentences) from this URL: ${sourceContent}\nIf unable to access, respond with 'UNABLE_TO_FETCH'.`;
    } else {
      userPrompt = `Extract the title and create a concise summary (2-3 sentences) from this file: ${filePublicUrl}\nIf unable to access, respond with 'UNABLE_TO_FETCH'.`;
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
   * Generate platform-specific content
   */
  async generatePlatformContent({
    model,
    platform,
    contentType: _contentType,
    extracted,
    context: _context = 'general'
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
      x: `Create a concise X post that captures the essence. Title: ${extracted.title}. Summary: ${extracted.summary}`,
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
}
