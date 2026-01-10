/**
 * Service: Chat
 * 
 * Handles chat business logic including:
 * - Session management
 * - Message history handling
 * - Free message counting
 * - Credit checking and deduction
 * - AI response generation
 * - Post parsing from AI response
 * - Usage tracking
 */

import { NextRequest } from "next/server";
import { askAssistant } from "@/lib/ai/assistant-v2";
import { deductCredits, checkCredits, CREDIT_COSTS } from "@/lib/usage";
import { MEDIA_ERRORS } from "@/lib/messages/errors";
import { withApiProtection } from "@/lib/middleware/api-protected";
import { createChatSession, getChatSessionById } from "@/lib/services/db/chatSessions";
import {
  getChatMessagesByContext,
  getChatMessagesBySessionId,
  createChatMessage
} from "@/lib/services/db/chatMessages";
import { getProjectById } from "@/lib/services/db/projects";
import { getDraftById } from "@/lib/services/db/projects";
import { supabase } from "@/lib/supabase";
import { getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";

export interface ChatRequest {
  message: string;
  context?: string;
  contentType?: string;
  platform?: string;
  // Model FE yêu cầu cho chat (ví dụ: 'ChatGPT'). BE sẽ map sang modelId cụ thể.
  modelKey?: string;
  sessionId?: string;
  projectId?: string;
  draftId?: string;
  history?: any[];
  isEditRequest?: boolean;
  userInstructions?: string[]; // Danh sách tin nhắn user ưu tiên trong session
}

export interface ChatResult {
  reply: string;
  sessionId: string;
  isFreeMessage: boolean;
  creditsRemaining: number;
  context: string;
  contentType: string;
  platform: string;
  modelUsed: string;
  postsCreatedCount: number;
  platformsCreated: string[];
  creditsDeducted: number;
}

/**
 * Convert history from Gemini format to backend format
 */
function convertHistoryFormat(historyFromBody: any[]): Array<{ role: string; content: string }> {
  if (!historyFromBody || !Array.isArray(historyFromBody)) {
    return [];
  }

  return historyFromBody
    .map((msg: any) => {
      // Convert from Gemini format: { role: 'user'|'model', parts: [{ text: '...' }] }
      // to backend format: { role: 'user'|'assistant', content: '...' }
      if (msg.parts && Array.isArray(msg.parts) && msg.parts[0]?.text) {
        return {
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.parts[0].text
        };
      } else if (msg.content) {
        return {
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.content
        };
      }
      return null;
    })
    .filter((msg): msg is { role: string; content: string } => msg !== null);
}

/**
 * Parse AI response to count number of posts created
 * Safely handles malformed JSON blocks from AI responses
 */
function parsePostsFromResponse(reply: string): { platformsCreated: string[]; postsCreatedCount: number } {
  let platformsCreated: string[] = [];
  let postsCreatedCount = 0;

  if (!reply || typeof reply !== 'string') {
    return { platformsCreated, postsCreatedCount };
  }

  try {
    // Match JSON code blocks (handle both ```json and ``` with json)
    // Use non-greedy match to handle multiple blocks
    const jsonBlockPattern = /```(?:json)?\n([\s\S]*?)\n```/g;
    let match;

    while ((match = jsonBlockPattern.exec(reply)) !== null) {
      const jsonContent = match[1];
      if (!jsonContent || jsonContent.trim().length === 0) {
        continue;
      }

      try {
        // Clean up JSON content (remove trailing commas, fix common issues)
        let cleanedJson = jsonContent.trim();

        // Try to fix common JSON issues
        // Remove trailing commas before closing braces/brackets
        cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');

        // Fix unescaped control characters (like literal newlines) inside JSON strings
        // We only escape when we are inside a string value to avoid converting structural newlines into '\n' strings
        let inString = false;
        let escapedJson = '';
        for (let i = 0; i < cleanedJson.length; i++) {
          const char = cleanedJson[i];
          if (char === '"' && (i === 0 || cleanedJson[i - 1] !== '\\')) {
            inString = !inString;
            escapedJson += char;
          } else if (inString && char === '\n') {
            escapedJson += '\\n';
          } else if (inString && char === '\r') {
            escapedJson += '\\r';
          } else if (inString && char === '\t') {
            escapedJson += '\\t';
          } else {
            escapedJson += char;
          }
        }
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(cleanedJson);
        } catch (parseError) {
          console.warn("[ChatService] JSON.parse failed, initiating fallback extraction...");
          const fallbackPosts = [];
          const chunks = cleanedJson.split(/"action"\s*:\s*"create_post"/g);

          for (let i = 1; i < chunks.length; i++) {
            const chunk = chunks[i];

            const platformMatch = chunk.match(/"platform"\s*:\s*"([^"]+)"/);
            if (!platformMatch) continue;
            const platform = platformMatch[1];

            const contentKeyMatch = chunk.match(/"content"\s*:\s*"/);
            if (!contentKeyMatch) continue;
            const contentStartIndex = contentKeyMatch.index! + contentKeyMatch[0].length;

            const summaryMatch = chunk.match(/"summary_for_chat"\s*:\s*"/);

            let contentEndIndex = -1;
            let summary = "";

            if (summaryMatch) {
              const textBeforeSummary = chunk.substring(0, summaryMatch.index);
              contentEndIndex = textBeforeSummary.lastIndexOf('"');

              const summaryStartIndex = summaryMatch.index! + summaryMatch[0].length;
              const nextEndBrace = chunk.indexOf('}', summaryStartIndex);
              const searchEnd = nextEndBrace !== -1 ? nextEndBrace : chunk.length;

              const summaryEndIndex = chunk.lastIndexOf('"', searchEnd);
              if (summaryEndIndex > summaryStartIndex) {
                summary = chunk.substring(summaryStartIndex, summaryEndIndex);
              }
            } else {
              const nextEndBrace = chunk.indexOf('}', contentStartIndex);
              const searchEnd = nextEndBrace !== -1 ? nextEndBrace : chunk.length;
              contentEndIndex = chunk.lastIndexOf('"', searchEnd);
            }

            if (contentEndIndex !== -1 && contentEndIndex > contentStartIndex) {
              let rawContent = chunk.substring(contentStartIndex, contentEndIndex);

              rawContent = rawContent.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              summary = summary.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

              fallbackPosts.push({
                action: "create_post",
                platform,
                content: rawContent,
                summary_for_chat: summary
              });
            }
          }
          parsedResponse = fallbackPosts;
        }

        // Handle single post object
        if (parsedResponse && typeof parsedResponse === 'object' && !Array.isArray(parsedResponse)) {
          if (parsedResponse.action === "create_post" && parsedResponse.platform) {
            platformsCreated.push(parsedResponse.platform);
            postsCreatedCount++;
          }
        }
        // Handle array of posts
        else if (Array.isArray(parsedResponse)) {
          for (const post of parsedResponse) {
            if (post && typeof post === 'object' && post.action === "create_post" && post.platform) {
              platformsCreated.push(post.platform);
              postsCreatedCount++;
            }
          }
        }
      } catch (parseError: any) {
        // Log detailed error for debugging but don't throw
        console.warn(`[ChatService] Error parsing JSON block at position ${match.index}:`, {
          error: parseError.message,
          jsonPreview: jsonContent.substring(0, 100) + (jsonContent.length > 100 ? '...' : ''),
          position: parseError.message.match(/position (\d+)/)?.[1] || 'unknown'
        });
        // Continue processing other JSON blocks
        continue;
      }
    }
  } catch (outerError: any) {
    // Catch any unexpected errors in the outer try block
    console.warn("[ChatService] Error parsing AI response for posts:", {
      error: outerError.message,
      errorType: outerError.constructor?.name || 'Unknown'
    });
  }

  return { platformsCreated, postsCreatedCount };
}

/**
 * Get context data from project or draft
 */
async function getContextData(
  projectId: string | undefined,
  draftId: string | undefined,
  userId: string
): Promise<string> {
  let contextData = '';

  if (projectId) {
    const project = await getProjectById(projectId, userId);
    if (project) {
      contextData = `Project context: ${project.source_type} - ${project.source_content}`;
    }
  }

  if (draftId) {
    const draft = await getDraftById(draftId, userId);
    if (draft) {
      contextData += `\nDraft context: ${draft.platform} - ${draft.text_content}`;
    }
  }

  return contextData;
}

/**
 * Process chat message with AI assistant
 */
export async function processChatMessage(
  req: NextRequest,
  request: ChatRequest
): Promise<ChatResult | { error: string; status: number }> {
  const {
    message,
    context = 'general',
    contentType = 'text',
    platform = 'general',
    modelKey,
    sessionId,
    projectId,
    draftId,
    history: historyFromBody,
    isEditRequest = false,
    userInstructions = []
  } = request;

  if (!message) {
    return { error: "Message is required", status: 400 };
  }

  // Centralized protection: auth + paywall check
  // Note: Skip credit deduction here because we need to check free message count first
  const protection = await withApiProtection(req, 'AI_REFINEMENT', {
    skipDeduct: true, // Will deduct manually after checking free message count
    returnError: true,
    metadata: {
      context,
      contentType,
      platform,
      message: message.substring(0, 100) // Truncate for storage
    }
  });

  if ('error' in protection) {
    const status = protection.error.status ?? 401;
    let message = "Unauthorized or insufficient credits";
    try {
      const errorBody = await protection.error.json();
      if (errorBody?.message) {
        message = errorBody.message;
      }
    } catch {
      // Ignore JSON parsing errors, fallback to default message
    }
    return { error: message, status };
  }

  const { user, paywallResult } = protection;

  // Get or create session
  let session = sessionId;
  if (!session) {
    const newSession = await createChatSession({
      user_id: user.id,
      context,
      project_id: projectId || null,
      draft_id: draftId || null
    });
    if (!newSession) {
      return { error: "Failed to create chat session", status: 500 };
    }
    session = newSession.id;
  }

  // Convert history from Gemini format to backend format if needed
  let history: Array<{ role: string; content: string }> = [];
  if (historyFromBody && Array.isArray(historyFromBody)) {
    history = convertHistoryFormat(historyFromBody);
  } else {
    // Fallback: Get chat history from DB
    // Limit to last 20 messages to prevent excessive token usage
    history = await getChatMessagesBySessionId(session, 20);
  }

  // Truncate history to fit within token limits
  // Import token utilities
  const { truncateMessages, TOKEN_LIMITS } = await import('@/lib/utils/tokenUtils');
  history = truncateMessages(history, TOKEN_LIMITS.CHAT_HISTORY_MAX_TOKENS);

  // New credit flow: only charge when creating new posts.
  // Chat conversation and editing existing posts are always free.
  console.log(`[ChatService] Session ${session}: contentType=${contentType}, isEditRequest=${isEditRequest}`);

  // Get context data if available
  const contextData = await getContextData(projectId, draftId, user.id);

  // Save user message
  // Note: project_id is not stored in chat_messages. The session_id links to chat_sessions which has project_id.
  await createChatMessage({
    session_id: session,
    draft_id: draftId || null,
    user_id: user.id,
    role: 'user',
    content: message,
    context,
    content_type: contentType,
    platform
  });

  // Xác định modelId cho AI Assistant
  // - Nếu FE gửi modelKey là 'chatgpt' => ép dùng OpenAI với model trong env OPENAI_MODEL (mặc định 'gpt-5-mini')
  // - Nếu không gửi hoặc model khác => để trống, assistant sẽ fallback về Gemini (getBestModel('text'))
  const clientModelKey = (modelKey || '').toLowerCase().trim();
  const openaiEnvModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const modelIdForAssistant =
    clientModelKey === 'chatgpt'
      ? openaiEnvModel
      : undefined;

  // Get AI response with enhanced context
  let response;
  try {
    response = await askAssistant({
      draftText: contextData || message,
      history: history || [],
      newMessage: message,
      contentType: contentType as 'text' | 'image' | 'video',
      platform: platform,
      context: 'general',
      modelId: modelIdForAssistant,
      userInstructions: userInstructions || []
    });
  } catch (aiError: any) {
    console.error("[ChatService] AI response generation error:", aiError);
    const errorMessage = aiError instanceof Error ? aiError.message : "Failed to generate AI response";
    const isProviderApiError = [
      MEDIA_ERRORS.MODEL_OVERLOADED, MEDIA_ERRORS.MODEL_RATE_LIMITED,
      MEDIA_ERRORS.OPENAI_OVERLOADED, MEDIA_ERRORS.OPENAI_RATE_LIMITED,
      MEDIA_ERRORS.FAL_OVERLOADED, MEDIA_ERRORS.FAL_RATE_LIMITED,
    ].includes(errorMessage as any);
    return {
      error: JSON.stringify({
        error: isProviderApiError ? errorMessage : "Failed to generate AI response",
        message: errorMessage,
        creditsDeducted: false,
        isProviderApiError
      }),
      status: 500
    };
  }

  // Parse AI response to count number of posts created (for multi-platform posts)
  const { platformsCreated, postsCreatedCount } = parsePostsFromResponse(response.reply);

  // New flow: only charge credits when NEW posts are created (not edits)
  // Edit requests are always free
  const creditsToDeduct = (!isEditRequest && postsCreatedCount > 0)
    ? postsCreatedCount * CREDIT_COSTS.TEXT_ONLY  // 1 credit per new post
    : 0; // Chat and editing are free

  // Check if user has enough credits for new posts
  if (creditsToDeduct > 0) {
    const creditCheck = await checkCredits(user.id, 'TEXT_ONLY');
    if (!creditCheck.success || (creditCheck.creditsLeft ?? 0) < creditsToDeduct) {
      return {
        error: JSON.stringify({
          message: `Insufficient credits. Need ${creditsToDeduct} credits (${postsCreatedCount} posts) but only have ${creditCheck.creditsLeft ?? 0}`,
          upgradeRequired: true,
          creditsRequired: creditsToDeduct,
          creditsRemaining: creditCheck.creditsLeft ?? 0,
          totalCredits: creditCheck.totalCredits ?? 0,
          postsCreatedCount: postsCreatedCount
        }),
        status: 403
      };
    }
  }

  // Save AI response
  // Note: project_id is not stored in chat_messages. The session_id links to chat_sessions which has project_id.
  await createChatMessage({
    session_id: session,
    draft_id: draftId || null,
    user_id: user.id,
    role: 'assistant',
    content: response.reply,
    context,
    content_type: contentType,
    platform
  });

  // Deduct credits ONLY when new posts are created (not for chat or edits)
  let creditsRemaining = 0;
  if (creditsToDeduct > 0) {
    console.log(`[ChatService] Deducting ${creditsToDeduct} credits for user ${user.id}, session ${session}, postsCreatedCount=${postsCreatedCount}, platforms=${platformsCreated.join(',')}`);

    // Deduct credits for each new post created
    for (let i = 0; i < postsCreatedCount; i++) {
      const creditResult = await deductCredits(user.id, 'TEXT_ONLY', {
        sessionId: session,
        context,
        contentType,
        platform: platformsCreated[i] || platform,
        projectId: projectId || null,
        draftId: draftId || null,
        message: message.substring(0, 100),
        platformsCreated: platformsCreated.join(','),
        totalPostsCreated: postsCreatedCount,
        postIndex: i + 1
      }, { reply: response.reply });

      if (!creditResult.success) {
        console.error(`[ChatService] Failed to deduct credits for post ${i + 1}/${postsCreatedCount}:`, creditResult);
      } else {
        creditsRemaining = creditResult.creditsLeft ?? 0;
      }
    }

    console.log(`[ChatService] Successfully deducted ${creditsToDeduct} credits. Remaining: ${creditsRemaining}`);
  } else {
    // Get current credits for response (no deduction needed)
    const creditCheck = await checkCredits(user.id, 'TEXT_ONLY');
    creditsRemaining = creditCheck.creditsLeft ?? 0;
    console.log(`[ChatService] No credit deduction - chat/edit is free. Credits: ${creditsRemaining}`);
  }

  // Update monthly_usage.posts_created if new posts were created via chatbot
  if (!isEditRequest && postsCreatedCount > 0) {
    try {
      const month = getMonthStartDate(DEFAULT_TIMEZONE);
      await supabase.rpc('increment_usage', {
        p_user_id: user.id,
        p_month: month,
        p_field: 'posts_created',
        p_amount: postsCreatedCount
      });
    } catch (usageErr: any) {
      console.warn('[ChatService] increment_usage error (posts_created):', usageErr);
    }
  }

  return {
    reply: response.reply,
    sessionId: session,
    isFreeMessage: creditsToDeduct === 0, // Free if no credits were deducted (chat/edit)
    creditsRemaining: creditsRemaining,
    context,
    contentType,
    platform,
    modelUsed: response.modelUsed,
    postsCreatedCount: postsCreatedCount,
    platformsCreated: platformsCreated,
    creditsDeducted: creditsToDeduct
  };
}

