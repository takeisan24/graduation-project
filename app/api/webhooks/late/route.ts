import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import crypto from "crypto";
import {
  findPostByLateJobId,
  extractWebhookData,
  isPostedStatus,
  isFailedStatus,
  updatePostToPosted,
  updatePostToFailed,
  updateDraftStatus,
  incrementScheduledPostsUsage,
  logWebhookJob,
  optimizeWebhookData
} from "@/lib/services/webhooks/lateWebhookService";
import { updatePost } from "@/lib/services/db/posts";

/**
 * Verify webhook signature from late.dev (if signature is provided)
 * @param payload - Raw request body as string
 * @param signature - Signature from X-Late-Signature header
 * @param secret - Webhook secret from env
 * @returns true if signature is valid or not required
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  // If no secret configured, skip verification (not recommended for production)
  if (!secret) {
    console.warn("[webhooks/late] No webhook secret configured, skipping signature verification");
    return true;
  }

  // If no signature provided, cannot verify
  if (!signature) {
    console.warn("[webhooks/late] No signature provided in request");
    return false;
  }

  // Calculate expected signature (HMAC SHA256)
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Compare signatures using constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature) as unknown as Uint8Array,
    Buffer.from(expectedSignature) as unknown as Uint8Array
  );
}

/**
 * POST /api/webhooks/late
 * Handle Late.dev webhook callbacks for scheduled posts
 * Updates scheduled_posts status when post is published or fails
 * 
 * Webhook events:
 * - post.posted: Post was successfully published
 * - post.failed: Post failed to publish
 * - post.scheduled: Post was scheduled
 * - post.cancelled: Post was cancelled
 */
export async function POST(req: NextRequest) {
  const requestId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("X-Late-Signature") || req.headers.get("x-late-signature");

    console.log(`[webhooks/late] ${requestId} - Webhook received`, {
      timestamp: new Date().toISOString(),
      hasSignature: !!signature,
      bodyLength: rawBody.length,
      headers: Object.fromEntries(req.headers.entries())
    });

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.LATE_WEBHOOK_SECRET;
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error(`[webhooks/late] ${requestId} - Invalid webhook signature`);
      return fail("Invalid webhook signature", 401);
    }

    // Parse JSON body
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError: any) {
      console.error(`[webhooks/late] ${requestId} - Failed to parse JSON body:`, parseError);
      return fail("Invalid JSON body", 400);
    }

    // Log full webhook body for debugging
    // console.log(`[webhooks/late] ${requestId} - Full webhook body:`, JSON.stringify(body, null, 2));

    // Log webhook event to jobs table for debugging
    await logWebhookJob(requestId, body, 'processing');

    // Extract event type and data from webhook body via service layer
    const { eventType, eventData, lateJobId, status } = extractWebhookData(body);

    console.log(`[webhooks/late] ${requestId} - Extracted data:`, {
      eventType,
      lateJobId,
      status,
      eventDataKeys: eventData ? Object.keys(eventData) : [],
      bodyKeys: Object.keys(body)
    });

    if (!lateJobId) {
      console.warn(`[webhooks/late] ${requestId} - Missing job ID in webhook. Full body:`, JSON.stringify(body, null, 2));

      // Try to find scheduled post by other means (e.g., post URL, platform post ID)
      // This is a fallback if job ID is not in the expected format
      const fallbackPostId = body?.post?.platforms?.[0]?.post_id
        || body?.data?.platforms?.[0]?.post_id
        || body?.platforms?.[0]?.post_id;

      if (fallbackPostId) {
        console.log(`[webhooks/late] ${requestId} - Attempting to find post by fallback ID: ${fallbackPostId}`);
        // Could try to find by platform post ID in payload, but this is less reliable
      }

      return success({ ok: true, message: "Webhook received but no job ID found", requestId });
    }

    // Find the scheduled post by late_job_id via service layer
    const scheduledPost = await findPostByLateJobId(lateJobId);

    if (!scheduledPost) {
      console.error(`[webhooks/late] ${requestId} - Scheduled post not found for late_job_id: ${lateJobId}`);
      return success({ ok: true, message: "Scheduled post not found", requestId, lateJobId });
    }

    console.log(`[webhooks/late] ${requestId} - Found scheduled post:`, {
      postId: scheduledPost.id,
      storedLateJobId: scheduledPost.late_job_id,
      webhookLateJobId: lateJobId,
      platform: scheduledPost.platform,
      currentStatus: scheduledPost.payload?.status || 'unknown'
    });

    // Update scheduled_posts table based on status via service layer
    const existingPayload = scheduledPost.payload || {};

    if (isPostedStatus(status, eventType, body)) {
      // Post was successfully published
      console.log(`[webhooks/late] ${requestId} - Processing POSTED event for late_job_id: ${lateJobId}`);

      // Get getlate account for retry logic
      const getlateAccount = (scheduledPost as any).getlate_accounts;

      const result = await updatePostToPosted(
        scheduledPost.id,
        lateJobId,
        body,
        eventType,
        status,
        eventData,
        existingPayload,
        getlateAccount
      );

      if (result.success && result.updatedPost) {
        console.log(`[webhooks/late] ${requestId} - ✅ Successfully updated scheduled_posts status to 'posted' for post ID: ${scheduledPost.id}, late_job_id: ${lateJobId}`);

        // Increment monthly_usage.scheduled_posts for the user/month
        // Only increment if status was previously 'scheduled' (to avoid double counting)
        if (scheduledPost.payload?.status !== 'posted') {
          await incrementScheduledPostsUsage(result.updatedPost.user_id);
          console.log(`[webhooks/late] ${requestId} - Incremented monthly usage for user ${result.updatedPost.user_id}`);
        } else {
          console.log(`[webhooks/late] ${requestId} - Skipping usage increment (post already counted or status unchanged)`);
        }

        // If draft_id exists, also update draft status
        if (scheduledPost.draft_id) {
          await updateDraftStatus(scheduledPost.draft_id, 'posted');
          console.log(`[webhooks/late] ${requestId} - Updated draft ${scheduledPost.draft_id} status to 'posted'`);
        }

        // Update job status to completed
        await logWebhookJob(requestId, body, 'done');
      }

    } else if (isFailedStatus(status, eventType)) {
      // Post failed to publish
      console.log(`[webhooks/late] ${requestId} - Processing FAILED event for late_job_id: ${lateJobId}`);

      const success = await updatePostToFailed(
        lateJobId,
        body,
        eventType,
        status,
        eventData,
        existingPayload
      );

      if (success) {
        console.log(`[webhooks/late] ${requestId} - Updated scheduled_posts status to 'failed' for late_job_id: ${lateJobId}`);
      }

      // If draft_id exists, also update draft status
      if (scheduledPost.draft_id) {
        await updateDraftStatus(scheduledPost.draft_id, 'failed');
      }
    } else {
      // Other statuses (processing, pending, scheduled, etc.)
      console.log(`[webhooks/late] ${requestId} - Processing other status: ${status || 'unknown'}, eventType: ${eventType}`);

      const existingPayload = scheduledPost.payload || {};

      // Don't update status if it's already 'posted' or 'failed' (unless explicitly changed)
      const currentStatus = scheduledPost.payload?.status || 'scheduled';
      const newStatus = (status && status !== currentStatus && ['scheduled', 'processing', 'pending'].includes(status))
        ? status
        : currentStatus;

      // Clean and optimize payload before updating to remove duplicates
      const { cleanPayload } = await import("@/lib/services/late/postService");
      const cleanedPayload = cleanPayload({
        ...existingPayload, // Preserve all existing payload fields including connected_account_id
        last_webhook_at: new Date().toISOString(),
        // Optimized webhook data - only essential fields
        webhook_data: optimizeWebhookData(body, eventData),
        webhook_event_type: eventType,
        webhook_status: status
        // Note: connected_account_id, connected_account_metadata, and other fields are preserved via ...existingPayload
      });

      // Update post via service layer (use userId from scheduledPost)
      const updatedPost = await updatePost(scheduledPost.id, scheduledPost.user_id, {
        status: newStatus,
        payload: cleanedPayload
      });

      if (!updatedPost) {
        console.error(`[webhooks/late] ${requestId} - Error updating scheduled_posts status for post ID: ${scheduledPost.id}`);
      } else {
        console.log(`[webhooks/late] ${requestId} - Updated scheduled_posts status to '${newStatus}' for post ID: ${scheduledPost.id}`);
      }

      // Update job status
      await logWebhookJob(requestId, body, 'done');
    }

    return success({ ok: true, lateJobId, status, eventType, requestId });

  } catch (err: any) {
    console.error(`[webhooks/late] ${requestId} - Webhook processing error:`, err);
    console.error(`[webhooks/late] ${requestId} - Error stack:`, err.stack);

    // Update job status to failed (body may not be available in catch block)
    try {
      await logWebhookJob(requestId, {}, 'failed', err.message || 'Unknown error');
    } catch (updateErr) {
      console.error(`[webhooks/late] ${requestId} - Failed to update job status:`, updateErr);
    }

    return fail(err.message || 'webhook error', 500);
  }
}
