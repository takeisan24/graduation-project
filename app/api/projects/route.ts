/**
 * GET /api/projects
 * Get all projects for user
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { getProjectsByUserId, createProject } from "@/lib/services/db/projects";

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuthOnly(req);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    // Get projects via service layer
    const projects = await getProjectsByUserId(user.id);
    
    return success(projects);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/projects error:", message);
    return fail(message, 500);
  }
}

/**
 * POST /api/projects
 * Create a new project
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

export async function POST(req: NextRequest) {
  try {
    const auth = await withAuthOnly(req);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    const body = await req.json().catch(() => ({} as any));
    let name = body?.name as string | undefined;
    const sourceType = (body?.sourceType || body?.source_type || 'prompt') as string;
    const sourceContent = (body?.sourceContent || body?.source_content || null) as string | null;

    // Provide a safe default for required projects.name
    if (!name) {
      try {
        if (sourceType === 'url' && typeof sourceContent === 'string') {
          const u = new URL(sourceContent);
          name = `Imported from ${u.hostname}`;
        } else if (sourceType === 'file') {
          name = 'Imported File Project';
        } else if (sourceType === 'prompt') {
          const snippet = (sourceContent || '').toString().slice(0, 40).trim();
          name = snippet ? `Prompt: ${snippet}` : 'Prompt Project';
        } else {
          name = 'Untitled Project';
        }
      } catch {
        name = 'Untitled Project';
      }
    }

    // Create project via service layer
    const project = await createProject({
      user_id: user.id,
      name,
      source_type: sourceType,
      source_content: sourceContent
    });

    if (!project) {
      return fail("Failed to create project", 500);
    }

    return success({ 
      id: project.id, 
      name: project.name, 
      source_type: project.source_type, 
      source_content: project.source_content, 
      created_at: project.created_at 
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/projects error:", message);
    return fail(message, 500);
  }
}
