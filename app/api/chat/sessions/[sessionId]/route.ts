import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getChatSessionById, updateChatSession, deleteChatSession } from "@/lib/services/db/chatSessions";
import { getChatMessagesBySessionId } from "@/lib/services/db/chatMessages";

/**
 * GET /api/chat/sessions/[sessionId]
 * Get a specific chat session with messages
 */
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);
    
    const { sessionId } = params;

    // Get session details via service layer
    const session = await getChatSessionById(sessionId, user.id);
    if (!session) {
      return fail("Session not found", 404);
    }

    // Get messages for this session via service layer
    const messages = await getChatMessagesBySessionId(sessionId, 100);

    return success({ 
      session,
      messages: messages || []
    });

  } catch (err: any) {
    console.error("GET /api/chat/sessions/[sessionId] error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * PUT /api/chat/sessions/[sessionId]
 * Update a chat session
 */
export async function PUT(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);
    
    const { sessionId } = params;
    const { title, context } = await req.json();

    // Update session via service layer
    const session = await updateChatSession(sessionId, user.id, {
      title,
      context
    });

    if (!session) {
      return fail("Session not found or update failed", 404);
    }

    return success({ 
      session,
      message: "Session updated successfully"
    });

  } catch (err: any) {
    console.error("PUT /api/chat/sessions/[sessionId] error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * DELETE /api/chat/sessions/[sessionId]
 * Delete a chat session and all its messages
 */
export async function DELETE(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);
    
    const { sessionId } = params;

    // Delete session via service layer (messages will be deleted due to CASCADE)
    const deleted = await deleteChatSession(sessionId, user.id);

    if (!deleted) {
      return fail("Session not found or delete failed", 404);
    }

    return success({ 
      message: "Session deleted successfully"
    });

  } catch (err: any) {
    console.error("DELETE /api/chat/sessions/[sessionId] error:", err);
    return fail(err.message || "Server error", 500);
  }
}
