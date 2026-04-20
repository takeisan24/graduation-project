/**
 * AI Assistant v2
 * Refactored to use multiple AI providers with enhanced context awareness
 */

import { aiManager } from './providers/manager';
import { getBestModel } from './config';

export interface AssistantRequest {
  draftText: string;
  history: Array<{ role: string; content: string }>;
  newMessage: string;
  contentType?: 'text' | 'image' | 'video';
  platform?: string;
  context?: 'general' | 'project' | 'draft' | 'workspace';
  modelId?: string;
  userInstructions?: string[]; // Danh sách tin nhắn user ưu tiên trong session
}

export interface AssistantResponse {
  reply: string;
  modelUsed: string;
  tokensUsed?: number;
}

/**
 * Enhanced AI Assistant with multi-provider support
 */
export async function askAssistant({
  draftText,
  history,
  newMessage,
  contentType = 'text',
  platform = 'general',
  context = 'general',
  modelId,
  userInstructions = []
}: AssistantRequest): Promise<AssistantResponse> {

  const model = modelId || getBestModel('text');

  // Use centralized prompts from lib/prompts
  const { getSystemPrompt } = await import("@/lib/prompts");
  const { buildUserInstructionsBlock, TOKEN_LIMITS } = await import("@/lib/utils/tokenUtils");

  const messages: Array<{ role: string; content: string }> = [];

  // Check if history already contains system instruction
  const hasSystemInstruction = Array.isArray(history) && history.length > 0 &&
    history[0].content &&
    history[0].content.includes('trợ lý viết bài cho mạng xã hội');

  // Only add system prompt if history doesn't already have system instruction
  // Use centralized prompt manager
  let systemPrompt: string | undefined;
  if (!hasSystemInstruction) {
    systemPrompt = getSystemPrompt(contentType, platform, context, draftText);
  }

  // Inject user instructions block BEFORE history (priority context)
  // This ensures AI always remembers user's requirements even when history is truncated
  if (userInstructions && userInstructions.length > 0) {
    const instructionsBlock = buildUserInstructionsBlock(
      userInstructions,
      TOKEN_LIMITS.USER_INSTRUCTIONS_MAX_TOKENS
    );
    if (instructionsBlock) {
      messages.push({
        role: "user",
        content: `=== CÁC YÊU CẦU CỦA NGƯỜI DÙNG TRONG PHIÊN NÀY (ƯU TIÊN CAO) ===\nDưới đây là toàn bộ tin nhắn/yêu cầu của người dùng trong phiên chat này. Hãy LUÔN tuân thủ các yêu cầu này khi tạo nội dung:\n${instructionsBlock}\n=== HẾT DANH SÁCH YÊU CẦU ===`
      });
      messages.push({
        role: "assistant",
        content: "Đã ghi nhận toàn bộ yêu cầu của bạn. Tôi sẽ luôn tuân thủ các yêu cầu này trong suốt phiên chat."
      });
    }
  }

  if (Array.isArray(history)) {
    history.forEach(h => messages.push({ role: h.role, content: h.content }));
  }

  messages.push({ role: "user", content: newMessage });

  const reply = await aiManager.generateText({
    modelId: model,
    messages,
    systemPrompt,
    maxTokens: 20000,
    temperature: 0.7
  });

  return {
    reply,
    modelUsed: model
  };
}

/**
 * Generate content suggestions for a platform
 */
export async function generateSuggestions({
  content,
  platform,
  suggestionType = 'improve',
  modelId,
  targetLanguage
}: {
  content: string;
  platform: string;
  suggestionType?: 'improve' | 'optimize' | 'expand' | 'shorten' | 'viralize' | 'translate';
  modelId?: string;
  targetLanguage?: string;
}): Promise<AssistantResponse> {

  const model = modelId || getBestModel('text');

  // Use centralized prompts from lib/prompts
  const { getSuggestionPrompt } = await import("@/lib/prompts");
  const prompt = getSuggestionPrompt(suggestionType, platform, content, targetLanguage);

  const reply = await aiManager.generateText({
    modelId: model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 10000,
    temperature: 0.8
  });

  return {
    reply,
    modelUsed: model
  };
}

/**
 * Generate hashtag suggestions
 */
export async function generateHashtags({
  content,
  platform,
  count = 10,
  modelId
}: {
  content: string;
  platform: string;
  count?: number;
  modelId?: string;
}): Promise<AssistantResponse> {

  const model = modelId || getBestModel('text');

  // Use centralized prompts from lib/prompts
  const { getHashtagPrompt } = await import("@/lib/prompts");
  const prompt = getHashtagPrompt(content, platform, count);

  const reply = await aiManager.generateText({
    modelId: model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 10000,
    temperature: 0.9
  });

  return {
    reply,
    modelUsed: model
  };
}

/**
 * Generate content variations
 */
export async function generateVariations({
  content,
  platform,
  count = 3,
  variationType = 'tone',
  modelId
}: {
  content: string;
  platform: string;
  count?: number;
  variationType?: 'tone' | 'length' | 'style' | 'audience';
  modelId?: string;
}): Promise<AssistantResponse> {

  const model = modelId || getBestModel('text');

  const variationPrompts = {
    tone: `Create ${count} different tone variations of this content for ${platform} (professional, casual, humorous, serious):`,
    length: `Create ${count} different length variations of this content for ${platform} (short, medium, long):`,
    style: `Create ${count} different style variations of this content for ${platform} (formal, conversational, creative):`,
    audience: `Create ${count} different audience-targeted variations of this content for ${platform} (beginners, experts, general audience):`
  };

  const prompt = `${variationPrompts[variationType]} ${content}`;

  const reply = await aiManager.generateText({
    modelId: model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 10000,
    temperature: 0.8
  });

  return {
    reply,
    modelUsed: model
  };
}

/**
 * Analyze content performance potential
 */
export async function analyzeContent({
  content,
  platform,
  modelId
}: {
  content: string;
  platform: string;
  modelId?: string;
}): Promise<AssistantResponse> {

  const model = modelId || getBestModel('text');

  const prompt = `Analyze this content for ${platform} and provide insights on:
1. Engagement potential (1-10)
2. Viral potential (1-10)
3. Brand alignment (1-10)
4. Key strengths
5. Areas for improvement
6. Recommended posting time
7. Target audience

Content: ${content}`;

  const reply = await aiManager.generateText({
    modelId: model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 10000,
    temperature: 0.7
  });

  return {
    reply,
    modelUsed: model
  };
}
