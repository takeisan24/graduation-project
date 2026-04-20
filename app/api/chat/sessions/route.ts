import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getChatSessionsByUserId, createChatSession } from "@/lib/services/db/chatSessions";
import { getProjectById } from "@/lib/services/db/projects";
import { getDraftById } from "@/lib/services/db/projects";

/**
 * GET /api/chat/sessions
 * Get all chat sessions for the user
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);
    
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const draftId = searchParams.get('draftId') || undefined;
    
    // Get chat sessions via service layer
    const sessions = await getChatSessionsByUserId(user.id, {
      context,
      projectId,
      draftId,
      limit: 50
    });

    return success({ 
      sessions: sessions || [],
      total: sessions?.length || 0
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/chat/sessions error:", message);
    return fail(message, 500);
  }
}

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);
    
    const { 
      context = 'general',
      projectId,
      draftId,
      title
    } = await req.json();

    // Validate context
    const validContexts = ['general', 'project', 'draft', 'workspace'];
    if (!validContexts.includes(context)) {
      return fail("Invalid context. Must be one of: " + validContexts.join(', '), 400);
    }

    // Verify project ownership if projectId provided
    if (projectId) {
      const project = await getProjectById(projectId, user.id);
      if (!project) {
        return fail("Project not found", 404);
      }
    }

    // Verify draft ownership if draftId provided
    if (draftId) {
      const draft = await getDraftById(draftId, user.id);
      if (!draft) {
        return fail("Draft not found", 404);
      }
    }

    // Create session via service layer
    const session = await createChatSession({
      user_id: user.id,
      context,
      project_id: projectId || null,
      draft_id: draftId || null,
      title: title || null
    });

    if (!session) {
      return fail("Failed to create chat session", 500);
    }

    return success({ 
      session,
      message: "Chat session created successfully"
    }, 201);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/chat/sessions error:", message);
    return fail(message, 500);
  }
}
