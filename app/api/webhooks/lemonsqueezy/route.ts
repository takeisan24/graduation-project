import { NextRequest } from "next/server";
import { verifyLemonSqueezySignature } from "@/lib/payments/lemonsqueezy";
import { success, fail } from "@/lib/response";
import {
  mapVariantToPlan,
  mapVariantToCreditPackage,
  createSubscription,
  updateSubscription,
  getUserIdFromSubscription,
  updateUserPlan,
  syncUserCreditsBalance,
  processCreditOrder,
  logLemonSqueezyWebhookJob
} from "@/lib/services/webhooks/lemonsqueezyWebhookService";

/**
 * POST /api/webhooks/lemonsqueezy
 * Handle LemonSqueezy webhook events for subscription and payment processing
 */
export async function POST(req: NextRequest) {
  try {
  const raw = await req.text();
  const ok = verifyLemonSqueezySignature(req.headers, raw);
  if (!ok) return fail("Invalid signature", 403);
  
  const event = JSON.parse(raw);
    const eventType = event.meta?.event_name;
    
    console.log(`LemonSqueezy webhook received: ${eventType}`, event);
    
    // Log webhook event for debugging via service layer
    await logLemonSqueezyWebhookJob(event, 'processing');
    
    // Handle different event types
    switch (eventType) {
      case 'subscription_created':
        await handleSubscriptionCreated(event);
        break;
      case 'subscription_updated':
        await handleSubscriptionUpdated(event);
        break;
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(event);
        break;
      case 'subscription_resumed':
        await handleSubscriptionResumed(event);
        break;
      case 'subscription_expired':
        await handleSubscriptionExpired(event);
        break;
      case 'order_created':
        await handleOrderCreated(event);
        break;
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }
    
    // Update job status via service layer
    await logLemonSqueezyWebhookJob(event, 'completed');
    
    return success({ ok: true, event: eventType });
    
  } catch (err: any) {
    console.error("LemonSqueezy webhook error:", err);
    
    // Log error via service layer
    await logLemonSqueezyWebhookJob(err, 'failed');
    
    return fail("Webhook processing failed", 500);
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(event: any) {
  const subscription = event.data;
  const attributes = subscription.attributes;
  
  // Get user_id from custom data in checkout
  const customData = attributes.checkout_data?.custom || {};
  const userId = customData.user_id;
  
  if (!userId) {
    console.error("No user_id in subscription custom data", attributes);
    return;
  }
  
  // Extract plan from variant
  const variantId = subscription.relationships?.variant?.data?.id;
  const plan = mapVariantToPlan(variantId);
  
  // Create subscription record via service layer
  const subCreated = await createSubscription({
    user_id: userId,
    lemonsqueezy_subscription_id: subscription.id,
    lemonsqueezy_customer_id: attributes.customer_id,
    plan: plan,
    current_period_start: attributes.renewals_at || new Date().toISOString(),
    current_period_end: attributes.ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });
  
  if (!subCreated) {
    return;
  }
  
  // Update user's plan and subscription status via service layer
  const userUpdated = await updateUserPlan(userId, {
    plan: plan,
    subscription_status: 'active',
    lemonsqueezy_customer_id: attributes.customer_id,
    lemonsqueezy_subscription_id: subscription.id,
    subscription_ends_at: attributes.ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });
  
  if (userUpdated) {
    // Sync credits_balance after plan change via service layer
    const synced = await syncUserCreditsBalance(userId);
    if (synced) {
      console.log(`Credits balance synced for user ${userId} after plan change to ${plan}`);
    }
  }
  
  console.log(`Subscription created for user ${userId}, plan: ${plan}`);
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(event: any) {
  const subscription = event.data;
  const attributes = subscription.attributes;
  const subscriptionId = subscription.id;
  
  // Update subscription record via service layer
  const updated = await updateSubscription(subscriptionId, {
    status: attributes.status,
    current_period_start: attributes.renewals_at,
    current_period_end: attributes.ends_at,
    cancel_at_period_end: attributes.cancelled
  });
  
  if (!updated) {
    return;
  }
  
  // Get user ID from subscription via service layer
  const userId = await getUserIdFromSubscription(subscriptionId);
  
  if (userId) {
    // Update user's subscription status via service layer
    await updateUserPlan(userId, {
      subscription_status: attributes.status,
      subscription_ends_at: attributes.ends_at
    });
  }
  
  console.log(`Subscription updated: ${subscriptionId}, status: ${attributes.status}`);
}

/**
 * Handle subscription cancelled event
 */
async function handleSubscriptionCancelled(event: any) {
  const subscription = event.data;
  const subscriptionId = subscription.id;
  
  // Update subscription record via service layer
  const updated = await updateSubscription(subscriptionId, {
    status: 'cancelled',
    cancel_at_period_end: true
  });
  
  if (!updated) {
    return;
  }
  
  // Get user ID from subscription via service layer
  const userId = await getUserIdFromSubscription(subscriptionId);
  
  if (userId) {
    // Update user's subscription status via service layer
    await updateUserPlan(userId, {
      subscription_status: 'cancelled'
    });
  }
  
  console.log(`Subscription cancelled: ${subscriptionId}`);
}

/**
 * Handle subscription resumed event
 */
async function handleSubscriptionResumed(event: any) {
  const subscription = event.data;
  const subscriptionId = subscription.id;
  const attributes = subscription.attributes;
  
  // Update subscription record via service layer
  const updated = await updateSubscription(subscriptionId, {
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: attributes.renewals_at,
    current_period_end: attributes.ends_at
  });
  
  if (!updated) {
    return;
  }
  
  // Get user ID from subscription via service layer
  const userId = await getUserIdFromSubscription(subscriptionId);
  
  if (userId) {
    // Update user's subscription status via service layer
    await updateUserPlan(userId, {
      subscription_status: 'active',
      subscription_ends_at: attributes.ends_at
    });
  }
  
  console.log(`Subscription resumed: ${subscriptionId}`);
}

/**
 * Handle subscription expired event
 */
async function handleSubscriptionExpired(event: any) {
  const subscription = event.data;
  const subscriptionId = subscription.id;
  
  // Update subscription record via service layer
  const updated = await updateSubscription(subscriptionId, {
    status: 'expired'
  });
  
  if (!updated) {
    return;
  }
  
  // Get user ID from subscription via service layer
  const userId = await getUserIdFromSubscription(subscriptionId);
  
  if (userId) {
    // Update user's plan back to free via service layer
    await updateUserPlan(userId, {
      plan: 'free',
      subscription_status: 'inactive',
      subscription_ends_at: null
    });
  }
  
  console.log(`Subscription expired: ${subscriptionId}`);
}

/**
 * Handle order created event (for credit top-ups)
 */
async function handleOrderCreated(event: any) {
  const order = event.data;
  const attributes = order.attributes;
  const customData = attributes.checkout_data?.custom || {};
  const userId = customData.user_id;
  
  if (!userId) {
    console.error("No user_id in order custom data");
    return;
  }
  
  // Check if this is a credit top-up order
  const variantId = order.relationships?.variant?.data?.id;
  
  // Process credit order via service layer
  const result = await processCreditOrder(userId, variantId);
  
  if (result.success && result.credits) {
    console.log(`Added ${result.credits} credits to user ${userId}. Credits balance updated in DB.`);
    // Note: FE should fetch updated credits_balance from /api/me or use Supabase realtime
  } else {
    console.error(`Failed to add credits to user ${userId}`);
  }
}

