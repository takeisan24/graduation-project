/**
 * Database Service: Projects
 * 
 * Handles all database operations related to projects and content_drafts tables
 */

import { supabase } from "@/lib/supabase";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_type: string;
  source_content: string | null;
  created_at: string;
}

export interface ContentDraft {
  id: string;
  project_id: string;
  user_id: string;
  platform: string | null;
  text_content: string | null;
  media_urls: string[];
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get project by ID
 */
export async function getProjectById(projectId: string, userId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) {
    console.error("[db/projects] Error getting project:", error);
    return null;
  }
  
  return data;
}

/**
 * Get project with drafts
 */
export async function getProjectWithDrafts(projectId: string, userId: string): Promise<(Project & { content_drafts: ContentDraft[] }) | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, content_drafts(*)")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();
  
  if (error) {
    console.error("[db/projects] Error getting project with drafts:", error);
    return null;
  }
  
  return data as any;
}

/**
 * Get drafts by project_id
 */
export async function getDraftsByProjectId(projectId: string, userId: string): Promise<ContentDraft[]> {
  const { data, error } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  
  if (error) {
    console.error("[db/projects] Error getting drafts:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Get draft by ID
 */
export async function getDraftById(draftId: string, userId: string): Promise<ContentDraft | null> {
  const { data, error } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) {
    console.error("[db/projects] Error getting draft:", error);
    return null;
  }
  
  return data;
}

/**
 * Get all projects by user_id
 */
export async function getProjectsByUserId(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("[db/projects] Error getting projects:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Create project
 */
export async function createProject(data: {
  user_id: string;
  name: string;
  description?: string | null;
  source_type?: string;
  source_content?: string | null;
}): Promise<Project | null> {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: data.user_id,
      name: data.name,
      description: data.description || null,
      source_type: data.source_type || 'prompt',
      source_content: data.source_content || null
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/projects] Error creating project:", error);
    return null;
  }
  
  return project;
}

/**
 * Create draft
 */
export async function createDraft(data: {
  project_id: string;
  user_id: string;
  platform?: string | null;
  text_content?: string | null;
  media_urls?: string[];
  status?: 'draft' | 'scheduled' | 'posted' | 'failed';
  scheduled_at?: string | null;
}): Promise<ContentDraft | null> {
  const { data: draft, error } = await supabase
    .from("content_drafts")
    .insert({
      project_id: data.project_id,
      user_id: data.user_id,
      platform: data.platform || null,
      text_content: data.text_content || null,
      media_urls: data.media_urls || [],
      status: data.status || 'draft',
      scheduled_at: data.scheduled_at || null
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/projects] Error creating draft:", error);
    return null;
  }
  
  return draft;
}

/**
 * Update draft
 */
export async function updateDraft(
  draftId: string,
  userId: string,
  updates: Partial<ContentDraft>
): Promise<boolean> {
  const { error } = await supabase
    .from("content_drafts")
    .update(updates)
    .eq("id", draftId)
    .eq("user_id", userId);
  
  if (error) {
    console.error("[db/projects] Error updating draft:", error);
    return false;
  }
  
  return true;
}

/**
 * Delete draft
 */
export async function deleteDraft(draftId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("content_drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", userId);
  
  if (error) {
    console.error("[db/projects] Error deleting draft:", error);
    return false;
  }
  
  return true;
}

