/**
 * Service: Fal.ai Webhook Handler
 * 
 * Handles webhook events from Fal.ai for video generation completion
 */

import { supabase } from "@/lib/supabase";

/**
 * Update drafts with completed video URL
 */
export async function updateDraftsWithVideo(
  videoUrl: string
): Promise<boolean> {
  const { error } = await supabase
    .from("content_drafts")
    .update({
      media_urls: [videoUrl],
      status: 'draft'
    })
    .eq('status', 'processing')
    .like('media_urls', '%fal_job%');
    
  if (error) {
    console.error("[FalWebhook] Error updating draft with video URL:", error);
    return false;
  }

  return true;
}

/**
 * Update drafts to show error status
 */
export async function updateDraftsToError(): Promise<boolean> {
  const { error } = await supabase
    .from("content_drafts")
    .update({
      status: 'error',
      text_content: 'Video generation failed'
    })
    .eq('status', 'processing')
    .like('media_urls', '%fal_job%');

  if (error) {
    console.error("[FalWebhook] Error updating drafts to error:", error);
    return false;
  }

  return true;
}

/**
 * Log webhook event to jobs table
 */
export async function logFalWebhookJob(
  body: any,
  status: 'processing' | 'completed' | 'failed' = 'processing'
): Promise<void> {
  if (status === 'processing' || status === 'failed') {
    await supabase.from("jobs").insert({
      job_type: status === 'failed' ? 'fal_ai_webhook_error' : 'fal_ai_webhook',
      payload: body,
      status: status === 'failed' ? 'failed' : 'processing'
    });
  } else {
    // Update existing job
    await supabase
      .from("jobs")
      .update({ status: 'completed' })
      .eq('job_type', 'fal_ai_webhook')
      .eq('payload->request_id', body.request_id);
  }
}

