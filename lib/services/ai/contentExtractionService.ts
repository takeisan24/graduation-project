/**
 * Service: Content Extraction
 * 
 * Handles content extraction from URLs and text including:
 * - Authentication
 * - Error handling
 * - Response formatting
 */

import { extractContent } from "@/lib/ai/generator-v2";

export interface ContentExtractionRequest {
  sourceType: 'url' | 'prompt';
  sourceContent: string;
}

export interface ContentExtractionResult {
  extracted: {
    title: string;
    summary: string;
    raw?: string;
  };
}

/**
 * Extract content from URL or text
 */
export async function extractContentFromSource(
  request: ContentExtractionRequest
): Promise<ContentExtractionResult> {
  const { sourceType, sourceContent } = request;

  const extracted = await extractContent({
    sourceType,
    sourceContent
  });

  return { extracted };
}

