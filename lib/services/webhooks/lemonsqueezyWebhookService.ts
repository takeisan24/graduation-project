/**
 * Service: LemonSqueezy Webhook Handler
 * 
 * Handles webhook events from LemonSqueezy including:
 * - Subscription management (created, updated, cancelled, resumed, expired)
 * - Order processing (credit top-ups)
 * - User plan updates
 * - Credit balance syncing
 */

import { supabase } from "@/lib/supabase";
import { addPurchasedCredits } from "@/lib/usage";
import { CREDIT_PACKAGES } from "@/lib/payments/lemonsqueezy";

/**
 * Map LemonSqueezy variant ID to plan name
 */
export function mapVariantToPlan(variantId: string): string {
  const variantMap: Record<string, string> = {
    [process.env.LEMONSQUEEZY_CREATOR_VARIANT_ID || '']: 'creator',
    [process.env.LEMONSQUEEZY_CREATOR_PRO_VARIANT_ID || '']: 'creator_pro',
    [process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID || '']: 'agency'
  };
  
  return variantMap[variantId] || 'free';
}

/**
 * Map LemonSqueezy variant ID to credit package
 */
export function mapVariantToCreditPackage(variantId: string): string | null {
  const variantMap: Record<string, string> = {
    [process.env.LEMONSQUEEZY_50_CREDITS_VARIANT_ID || '']: '50_credits',
    [process.env.LEMONSQUEEZY_150_CREDITS_VARIANT_ID || '']: '150_credits',
    [process.env.LEMONSQUEEZY_350_CREDITS_VARIANT_ID || '']: '350_credits'
  };
  
  return variantMap[variantId] || null;
}

/**
 * Create subscription record
 */
export async function createSubscription(data: {
  user_id: string;
  lemonsqueezy_subscription_id: string;
  lemonsqueezy_customer_id: string;
  plan: string;
  current_period_start: string;
  current_period_end: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: data.user_id,
      lemonsqueezy_subscription_id: data.lemonsqueezy_subscription_id,
      lemonsqueezy_customer_id: data.lemonsqueezy_customer_id,
      plan: data.plan,
      status: 'active',
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      cancel_at_period_end: false
    });
  
  if (error) {
    console.error("[LemonSqueezyWebhook] Error creating subscription:", error);
    return false;
  }
  
  return true;
}

/**
 * Update subscription record
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: {
    status?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("lemonsqueezy_subscription_id", subscriptionId);
  
  if (error) {
    console.error("[LemonSqueezyWebhook] Error updating subscription:", error);
    return false;
  }
  
  return true;
}

/**
 * Get user ID from subscription
 */
export async function getUserIdFromSubscription(subscriptionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("lemonsqueezy_subscription_id", subscriptionId)
    .single();
  
  if (error || !data) {
    console.error("[LemonSqueezyWebhook] Error getting user ID from subscription:", error);
    return null;
  }
  
  return data.user_id;
}

/**
 * Update user's plan and subscription status
 */
export async function updateUserPlan(
  userId: string,
  updates: {
    plan?: string;
    subscription_status?: string;
    lemonsqueezy_customer_id?: string;
    lemonsqueezy_subscription_id?: string;
    subscription_ends_at?: string | null;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId);
  
  if (error) {
    console.error("[LemonSqueezyWebhook] Error updating user:", error);
    return false;
  }
  
  return true;
}

/**
 * Sync user credits balance after plan change
 */
export async function syncUserCreditsBalance(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('sync_user_credits_balance', {
      p_user_id: userId
    });
    
    if (error) {
      console.error("[LemonSqueezyWebhook] Error syncing credits_balance:", error);
      return false;
    }
    
    return true;
  } catch (err: any) {
    console.error("[LemonSqueezyWebhook] Error calling sync_user_credits_balance:", err);
    return false;
  }
}

/**
 * Process credit top-up order
 */
export async function processCreditOrder(
  userId: string,
  variantId: string
): Promise<{ success: boolean; credits?: number }> {
  const creditPackage = mapVariantToCreditPackage(variantId);
  
  if (!creditPackage) {
    return { success: false };
  }
  
  const credits = CREDIT_PACKAGES[creditPackage as keyof typeof CREDIT_PACKAGES]?.credits || 0;
  
  if (credits > 0) {
    const result = await addPurchasedCredits(userId, credits);
    if (result.success) {
      return { success: true, credits };
    }
  }
  
  return { success: false };
}

/**
 * Log webhook event to jobs table
 */
export async function logLemonSqueezyWebhookJob(
  event: any,
  status: 'processing' | 'completed' | 'failed' = 'processing'
): Promise<void> {
  if (status === 'processing') {
    await supabase.from("jobs").insert({ 
      job_type: 'lemonsqueezy_webhook', 
      payload: event, 
      status: 'processing' 
    });
  } else if (status === 'failed') {
    await supabase.from("jobs").insert({ 
      job_type: 'lemonsqueezy_webhook_error', 
      payload: { error: event.message, stack: event.stack }, 
      status: 'failed' 
    });
  } else {
    // Update existing job
    const eventType = event.meta?.event_name;
    await supabase
      .from("jobs")
      .update({ status: 'completed' })
      .eq('job_type', 'lemonsqueezy_webhook')
      .eq('payload->meta->event_name', eventType)
      .order('created_at', { ascending: false })
      .limit(1);
  }
}

