/**
 * Service: AI Assistant
 * 
 * Business logic for AI assistant operations
 */

import { askAssistant } from "@/lib/ai/assistant-v2";
import { getChatMessagesByDraftId, countUserMessagesByDraftId, createChatMessage } from "@/lib/services/db/chatMessages";
import { getDraftById } from "@/lib/services/db/projects";
import { deductCredits } from "@/lib/usage";

export interface AssistantEditRequest {
  draftId: string;
  projectId: string;
  userId: string;
  message: string;
}

export interface AssistantEditResponse {
  reply: string;
  isFreeRefinement: boolean;
  creditsRemaining: number;
  modelUsed: string;
}

/**
 * Edit draft using AI assistant
 */
export async function editDraftWithAssistant(
  request: AssistantEditRequest
): Promise<AssistantEditResponse> {
  const { draftId, projectId, userId, message } = request;
  
  // Verify draft ownership
  const draft = await getDraftById(draftId, userId);
  if (!draft || draft.project_id !== projectId) {
    throw new Error("Draft not found");
  }

  // Get chat history
  const history = await getChatMessagesByDraftId(draftId, 50);

  // Count free refinements (first 3 are free)
  const messageCount = await countUserMessagesByDraftId(draftId);
  const isFreeRefinement = messageCount < 3;

  // Deduct credits only if not a free refinement
  let creditsRemaining = 0;
  if (!isFreeRefinement) {
    const creditResult = await deductCredits(userId, 'AI_REFINEMENT');
    if (!creditResult.success) {
      throw new Error(creditResult.reason || "Insufficient credits");
    }
    creditsRemaining = creditResult.creditsLeft || 0;
  }

  // Save user message
  await createChatMessage({
    draft_id: draftId,
    user_id: userId,
    role: 'user',
    content: message
  });

  // Get AI response with enhanced context
  const assistantResponse = await askAssistant({ 
    draftText: draft.text_content || '', 
    history: history.map(h => ({ role: h.role, content: h.content })), 
    newMessage: message,
    contentType: 'text',
    platform: 'general',
    context: 'draft'
  });

  // Save AI response
  await createChatMessage({
    draft_id: draftId,
    user_id: userId,
    role: 'assistant',
    content: assistantResponse.reply
  });

  return {
    reply: assistantResponse.reply,
    isFreeRefinement,
    creditsRemaining,
    modelUsed: assistantResponse.modelUsed
  };
}

