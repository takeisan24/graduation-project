/**
 * API Route: AI Video Project Retry
 * 
 * POST: Retry a failed AI Video Production project
 */

import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";
import { retryAiVideoProject } from "@/lib/services/ai/aiVideoProjectService";

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth(req);
        if (!user) return fail("Unauthorized", 401);

        const body = await req.json();
        const { projectId } = body;

        if (!projectId) {
            return fail("Project ID is required", 400);
        }

        const result = await retryAiVideoProject(req, projectId, user.id);

        if (!result.success) {
            return fail(result.error || "Failed to retry project", result.status || 500);
        }

        return success({ message: "Retry initiated successfully" });
    } catch (err: any) {
        console.error("POST /api/ai/video-projects/retry error:", err);
        return fail("Internal Server Error", 500);
    }
}
