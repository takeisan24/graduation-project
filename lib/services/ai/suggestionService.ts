/**
 * Service: AI Suggestions
 * 
 * Handles AI suggestion generation business logic including:
 * - Content improvement suggestions
 * - Platform-specific optimization
 * - Error handling
 * - Response formatting
 */

import { generateSuggestions } from "@/lib/ai/assistant-v2";

export interface SuggestionRequest {
  content: string;
  contentType?: string;
  platform?: string;
  context?: string;
  suggestionType?: 'improve' | 'rewrite' | 'shorten' | 'expand' | 'hashtags' | 'emojis' | 'format' | 'translate';
  targetLanguage?: string;
}

export interface SuggestionResult {
  suggestions: string;
  suggestionType: string;
  contentType: string;
  platform: string;
  context: string;
  originalContent: string;
  modelUsed: string;
}

/**
 * Generate AI suggestions for content improvement
 * 
 * @param request - Suggestion request parameters
 * @returns Suggestion result with AI-generated suggestions
 */
export async function generateContentSuggestions(
  request: SuggestionRequest
): Promise<SuggestionResult> {
  const {
    content,
    contentType = 'text',
    platform = 'general',
    context = 'general',
    suggestionType = 'improve',
    targetLanguage
  } = request;

  if (!content) {
    throw new Error("Content is required");
  }

  // Map suggestion types to match assistant-v2 interface
  // assistant-v2 uses: 'improve' | 'optimize' | 'expand' | 'shorten' | 'viralize' | 'translate'
  // Route uses: 'improve' | 'rewrite' | 'shorten' | 'expand' | 'hashtags' | 'emojis' | 'format' | 'translate'
  const suggestionTypeMap: Record<string, 'improve' | 'optimize' | 'expand' | 'shorten' | 'viralize' | 'format' | 'translate'> = {
    'improve': 'improve',
    'rewrite': 'improve', // Map rewrite to improve
    'shorten': 'shorten',
    'expand': 'expand',
    'hashtags': 'optimize', // Map hashtags to optimize
    'emojis': 'optimize', // Map emojis to optimize
    'format': 'format', // Map format to format
    'translate': 'translate'
  };

  const mappedSuggestionType = (suggestionTypeMap[suggestionType] || 'improve') as any;

  // Generate suggestions via assistant-v2
  const suggestions = await generateSuggestions({
    content,
    platform,
    suggestionType: mappedSuggestionType,
    targetLanguage
  });

  return {
    suggestions: suggestions.reply,
    suggestionType,
    contentType,
    platform,
    context,
    originalContent: content,
    modelUsed: suggestions.modelUsed
  };
}

