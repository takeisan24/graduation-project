/**
 * Service: AI Video Project
 * 
 * Handles orchestrating AI Video Production Pipeline projects:
 * - Credit verification and deduction
 * - Database project initialization
 * - Redis job dispatching
 */

import { NextRequest } from "next/server";
import { deductCredits, rollbackCredits, trackUsage } from "@/lib/usage";
import { supabaseClient } from "@/lib/supabaseClient";
import { withApiProtection } from "@/lib/middleware/api-protected";
import { PLAN_ERRORS } from "@/lib/messages/errors";
import { AiVideoProject } from "@/lib/types/video";

export interface CreateAiVideoProjectRequest {
    description: string;
    negativePrompt?: string;
    duration: number;
    aspectRatio: string;
    resolution?: '720p' | '1080p';
    userId: string;
    estimatedCredits?: number; // ✅ NEW: FE can send pre-calculated credits
}

/**
 * Initialize an AI Video Project and dispatch to worker
 */
export async function createAiVideoProject(
    req: NextRequest,
    request: CreateAiVideoProjectRequest
): Promise<{ success: boolean; project?: any; creditsRemaining?: number; error?: string; status?: number }> {
    const {
        description,
        negativePrompt,
        duration,
        aspectRatio = '16:9',
        resolution = '1080p',
        userId,
        estimatedCredits: requestEstimatedCredits
    } = request;

    if (!description) {
        return { success: false, error: "Description is required", status: 400 };
    }

    // ✅ NEW: Use estimatedCredits from FE if provided, otherwise calculate (backward compatibility)
    const estimatedCredits = requestEstimatedCredits ??
        (duration === 8 ? 16 : duration === 15 ? 30 : duration === 30 ? 60 : duration === 60 ? 120 : duration * 2);

    // 1. Protection & Authentication Check
    const { checkCreditPaywall } = await import("@/lib/paywall");
    const paywallResult = await checkCreditPaywall(userId, 'TEXT_TO_VIDEO');

    if (!paywallResult.allowed) {
        return {
            success: false,
            error: paywallResult.reason || "Insufficient credits",
            status: 403
        };
    }

    // 2. Plan Check (Free plan no video)
    const { getUserPlanAndCredits } = await import("@/lib/services/db/users");
    const userPlanData = await getUserPlanAndCredits(userId);
    const userPlan = userPlanData?.plan || 'free';

    if (userPlan === 'free') {
        const { PLAN_ERRORS } = await import("@/lib/messages/errors");
        return {
            success: false,
            error: PLAN_ERRORS.FREE_PLAN_NO_VIDEO_GENERATION,
            status: 403
        };
    }

    // ✅ 3. UPFRONT CREDIT DEDUCTION
    const creditResult = await deductCredits(userId, 'TEXT_TO_VIDEO', {
        description: description.substring(0, 50),
        duration,
        aspectRatio,
        source: 'text-to-video'
    }, undefined, estimatedCredits);

    if (!creditResult.success) {
        return {
            success: false,
            error: creditResult.reason || "Insufficient credits",
            status: 403
        };
    }

    // ✅ NEW: Get updated credits for instant FE update (reuse existing getUserPlanAndCredits from line 60)
    const userCredits = await getUserPlanAndCredits(userId);
    const creditsRemaining = userCredits?.credits_balance ?? 0;

    // 4. Database Project Initialization
    const { data: project, error: dbError } = await supabaseClient
        .from('ai_video_projects')
        .insert({
            user_id: userId,
            project_name: description.substring(0, 50),
            project_type: 'text-to-video',
            status: 'INIT',
            progress: 0,
            source_type: 'prompt',
            config_data: {
                userInput: {
                    description,
                    negativePrompt,
                    duration,
                    aspectRatio,
                    resolution
                },
                estimatedCredits,
                credit_held: true,
                deducted_amount: estimatedCredits
            }
        })
        .select()
        .single();

    if (dbError) {
        console.error("[AiVideoProjectService] DB Error - refunding credits:", dbError);
        // ROLLBACK CREDITS
        await rollbackCredits(userId, 'TEXT_TO_VIDEO', {
            reason: 'db_initialization_failed',
            error: dbError.message
        }, estimatedCredits);

        return { success: false, error: "Failed to initialize project in database", status: 500 };
    }

    // 5. Dispatch to Server B for processing
    try {
        const SERVER_B_URL = process.env.SERVER_B_URL;
        const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

        if (!SERVER_B_URL || !SERVER_B_API_KEY) {
            throw new Error("Server B is not configured correctly");
        }

        const response = await fetch(`${SERVER_B_URL}/api/v1/ai-video/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SERVER_B_API_KEY,
                'x-user-id': userId
            },
            body: JSON.stringify({
                projectId: project.id,
                userId: userId,
                // ✅ DYNAMIC CALLBACK: Use VIDEO_FACTORY_APP_URL for reliable server-to-server webhooks
                callbackUrl: `${process.env.VIDEO_FACTORY_APP_URL || 'http://localhost:3000'}/api/webhooks/video`,
                metadata: {
                    credit_held: true,
                    deducted_amount: estimatedCredits,
                    action_type: 'TEXT_TO_VIDEO',
                    projectId: project.id
                }
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || "Failed to notify Server B for processing");
        }

        console.log(`[AiVideoProjectService] Successfully notified Server B for project ${project.id}`);

        // Track usage (stats only)
        await trackUsage(userId, 'text_to_video_generated');

    } catch (apiError: any) {
        console.error("[AiVideoProjectService] Server B Proxy Error - refunding credits:", apiError);

        // ROLLBACK CREDITS
        await rollbackCredits(userId, 'TEXT_TO_VIDEO', {
            reason: 'server_b_dispatch_failed',
            error: apiError.message,
            project_id: project.id
        }, estimatedCredits);

        // Clean up project if dispatch fails (optional, keep it failed instead?)
        await supabaseClient.from('ai_video_projects').delete().eq('id', project.id);

        return {
            success: false,
            error: `Failed to start production: ${apiError.message}`,
            status: 500
        };
    }

    // ✅ NEW: Return creditsRemaining for instant FE UI update
    return { success: true, project, creditsRemaining };
}

/**
 * Retry a failed AI Video Project
 */
export async function retryAiVideoProject(
    req: NextRequest,
    projectId: string,
    userId: string
): Promise<{ success: boolean; error?: string; status?: number }> {
    try {
        // 1. Fetch project to check if we need to re-deduct credits
        const { data: project, error: fetchError } = await supabaseClient
            .from('ai_video_projects')
            .select('*')
            .eq('id', projectId)
            .eq('user_id', userId)
            .single();

        if (fetchError || !project) {
            return { success: false, error: "Project not found", status: 404 };
        }

        // 2. RE-DEDUCT CREDITS
        // When a project fails, a webhook automatically refunds the credits.
        // To prevent double usage (refund + resume), we must re-deduct here.
        const estimatedCredits = project.config_data?.deducted_amount || 30;
        const description = project.config_data?.userInput?.description || "AI Video Retry";

        const creditResult = await deductCredits(userId, 'TEXT_TO_VIDEO', {
            description: `Retry: ${description.substring(0, 40)}`,
            projectId,
            source: 'text-to-video-retry'
        }, undefined, estimatedCredits);

        if (!creditResult.success) {
            return {
                success: false,
                error: creditResult.reason || "Insufficient credits to resume",
                status: 403
            };
        }

        // 3. Mark project as credit-held again in metadata
        const updatedMetadata = {
            ...(project.metadata || {}),
            credit_held: true,
            deducted_amount: estimatedCredits,
            retry_count: (project.metadata?.retry_count || 0) + 1
        };

        const SERVER_B_URL = process.env.SERVER_B_URL;
        const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

        if (!SERVER_B_URL || !SERVER_B_API_KEY) {
            throw new Error("Server B is not configured correctly");
        }

        // Notify Server B to retry
        const response = await fetch(`${SERVER_B_URL}/api/v1/ai-video/retry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SERVER_B_API_KEY,
                'x-user-id': userId
            },
            body: JSON.stringify({
                projectId,
                userId,
                metadata: updatedMetadata
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || "Failed to notify Server B for retry");
        }

        console.log(`[AiVideoProjectService] Successfully notified Server B for retry of project ${projectId}`);
        return { success: true };

    } catch (apiError: any) {
        console.error("[AiVideoProjectService] Server B Retry Proxy Error:", apiError);
        return {
            success: false,
            error: `Failed to resume production: ${apiError.message}`,
            status: 500
        };
    }
}

/**
 * Delete an AI Video Project
 * Proxies to Server B to ensure worker is stopped before deletion
 */
export async function deleteAiVideoProject(
    projectId: string,
    userId: string
): Promise<{ success: boolean; error?: string; status?: number }> {
    try {
        const SERVER_B_URL = process.env.SERVER_B_URL;
        const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

        if (!SERVER_B_URL || !SERVER_B_API_KEY) {
            console.warn("Server B configuration missing, falling back to local delete");
            // Fallback: Delete locally if Server B config is missing (dev mode?)
            const { error } = await supabaseClient
                .from('ai_video_projects')
                .delete()
                .eq('id', projectId)
                .eq('user_id', userId);

            if (error) throw error;
            return { success: true };
        }

        const response = await fetch(`${SERVER_B_URL}/api/v1/ai-video/project?projectId=${projectId}&userId=${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SERVER_B_API_KEY,
                'x-user-id': userId
            }
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            // If 404, maybe it's already deleted or JQM doesn't have it.
            // We should try to delete locally just in case to ensure UI is clean.
            if (response.status === 404) {
                const { error } = await supabaseClient
                    .from('ai_video_projects')
                    .delete()
                    .eq('id', projectId)
                    .eq('user_id', userId);
                if (error) throw error;
                return { success: true };
            }
            throw new Error(result.error || "Failed to delete project on Server B");
        }

        return { success: true };

    } catch (error: any) {
        console.error("[AiVideoProjectService] Delete Error:", error);
        return { success: false, error: error.message, status: 500 };
    }
}
