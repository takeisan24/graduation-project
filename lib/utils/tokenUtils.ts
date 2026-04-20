/**
 * Token Utilities
 * 
 * Helper functions for estimating and managing token usage for AI APIs
 * to prevent exceeding rate limits and quotas.
 */

/**
 * Rough token estimation (approximate)
 * - Vietnamese: ~1 token per 3-4 characters
 * - English: ~1 token per 3-4 characters
 * - For safety, we use 1 token = 3 characters (conservative estimate)
 */
const CHARS_PER_TOKEN = 3;

/**
 * Estimate token count from text
 * 
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate text to fit within token limit
 * 
 * @param text - Text to truncate
 * @param maxTokens - Maximum tokens allowed
 * @param suffix - Suffix to add when truncated (default: "...")
 * @returns Truncated text
 */
export function truncateToTokens(text: string, maxTokens: number, suffix: string = "..."): string {
  if (!text) return text;
  
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // Calculate max characters based on token limit
  const maxChars = (maxTokens * CHARS_PER_TOKEN) - suffix.length;
  return text.substring(0, maxChars) + suffix;
}

/**
 * Truncate array of messages to fit within token limit
 * Keeps most recent messages (last N messages that fit)
 * 
 * @param messages - Array of messages with content
 * @param maxTokens - Maximum tokens allowed for all messages
 * @returns Truncated array of messages
 */
export function truncateMessages<T extends { content: string }>(
  messages: T[],
  maxTokens: number
): T[] {
  if (!messages || messages.length === 0) return messages;
  
  // Calculate tokens for each message
  const messagesWithTokens = messages.map(msg => ({
    msg,
    tokens: estimateTokens(msg.content)
  }));
  
  // Start from the end (most recent) and work backwards
  let totalTokens = 0;
  const keptMessages: T[] = [];
  
  for (let i = messagesWithTokens.length - 1; i >= 0; i--) {
    const { msg, tokens } = messagesWithTokens[i];
    if (totalTokens + tokens <= maxTokens) {
      keptMessages.unshift(msg); // Add to beginning to maintain order
      totalTokens += tokens;
    } else {
      // If even a single message exceeds limit, truncate its content
      if (keptMessages.length === 0) {
        // This is the only message, truncate it
        const truncatedContent = truncateToTokens(msg.content, maxTokens);
        keptMessages.push({ ...msg, content: truncatedContent } as T);
      }
      break;
    }
  }
  
  return keptMessages;
}

/**
 * Build a condensed user instructions block from accumulated user messages.
 * Truncates to fit within token limit, keeping the most recent instructions.
 *
 * @param userInstructions - Array of raw user message strings from the session
 * @param maxTokens - Maximum tokens allowed for the instructions block
 * @returns A single formatted string summarizing user instructions, or null if empty
 */
export function buildUserInstructionsBlock(
  userInstructions: string[],
  maxTokens: number
): string | null {
  if (!userInstructions || userInstructions.length === 0) return null;

  // Deduplicate: remove exact duplicates while preserving order
  const unique = [...new Map(userInstructions.map(s => [s, s])).values()];

  // Build numbered list of instructions
  const lines = unique.map((msg, i) => `${i + 1}. ${msg}`);
  let block = lines.join('\n');

  // If exceeds budget, keep most recent instructions that fit
  const totalTokens = estimateTokens(block);
  if (totalTokens > maxTokens) {
    const kept: string[] = [];
    let tokens = 0;
    // Iterate from most recent to oldest
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineTokens = estimateTokens(lines[i]);
      if (tokens + lineTokens <= maxTokens) {
        kept.unshift(lines[i]);
        tokens += lineTokens;
      } else {
        break;
      }
    }
    block = kept.join('\n');
  }

  return block;
}

/**
 * Truncate context data (extractedContent, posts, etc.) to fit within token limit
 * 
 * @param extractedContent - Extracted content from YouTube/source
 * @param currentPosts - Array of current posts
 * @param maxTokens - Maximum tokens allowed for context
 * @returns Truncated context data
 */
export function truncateContextData(
  extractedContent: string | null | undefined,
  currentPosts: Array<{ platform: string; content: string }>,
  maxTokens: number
): {
  extractedContent: string | null;
  currentPosts: Array<{ platform: string; content: string }>;
  totalTokens: number;
} {
  let remainingTokens = maxTokens;
  const result: {
    extractedContent: string | null;
    currentPosts: Array<{ platform: string; content: string }>;
    totalTokens: number;
  } = {
    extractedContent: null,
    currentPosts: [],
    totalTokens: 0
  };
  
  // Allocate tokens: 60% for extractedContent, 40% for posts
  const extractedContentTokens = Math.floor(maxTokens * 0.6);
  const postsTokens = Math.floor(maxTokens * 0.4);
  
  // Truncate extractedContent
  if (extractedContent) {
    const truncated = truncateToTokens(extractedContent, extractedContentTokens);
    result.extractedContent = truncated;
    remainingTokens -= estimateTokens(truncated);
  }
  
  // Truncate posts (keep most recent posts that fit)
  if (currentPosts.length > 0 && remainingTokens > 0) {
    const tokensPerPost = Math.floor(postsTokens / currentPosts.length);
    result.currentPosts = currentPosts.map(post => {
      const truncated = truncateToTokens(post.content, tokensPerPost);
      return {
        platform: post.platform,
        content: truncated
      };
    });
    
    // Calculate total tokens used
    result.totalTokens = estimateTokens(result.extractedContent || '') +
      result.currentPosts.reduce((sum, post) => sum + estimateTokens(post.content), 0);
  } else {
    result.totalTokens = estimateTokens(result.extractedContent || '');
  }
  
  return result;
}

/**
 * Constants for token limits
 * Based on Gemini API limits and best practices
 */
export const TOKEN_LIMITS = {
  // User instructions: Priority messages from user in session (separate budget, not truncated with history)
  USER_INSTRUCTIONS_MAX_TOKENS: 3000,

  // Chat history: Keep last 20 messages max (roughly 10K tokens)
  CHAT_HISTORY_MAX_TOKENS: 10000,
  CHAT_HISTORY_MAX_MESSAGES: 20,
  
  // Context data (extractedContent + posts): Max 5K tokens
  CONTEXT_DATA_MAX_TOKENS: 5000,
  
  // Extracted content from YouTube: Max 3K tokens
  EXTRACTED_CONTENT_MAX_TOKENS: 3000,
  
  // Individual post content: Max 1K tokens
  POST_CONTENT_MAX_TOKENS: 1000,
  
  // System prompt: Should be under 1K tokens
  SYSTEM_PROMPT_MAX_TOKENS: 1000,
  
  // Total input per request: Max 200K tokens (Gemini 2.5 Pro limit)
  // But we'll be conservative and use 100K to avoid rate limits
  TOTAL_INPUT_MAX_TOKENS: 100000
} as const;

