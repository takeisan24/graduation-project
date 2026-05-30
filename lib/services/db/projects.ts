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

interface ProjectWithDraftRows extends Project {
  content_drafts: ContentDraft[] | null;
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
  
  const normalizedData = data as ProjectWithDraftRows | null;
  if (!normalizedData) {
    return null;
  }

  return {
    ...normalizedData,
    content_drafts: Array.isArray(normalizedData.content_drafts) ? normalizedData.content_drafts : [],
  };
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
 * Get all drafts by user_id across projects
 */
export async function getDraftsByUserId(userId: string): Promise<ContentDraft[]> {
  const { data, error } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[db/projects] Error getting drafts by user:", error);
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
 * Update project (e.g. đổi tên). Chỉ cập nhật khi đúng chủ sở hữu.
 */
export async function updateProject(
  projectId: string,
  userId: string,
  updates: { name?: string; description?: string | null }
): Promise<Project | null> {
  const patch: Record<string, unknown> = {};
  if (typeof updates.name === "string") {
    const name = updates.name.replace(/\s+/g, " ").trim().slice(0, 80);
    if (name) patch.name = name;
  }
  if (updates.description !== undefined) patch.description = updates.description;

  if (Object.keys(patch).length === 0) {
    return getProjectById(projectId, userId);
  }

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[db/projects] Error updating project:", error);
    return null;
  }

  return data;
}

/**
 * Delete project + toàn bộ dữ liệu liên quan.
 *
 * content_drafts có ON DELETE CASCADE theo project_id, nhưng scheduled_posts
 * tham chiếu content_drafts(id) KHÔNG có cascade — nên phải xoá scheduled_posts
 * của các draft thuộc project trước, tránh vướng khoá ngoại khi xoá project.
 */
export async function deleteProject(projectId: string, userId: string): Promise<boolean> {
  // Xác thực quyền sở hữu trước
  const project = await getProjectById(projectId, userId);
  if (!project) {
    return false;
  }

  // Lấy id các draft thuộc project để dọn scheduled_posts liên quan
  const { data: draftRows, error: draftErr } = await supabase
    .from("content_drafts")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (draftErr) {
    console.error("[db/projects] Error listing drafts before delete:", draftErr);
    return false;
  }

  const draftIds = (draftRows || []).map((row) => (row as { id: string }).id);
  if (draftIds.length > 0) {
    const { error: spErr } = await supabase
      .from("scheduled_posts")
      .delete()
      .in("draft_id", draftIds)
      .eq("user_id", userId);

    if (spErr) {
      console.error("[db/projects] Error deleting scheduled posts of project drafts:", spErr);
      return false;
    }
  }

  // Xoá project — content_drafts (và các bảng cascade theo nó) tự dọn
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) {
    console.error("[db/projects] Error deleting project:", error);
    return false;
  }

  return true;
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
 * Recalculate a draft status from its related scheduled posts.
 *
 * Priority:
 * - any scheduled/publishing post => draft stays scheduled
 * - otherwise any posted post => draft becomes posted
 * - otherwise any failed post => draft becomes failed
 * - otherwise no related posts => draft returns to draft
 */
export async function syncDraftStatusFromScheduledPosts(
  draftId: string,
  userId: string
): Promise<ContentDraft | null> {
  const draft = await getDraftById(draftId, userId);
  if (!draft) {
    return null;
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("status, scheduled_at")
    .eq("draft_id", draftId)
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("[db/projects] Error syncing draft status from scheduled posts:", error);
    return null;
  }

  const relatedPosts = (data || []) as Array<{
    status: "scheduled" | "publishing" | "posted" | "failed" | "cancelled";
    scheduled_at: string | null;
  }>;

  let nextStatus: ContentDraft["status"] = "draft";
  let nextScheduledAt: string | null = null;

  const activePost = relatedPosts.find(
    (post) => post.status === "scheduled" || post.status === "publishing"
  );

  if (activePost) {
    nextStatus = "scheduled";
    nextScheduledAt = activePost.scheduled_at ?? draft.scheduled_at ?? null;
  } else if (relatedPosts.some((post) => post.status === "posted")) {
    nextStatus = "posted";
  } else if (relatedPosts.some((post) => post.status === "failed")) {
    nextStatus = "failed";
  }

  const updated = await updateDraft(draftId, userId, {
    status: nextStatus,
    scheduled_at: nextScheduledAt,
  });

  if (!updated) {
    return null;
  }

  return getDraftById(draftId, userId);
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

