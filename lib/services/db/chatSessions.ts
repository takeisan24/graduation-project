/**
 * Database Service: Chat Sessions
 * 
 * Handles all database operations related to chat_sessions table
 */

import { supabase } from "@/lib/supabase";

export interface ChatSession {
  id: string;
  user_id: string;
  context: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  draft_id: string | null;
}

export interface ChatSessionWithRelations extends ChatSession {
  projects?: {
    id: string;
    source_content: string;
    source_type: string;
  } | null;
  content_drafts?: {
    id: string;
    platform: string;
    text_content: string;
  } | null;
}

/**
 * Get chat session by ID with ownership check
 */
export async function getChatSessionById(
  sessionId: string,
  userId: string
): Promise<ChatSessionWithRelations | null> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select(`
      id,
      user_id,
      context,
      title,
      created_at,
      updated_at,
      project_id,
      draft_id,
      projects(id, source_content, source_type),
      content_drafts(id, platform, text_content)
    `)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    console.error("[db/chatSessions] Error getting chat session:", error);
    return null;
  }

  const projectData = Array.isArray(data.projects) ? data.projects[0] : data.projects;
  const draftData = Array.isArray(data.content_drafts) ? data.content_drafts[0] : data.content_drafts;

  const normalizedSession: ChatSessionWithRelations = {
    id: data.id,
    user_id: data.user_id,
    context: data.context,
    title: data.title,
    created_at: data.created_at,
    updated_at: data.updated_at,
    project_id: data.project_id,
    draft_id: data.draft_id,
    projects: projectData
      ? {
          id: String(projectData.id ?? ""),
          source_content: projectData.source_content ?? "",
          source_type: projectData.source_type ?? ""
        }
      : null,
    content_drafts: draftData
      ? {
          id: String(draftData.id ?? ""),
          platform: draftData.platform ?? "",
          text_content: draftData.text_content ?? ""
        }
      : null
  };

  return normalizedSession;
}

/**
 * Get chat sessions by user ID with optional filters
 */
export async function getChatSessionsByUserId(
  userId: string,
  options?: {
    context?: string;
    projectId?: string;
    draftId?: string;
    limit?: number;
  }
): Promise<ChatSessionWithRelations[]> {
  let query = supabase
    .from("chat_sessions")
    .select(`
      id,
      context,
      title,
      created_at,
      updated_at,
      project_id,
      draft_id,
      projects!inner(id, source_content, source_type),
      content_drafts!inner(id, platform, text_content)
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (options?.context) {
    query = query.eq("context", options.context);
  }
  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }
  if (options?.draftId) {
    query = query.eq("draft_id", options.draftId);
  }

  const limit = options?.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[db/chatSessions] Error getting chat sessions:", error);
    return [];
  }

  const normalizedSessions: ChatSessionWithRelations[] = (data || []).map((session: any) => {
    const projectData = Array.isArray(session.projects) ? session.projects[0] : session.projects;
    const draftData = Array.isArray(session.content_drafts) ? session.content_drafts[0] : session.content_drafts;

    return {
      id: String(session.id),
      user_id: userId,
      context: session.context,
      title: session.title,
      created_at: session.created_at,
      updated_at: session.updated_at,
      project_id: session.project_id,
      draft_id: session.draft_id,
      projects: projectData
        ? {
            id: String(projectData.id ?? ""),
            source_content: projectData.source_content ?? "",
            source_type: projectData.source_type ?? ""
          }
        : null,
      content_drafts: draftData
        ? {
            id: String(draftData.id ?? ""),
            platform: draftData.platform ?? "",
            text_content: draftData.text_content ?? ""
          }
        : null
    };
  });

  return normalizedSessions;
}

/**
 * Create chat session
 */
export async function createChatSession(data: {
  user_id: string;
  context?: string;
  project_id?: string | null;
  draft_id?: string | null;
  title?: string | null;
}): Promise<ChatSession | null> {
  const { data: session, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: data.user_id,
      context: data.context || 'general',
      project_id: data.project_id || null,
      draft_id: data.draft_id || null,
      title: data.title || `${(data.context || 'general').charAt(0).toUpperCase() + (data.context || 'general').slice(1)} Chat`
    })
    .select()
    .single();

  if (error) {
    console.error("[db/chatSessions] Error creating chat session:", error);
    return null;
  }

  return session;
}

/**
 * Update chat session
 */
export async function updateChatSession(
  sessionId: string,
  userId: string,
  updates: {
    title?: string;
    context?: string;
  }
): Promise<ChatSession | null> {
  const updateData: any = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.context !== undefined) updateData.context = updates.context;

  const { data: session, error } = await supabase
    .from("chat_sessions")
    .update(updateData)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[db/chatSessions] Error updating chat session:", error);
    return null;
  }

  return session;
}

/**
 * Delete chat session (messages will be deleted due to CASCADE)
 */
export async function deleteChatSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    console.error("[db/chatSessions] Error deleting chat session:", error);
    return false;
  }

  return true;
}

