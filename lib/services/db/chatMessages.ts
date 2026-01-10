/**
 * Database Service: Chat Messages
 * 
 * Handles all database operations related to chat_messages table
 */

import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  session_id: string | null;
  draft_id: string | null;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  context?: string;
  content_type?: string;
  platform?: string;
  created_at: string;
}

/**
 * Get chat messages by draft_id
 */
export async function getChatMessagesByDraftId(
  draftId: string,
  limit: number = 50
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: true })
    .limit(limit);
  
  if (error) {
    console.error("[db/chatMessages] Error getting chat messages:", error);
    return [];
  }
  
  return (data || []).map((message) => ({
    role: message.role as 'user' | 'assistant',
    content: message.content
  }));
}

/**
 * Count user messages by draft_id
 */
export async function countUserMessagesByDraftId(draftId: string): Promise<number> {
  const { count, error } = await supabase
    .from("chat_messages")
    .select("*", { count: 'exact', head: true })
    .eq("draft_id", draftId)
    .eq("role", "user");
  
  if (error) {
    console.error("[db/chatMessages] Error counting user messages:", error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Get chat messages by session_id
 */
export async function getChatMessagesBySessionId(
  sessionId: string,
  limit: number = 100
): Promise<Array<{ role: string; content: string }>> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  
  if (error) {
    console.error("[db/chatMessages] Error getting chat messages by session:", error);
    return [];
  }
  
  return (data || []) as Array<{ role: string; content: string }>;
}

/**
 * Get chat messages by session_id or draft_id
 * Note: project_id is not stored in chat_messages. Use session_id to query messages for a project.
 * If projectId is provided, it will be ignored. Use sessionId from chat_sessions instead.
 */
export async function getChatMessagesByContext(
  options: {
    sessionId?: string;
    projectId?: string; // Deprecated: project_id is not in chat_messages table. Use sessionId instead.
    draftId?: string;
    userId: string;
    limit?: number;
  }
): Promise<Array<{ id: string; role: string; content: string; created_at: string; context?: string; content_type?: string; platform?: string }>> {
  let query = supabase
    .from("chat_messages")
    .select("id, role, content, created_at, context, content_type, platform")
    .eq("user_id", options.userId)
    .order("created_at", { ascending: true });

  if (options.sessionId) {
    query = query.eq("session_id", options.sessionId);
  } else if (options.draftId) {
    query = query.eq("draft_id", options.draftId);
  }
  // Note: projectId is ignored - chat_messages table doesn't have project_id column
  // To get messages for a project, query by sessionId from chat_sessions table

  const limit = options.limit || 100;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[db/chatMessages] Error getting chat messages:", error);
    return [];
  }

  return (data || []) as Array<{ id: string; role: string; content: string; created_at: string; context?: string; content_type?: string; platform?: string }>;
}

/**
 * Count user messages by session_id
 */
export async function countUserMessagesBySessionId(sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("chat_messages")
    .select("*", { count: 'exact', head: true })
    .eq("session_id", sessionId)
    .eq("role", "user");
  
  if (error) {
    console.error("[db/chatMessages] Error counting user messages:", error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Create chat message
 * Note: project_id is not stored in chat_messages table. Use session_id to link messages to projects.
 */
export async function createChatMessage(data: {
  session_id?: string | null;
  draft_id?: string | null;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  context?: string;
  content_type?: string;
  platform?: string;
}): Promise<ChatMessage | null> {
  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: data.session_id || null,
      draft_id: data.draft_id || null,
      user_id: data.user_id,
      role: data.role,
      content: data.content,
      context: data.context,
      content_type: data.content_type,
      platform: data.platform
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/chatMessages] Error creating chat message:", error);
    return null;
  }
  
  return message;
}

