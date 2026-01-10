import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { rollbackCredits } from "@/lib/usage";
import { supabaseClient } from "@/lib/supabaseClient";
import * as crypto from "crypto";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * POST /api/webhooks/video
 * 
 * Receiver for job status updates from Server B (JQM).
 * Handles automated refunds on job failure.
 */
export async function POST(req: NextRequest) {
    try {
        const payload = await req.text();
        const signature = req.headers.get("X-Webhook-Signature");

        // 1. Verify Signature
        if (WEBHOOK_SECRET && signature) {
            const expectedSignature = crypto
                .createHmac("sha256", WEBHOOK_SECRET)
                .update(payload)
                .digest("hex");

            const isValid = crypto.timingSafeEqual(
                Buffer.from(signature) as any,
                Buffer.from(expectedSignature) as any
            );

            if (!isValid) {
                console.error("[Webhook] Invalid signature");
                return fail("Invalid signature", 401);
            }
        }

        const data = JSON.parse(payload);
        const { jobId, userId, status, metadata, error } = data;
        const { result } = data;

        // ✅ Robustness: Handle both flattened and double-nested results
        let finalResult = result;
        if (result && result.result && typeof result.result === 'object' && !Array.isArray(result.result)) {
            console.log(`[Webhook] Detected nested result for job ${jobId}, flattening...`);
            finalResult = result.result;
        }

        console.log(`[Webhook] Received update for job ${jobId}: ${status}`, { userId, metadata });

        // 2. Handle Failure -> Trigger Refund
        if (status === 'failed') {
            const isBilled = metadata?.credit_held === true;
            const amount = metadata?.deducted_amount;
            const actionType = metadata?.action_type || 'VIDEO_PROCESSING';

            if (isBilled && amount > 0) {
                // ✅ IDEMPOTENCY CHECK: Ensure we haven't already refunded for this jobId
                const { data: existingRollback } = await supabaseClient
                    .from('credit_transactions')
                    .select('id')
                    .eq('user_id', userId)
                    .contains('metadata', { jobId, rollback: true })
                    .limit(1)
                    .single();

                if (existingRollback) {
                    console.log(`[Webhook] Job ${jobId} already refunded. Skipping.`);
                    return success({ received: true, already_refunded: true });
                }

                console.info(`[Webhook] Job ${jobId} failed. Refunding ${amount} credits to user ${userId}`);

                const refundResult = await rollbackCredits(userId, actionType, {
                    reason: 'worker_job_failed',
                    jobId,
                    server_b_error: error?.message || 'Unknown error',
                    metadata
                }, amount);

                if (refundResult.success) {
                    console.log(`[Webhook] Successfully refunded credits for job ${jobId}`);
                } else {
                    console.error(`[Webhook] Failed to refund credits for job ${jobId}: ${refundResult.reason}`);
                }
            }
        }

        // 2.5. Media Library writes (media_assets) are now owned by Server B (JQM) workers.
        // This webhook no longer creates or updates media_assets rows to avoid
        // duplicate entries and split ownership of Video Factory data.

        // 2.6. Partial refund per failed clip (video_factory only)
        // NOTE:
        // - We only refund when job is COMPLETED but individual clips FAILED.
        // - We rely on per_clip_cost metadata set at job creation time via /api/video-factory/postprocess.
        const perClipCost = metadata?.per_clip_cost;
        const selectedClipKeys: string[] = metadata?.selected_clip_keys || [];

        if (status === 'completed' && Array.isArray(finalResult?.clips) && perClipCost && perClipCost > 0) {
            for (let idx = 0; idx < finalResult.clips.length; idx++) {
                const clip: any = finalResult.clips[idx];
                const rawStatus = (clip.status || '').toUpperCase();
                const clipKey = clip.clipKey || clip.originalClipKey || selectedClipKeys[idx];

                // Only treat explicit FAILED as refundable here. Do NOT refund missing/PROCESSING clips immediately.
                if (rawStatus !== 'FAILED' || !clipKey) {
                    continue;
                }

                const idempotencyMetadata = {
                    jobId,
                    clipKey,
                    rollback: true,
                    scope: 'clip',
                };

                const { data: existingClipRollback } = await supabaseClient
                    .from('credit_transactions')
                    .select('id')
                    .eq('user_id', userId)
                    .contains('metadata', idempotencyMetadata)
                    .limit(1)
                    .maybeSingle();

                if (existingClipRollback) {
                    console.log(`[Webhook] Clip ${clipKey} for job ${jobId} already refunded. Skipping partial refund.`);
                    continue;
                }

                try {
                    const refundMeta = {
                        reason: 'postprocess_clip_failed',
                        jobId,
                        clipKey,
                        rollback: true,
                        scope: 'clip',
                        failure_status: rawStatus,
                    };

                    const refundResult = await rollbackCredits(
                        userId,
                        'VIDEO_PROCESSING',
                        refundMeta,
                        perClipCost
                    );

                    if (refundResult.success) {
                        console.log(`[Webhook] Partially refunded credits for failed clip ${clipKey} of job ${jobId}`);
                    } else {
                        console.error(
                            `[Webhook] Failed to partially refund credits for clip ${clipKey} of job ${jobId}: ${refundResult.reason}`
                        );
                    }
                } catch (partialRefundError: any) {
                    console.error(
                        `[Webhook] Error during partial refund for clip ${clipKey} of job ${jobId}:`,
                        partialRefundError
                    );
                }
            }
        }

        // 3. Update Project Status in DB
        if (metadata?.projectId || metadata?.project_id) {
            const pid = metadata.projectId || metadata.project_id;
            console.log(`[webhooks/video] Updating project ${pid} status to ${status}`);

            // 3.1 Try updating ai_video_projects (Text-to-Video)
            const { error: dbError1 } = await supabaseClient
                .from('ai_video_projects')
                .update({
                    status: status === 'completed' ? 'DONE' : status === 'failed' ? 'FAILED' : 'PROCESSING',
                    progress: status === 'completed' ? 100 : undefined,
                    final_video_url: (status === 'completed' && result?.final_video_url) ? result.final_video_url : undefined,
                    final_video_s3_key: (status === 'completed' && result?.final_storage_key) ? result.final_storage_key : undefined,
                    // ✅ Capture failure reason in config_data/metadata if it exists
                    config_data: status === 'failed' ? {
                        ...(finalResult?.config_data || {}),
                        failure_reason: error?.message || finalResult?.error?.message || 'Unknown error'
                    } : undefined
                } as any)
                .eq('id', pid)
                .eq('user_id', userId);

            // 3.2 Try updating video_factory_projects (Video Factory/Postprocess)
            const { error: dbError2 } = await supabaseClient
                .from('video_factory_projects')
                .update({
                    status: status === 'completed' ? 'ready' : status === 'failed' ? 'failed' : 'processing',
                    final_video_url: (status === 'completed' && result?.final_video_url) ? result.final_video_url : undefined,
                    // ✅ CRITICAL: Persist clips even on failure so FE can display which clips failed and why
                    output_clips: result?.clips || finalResult?.clips || undefined,
                })
                .eq('id', pid)
                .eq('user_id', userId);

            if (dbError1 && dbError2) {
                console.warn(`[webhooks/video] Error updating project ${pid} in both tables:`, { dbError1: dbError1.message, dbError2: dbError2.message });
            }
        }

        return success({ received: true });
    } catch (err: any) {
        console.error("[Webhook] Error processing webhook:", err);
        return fail("Internal Server Error", 500);
    }
}
