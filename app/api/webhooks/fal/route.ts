import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import {
  updateDraftsWithVideo,
  updateDraftsToError,
  logFalWebhookJob
} from "@/lib/services/webhooks/falWebhookService";

/**
 * POST /api/webhooks/fal
 * Handle Fal.ai webhook events for video generation completion
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { status, request_id, response } = body;
    
    console.log(`Fal.ai webhook received: ${status}`, { request_id, response });
    
    // Log webhook event via service layer
    await logFalWebhookJob(body, 'processing');
    
    if (status === 'completed' && response?.video?.url) {
      // Update any pending drafts that were waiting for this video via service layer
      const success = await updateDraftsWithVideo(response.video.url);
      
      if (success) {
        console.log(`Video generation completed for request ${request_id}`);
      }
    } else if (status === 'failed') {
      console.error(`Video generation failed for request ${request_id}:`, response);
      
      // Update drafts to show error via service layer
      await updateDraftsToError();
    }
    
    // Update job status via service layer
    await logFalWebhookJob(body, 'completed');
    
    return success({ ok: true, status });
    
  } catch (err: any) {
    console.error("Fal.ai webhook error:", err);
    
    // Log error via service layer
    await logFalWebhookJob({
      error: err.message,
      stack: err.stack
    }, 'failed');
    
    return fail("Webhook processing failed", 500);
  }
}