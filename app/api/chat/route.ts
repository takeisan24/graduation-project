import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { processChatMessage } from "@/lib/services/ai/chatService";
import { getChatMessagesByContext } from "@/lib/services/db/chatMessages";

/**
 * POST /api/chat
 * General purpose AI chatbot with context awareness
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const {
      message,
      context = 'general',
      contentType = 'text',
      platform = 'general',
      // Model FE gửi lên (ví dụ: 'ChatGPT') để BE quyết định route tới OpenAI hay Gemini
      modelKey,
      sessionId,
      projectId,
      draftId,
      history,
      isEditRequest
    } = await req.json();

    if (!message) return fail("Message is required", 400);

    // Process chat message via service layer
    const result = await processChatMessage(req, {
      message,
      context,
      contentType,
      platform,
      modelKey,
      sessionId,
      projectId,
      draftId,
      history,
      isEditRequest
    });

    // Handle error response
    if ('error' in result) {
      return fail(result.error, result.status);
    }

    // Return success response
    return success(result);

  } catch (err: any) {
    console.error("POST /api/chat error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * GET /api/chat
 * Get chat history for a session
 */
export async function GET(req: NextRequest) {
  try {
    // Centralized authentication check
    const authResult = await withAuthOnly(req);
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const projectId = searchParams.get('projectId');
    const draftId = searchParams.get('draftId');

    if (!sessionId && !projectId && !draftId) {
      return fail("sessionId, projectId, or draftId is required", 400);
    }

    // Get chat messages via service layer
    const messages = await getChatMessagesByContext({
      sessionId: sessionId || undefined,
      projectId: projectId || undefined,
      draftId: draftId || undefined,
      userId: user.id,
      limit: 100
    });

    return success({
      messages: messages || [],
      sessionId,
      projectId,
      draftId
    });

  } catch (err: any) {
    console.error("GET /api/chat error:", err);
    return fail(err.message || "Server error", 500);
  }
}
