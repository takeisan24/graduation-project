/**
 * POST /api/webhooks/processing
 * Handle webhook notifications from Server B (JQM) about job completion/failure
 * 
 * Flow:
 * 1. Server B completes job → sends webhook to this endpoint
 * 2. Server A verifies signature → updates job status in DB
 * 3. Server A can notify user, update credits, etc.
 */

import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { createHmac, timingSafeEqual } from "crypto";
import { rollbackCredits, trackUsage } from "@/lib/usage";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.SERVER_B_API_KEY || '';

/**
 * Verify webhook signature from Server B
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[webhooks/processing] No webhook secret configured, skipping signature verification");
    return true; // Allow in development if no secret set
  }

  if (!signature || !timestamp) {
    console.warn("[webhooks/processing] Missing signature or timestamp headers");
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minutes window)
  const requestTime = new Date(timestamp).getTime();
  const currentTime = Date.now();
  const timeDiff = Math.abs(currentTime - requestTime);

  if (timeDiff > 5 * 60 * 1000) {
    console.warn("[webhooks/processing] Timestamp too old or too far in future", { timestamp, timeDiff });
    return false;
  }

  // Generate expected signature
  const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Compare signatures using timing-safe comparison
  try {
    const isValid = timingSafeEqual(
      Buffer.from(signature) as any,
      Buffer.from(expectedSignature) as any
    );

    if (!isValid) {
      console.warn("[webhooks/processing] Invalid signature", { signature, expectedSignature });
    }

    return isValid;
  } catch (error) {
    console.error("[webhooks/processing] Signature comparison error", error);
    return false;
  }
}

/**
 * POST /api/webhooks/processing
 * Receive webhook from Server B about job status updates
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Get signature and timestamp from headers
    const signature = req.headers.get('x-webhook-signature') || '';
    const timestamp = req.headers.get('x-webhook-timestamp') || '';

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
      console.error("[webhooks/processing] Invalid webhook signature");
      return fail("Invalid webhook signature", 401);
    }

    const { jobId, userId, status, result, error, progress, timestamp: webhookTimestamp, step, metadata } = body;

    console.log("[webhooks/processing] Webhook received", {
      jobId,
      userId,
      status,
      step,
      progress,
      hasResult: !!result,
      hasError: !!error,
    });

    // ✅ CRITICAL: Refund credits if job failed and credits were held upfront (Text-to-Video, Video Factory, etc.)
    if (status === "failed" || status === "cancelled") {
      const jobMetadata = (metadata || {}) as Record<string, any>;
      if (jobMetadata.credit_held === true) {
        const actionType = (jobMetadata.action_type as any) || (step === "postprocess" ? "VIDEO_PROCESSING" : "TEXT_TO_VIDEO");
        const refundAmount = jobMetadata.deducted_amount;

        console.log(
          `[webhooks/processing] Job ${jobId} failed (${status}) - refunding held credits to user ${userId}. Action: ${actionType}, Amount: ${refundAmount}`
        );
        try {
          const refundResult = await rollbackCredits(userId, actionType, {
            reason: "job_failed_or_cancelled",
            job_id: jobId,
            status,
            error: error || "Unknown error",
            ...jobMetadata,
          }, refundAmount);

          if (refundResult.success) {
            console.log(
              `[webhooks/processing] Successfully refunded credits for failed job ${jobId}`
            );

            // Also decrement stats if it was a project-counted job
            if (actionType === 'TEXT_TO_VIDEO' || step === 'text-to-video') {
              await trackUsage(userId, 'text_to_video_generated', -1);
            }
          } else {
            console.error(
              `[webhooks/processing] Failed to refund credits: ${refundResult.reason}`
            );
          }
        } catch (refundError: any) {
          console.error(
            `[webhooks/processing] Error refunding credits for failed job:`,
            refundError
          );
        }
      }
    }

    // TODO: Update job status, credits, realtime notify (omitted here for brevity)

    // ✅ Robustness: Handle both flattened and double-nested results
    let finalResult = result;
    if (result && result.result && typeof result.result === 'object' && !Array.isArray(result.result)) {
      console.log(`[webhooks/processing] Detected nested result for job ${jobId}, flattening...`);
      finalResult = result.result;
    }

    // Insert media assets for completed jobs (video_factory)
    // NOTE:
    // - This webhook is a generic processing webhook that can be used by multiple pipelines.
    // - For video factory/postprocess flows, we still want media_assets rows to carry
    //   enough metadata for FE to group clips by postprocessJobId.
    // NOTE:
    // - As of 2026-03, all media_assets rows for Video Factory/postprocess flows
    //   are created and owned by Server B (JQM) workers.
    // - This webhook no longer writes to media_assets directly to avoid
    //   duplicate rows and split ownership of the Media Library data.

    return success({
      received: true,
      jobId,
      status,
      message: "Webhook received successfully",
      warnings: result?.warnings || result?.output_data?.warnings || [],
    });
  } catch (err: any) {
    console.error("[webhooks/processing] Webhook processing error:", err);
    return fail("Webhook processing failed", 500);
  }
}

