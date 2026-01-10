/**
 * API Route: AI Video Projects
 * 
 * POST: Initialize a new AI Video Production project
 * GET: List user's AI Video Projects
 */

import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";
import { createAiVideoProject } from "@/lib/services/ai/aiVideoProjectService";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * GET /api/ai/video-projects
 * List user projects or get specific one via ?id=
 */
export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth(req);
        if (!user) return fail("Unauthorized", 401);

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (id) {
            const { data: project, error } = await supabaseClient
                .from('ai_video_projects')
                .select('*')
                .eq('id', id)
                .eq('user_id', user.id)
                .single();

            if (error) return fail("Project not found", 404);
            return success(project);
        }

        const { data: projects, error } = await supabaseClient
            .from('ai_video_projects')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return success(projects);
    } catch (err: any) {
        console.error("GET /api/ai/video-projects error:", err);
        return fail("Internal Server Error", 500);
    }
}

/**
 * POST /api/ai/video-projects
 */
export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth(req);
        if (!user) return fail("Unauthorized", 401);

        const body = await req.json();
        const { description, negativePrompt, duration, aspectRatio, resolution } = body;

        const result = await createAiVideoProject(req, {
            description,
            negativePrompt,
            duration,
            aspectRatio,
            resolution,
            userId: user.id
        });

        if (!result.success) {
            return fail(result.error || "Failed to create project", result.status || 500);
        }

        // ✅ NEW: Return creditsRemaining for instant FE UI update
        return success({
            project: result.project,
            creditsRemaining: result.creditsRemaining
        });
    } catch (err: any) {
        console.error("POST /api/ai/video-projects error:", err);
        return fail("Internal Server Error", 500);
    }
}
/**
 * DELETE /api/ai/video-projects
 */
export async function DELETE(req: NextRequest) {
    try {
        const user = await requireAuth(req);
        if (!user) return fail("Unauthorized", 401);

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return fail("Missing project ID", 400);

        // ✅ Use Service to delete (Proxies to JQM to stop worker)
        const { deleteAiVideoProject } = await import("@/lib/services/ai/aiVideoProjectService");
        const result = await deleteAiVideoProject(id, user.id);

        if (!result.success) {
            console.error("[DELETE /api/ai/video-projects] Error:", result.error);
            return fail(result.error || "Failed to delete project", result.status || 500);
        }

        return success({ message: "Project deleted successfully" });
    } catch (err: any) {
        console.error("DELETE /api/ai/video-projects error:", err);
        return fail("Internal Server Error", 500);
    }
}
