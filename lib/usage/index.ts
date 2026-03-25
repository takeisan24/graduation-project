import { supabase } from "@/lib/supabase";
import { getMonthPeriodRange, getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";

/**
 * Credit costs for different actions according to pricing model
 */
export const CREDIT_COSTS = {
  TEXT_ONLY: 1,           // Tạo bộ nội dung (chỉ Text)
  WITH_IMAGE: 5,          // Tạo bộ nội dung (có Ảnh AI)
  WITH_VIDEO: 20,         // Tạo bộ nội dung (có Video AI)
  AI_REFINEMENT: 1,       // Tinh chỉnh bằng Trợ lý AI (1 Credit / 3 yêu cầu)
  VIDEO_PROCESSING: 5,    // Xử lý Video (5 Credits / mỗi phút)
  VIDEO_FACTORY_START: 5, // Bắt đầu Video Factory (Cắt clips)
  VIDEO_FACTORY_POSTPROCESS: 10, // Hậu kỳ Video Factory (B-roll, Subtitles)
  TEXT_TO_VIDEO: 120, // Default for 60s
  CUT_CLIP: 5,        // Default flat fee (will be overridden by dynamic amount)
  VIDEO_FACTORY: 5,   // Alias for consistency
} as const;


/**
 * Credit deduction result type
 */
export type CreditResult = {
  success: boolean;
  reason?: string;
  creditsLeft?: number;
};

/**
 * Monthly credit allocation for each plan
 */
export function getPlanCredits(plan: string): number {
  switch (plan) {
    case "creator": return 200;
    case "creator_pro": return 450;
    case "agency": return 1000;
    default: return 10; // free plan
  }
}

/**
 * Profile limits for each plan
 */
export function getPlanProfileLimit(plan: string): number {
  switch (plan) {
    case "creator": return 10;
    case "creator_pro": return 20;
    case "agency": return 50;
    default: return 2; // free plan
  }
}

/**
 * Monthly post scheduling limits
 */
export function getPlanPostLimit(plan: string): number {
  switch (plan) {
    case "creator":
    case "creator_pro":
    case "agency": return -1; // unlimited
    default: return 10; // free plan
  }
}

/**
 * Ensure usage row exists for current month
 */
export async function ensureUsageRow(userId: string, timeZone: string = DEFAULT_TIMEZONE) {
  const { periodStartIso, nextPeriodStartIso } = getMonthPeriodRange(timeZone);

  const { data } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", periodStartIso)
    .lt("period_start", nextPeriodStartIso)
    .single();

  if (data) return data;

  const { data: insertData, error } = await supabase
    .from("usage")
    .insert({
      user_id: userId,
      credits_used: 0,
      credits_purchased: 0,
      period_start: periodStartIso,
      period_end: nextPeriodStartIso
    })
    .select("*")
    .single();

  if (error) throw error;
  return insertData;
}

/**
 * Ensure monthly usage row exists for current month
 */
export async function ensureMonthlyUsageRow(userId: string, timeZone: string = DEFAULT_TIMEZONE) {
  const month = getMonthStartDate(timeZone); // YYYY-MM-DD format

  const { data } = await supabase
    .from("monthly_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .single();

  if (data) return data;

  const { data: insertData, error } = await supabase
    .from("monthly_usage")
    .insert({
      user_id: userId,
      month: month,
      projects_created: 0,
      posts_created: 0,
      images_generated: 0,
      videos_generated: 0
    })
    .select("*")
    .single();

  if (error) throw error;
  return insertData;
}

/**
 * Check if user has sufficient credits for an action
 */
export async function checkCredits(userId: string, action: keyof typeof CREDIT_COSTS): Promise<{
  success: boolean;
  reason?: string;
  creditsLeft?: number;
  totalCredits?: number;
}> {
  const { data: user } = await supabase
    .from("users")
    .select("plan, subscription_status")
    .eq("id", userId)
    .single();

  if (!user) return { success: false, reason: "user_not_found" };

  // Check if subscription is active
  if (user.subscription_status !== 'active' && user.plan !== 'free') {
    return { success: false, reason: "subscription_inactive" };
  }

  const plan = user.plan ?? 'free';
  const maxCredits = getPlanCredits(plan);

  await ensureUsageRow(userId, DEFAULT_TIMEZONE);
  const { periodStartIso, nextPeriodStartIso } = getMonthPeriodRange(DEFAULT_TIMEZONE);

  // Get credits_balance from users table as source of truth (real-time)
  const { data: userWithBalance, error: balanceError } = await supabase
    .from("users")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  const { data: usage, error: usageError } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", periodStartIso)
    .lt("period_start", nextPeriodStartIso)
    .single();

  if (usageError && usageError.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is OK
    console.warn(`[checkCredits] Error querying usage for user ${userId}:`, usageError);
  }

  const used = usage?.credits_used ?? 0;
  const purchased = usage?.credits_purchased ?? 0;
  const totalCredits = maxCredits + purchased;

  // Use credits_balance from users table as source of truth (real-time)
  // Only fallback to calculation if credits_balance is null or query failed
  let creditsLeft: number;
  if (!balanceError && userWithBalance && userWithBalance.credits_balance !== undefined && userWithBalance.credits_balance !== null) {
    // credits_balance is the source of truth
    creditsLeft = userWithBalance.credits_balance;
    if (creditsLeft < 0) {
      console.warn(`[checkCredits] User ${userId} has negative credits_balance: ${creditsLeft}. Syncing...`);
      // Sync if negative
      creditsLeft = totalCredits - used;
      await supabase.from("users").update({ credits_balance: creditsLeft }).eq("id", userId);
    }
  } else {
    // Fallback: calculate from usage table if credits_balance is not available
    if (balanceError) {
      console.warn(`[checkCredits] Error querying credits_balance for user ${userId}:`, balanceError);
    }
    creditsLeft = totalCredits - used;
    // Sync credits_balance to match calculated value
    const { error: updateError } = await supabase.from("users").update({ credits_balance: creditsLeft }).eq("id", userId);
    if (updateError) {
      console.error(`[checkCredits] Error updating credits_balance for user ${userId}:`, updateError);
    }
  }
  const requiredCredits = CREDIT_COSTS[action];

  if (creditsLeft < requiredCredits) {
    console.warn(`[checkCredits] User ${userId} INSUFFICIENT CREDITS - creditsLeft: ${creditsLeft}, required: ${requiredCredits}`);
    return {
      success: false,
      reason: "insufficient_credits",
      creditsLeft,
      totalCredits
    };
  }

  // Return success with current credits (before deduction)
  // Credit deduction will happen separately via deductCredits function
  return {
    success: true,
    creditsLeft: creditsLeft, // Return current credits, not after deduction
    totalCredits
  };
}

/**
 * Deduct credits for an action (atomic operation)
 * @param userId - User ID
 * @param action - Credit action type
 * @param metadata - Optional metadata (model, platform, prompt, etc.) for dashboard tracking
 */
export async function deductCredits(
  userId: string,
  action: keyof typeof CREDIT_COSTS,
  metadata?: Record<string, any>,
  responseData?: any,
  amount?: number, // Custom amount from newhoan
  count: number = 1 // Support multiple items from main
): Promise<{
  success: boolean;
  reason?: string;
  creditsLeft?: number;
}> {
  // Prioritize custom amount if provided, otherwise calculate based on count
  const requiredCredits = amount !== undefined ? amount : (CREDIT_COSTS[action] * count);

  // Ensure current month's usage row exists before RPC to guarantee atomic deducts
  try {
    await ensureUsageRow(userId, DEFAULT_TIMEZONE);
  } catch (e: any) {
    console.error('ensureUsageRow error:', e);
  }

  // Use atomic operation to deduct credits
  const { data: result, error } = await supabase.rpc('deduct_user_credits', {
    p_user_id: userId,
    p_credits_to_deduct: requiredCredits
  });

  if (error) {
    console.error('Error deducting credits:', error);
    return { success: false, reason: error.message || "db_error" };
  }

  if (!result || result.success === false) {
    return {
      success: false,
      reason: result?.reason || "insufficient_credits",
      creditsLeft: result?.credits_left || 0
    };
  }

  // ✅ FETCH FRESH BALANCE for logging to ensure it matches the users table exactly
  const { data: freshUser } = await supabase
    .from('users')
    .select('credits_balance')
    .eq('id', userId)
    .single();

  const finalCreditsRemaining = freshUser?.credits_balance ?? result.credits_left;
  // Insert into credit_transactions for detailed tracking (for dashboard)
  try {
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      action_type: action,
      credits_used: requiredCredits,
      credits_remaining: finalCreditsRemaining,
      metadata: metadata || {},
      response_data: responseData ?? null
    });
  } catch (txError: any) {
    console.error('Error inserting credit transaction:', txError);
  }

  return {
    success: true,
    creditsLeft: finalCreditsRemaining
  };
}

/**
 * Rollback/refund credits to user (when generation fails after deduction)
 * @param userId - User ID
 * @param action - Credit action type that was deducted
 * @param metadata - Optional metadata for tracking
 */
export async function rollbackCredits(
  userId: string,
  action: keyof typeof CREDIT_COSTS,
  metadata?: Record<string, any>,
  amount?: number
): Promise<{
  success: boolean;
  reason?: string;
  creditsLeft?: number;
}> {
  const creditsToRefund = amount !== undefined ? amount : CREDIT_COSTS[action];
  const { data: userRecord } = await supabase
    .from("users")
    .select("plan, credits_balance")
    .eq("id", userId)
    .single();

  // Ensure current month's usage row exists
  try {
    await ensureUsageRow(userId, DEFAULT_TIMEZONE);
  } catch (e: any) {
    console.error('ensureUsageRow error:', e);
  }

  // ✅ Use atomic RPC to rollback credits and log transaction in one go
  const { data: result, error: rpcError } = await supabase.rpc('rollback_user_credits', {
    p_user_id: userId,
    p_credits_to_rollback: creditsToRefund,
    p_action_type: action,
    p_metadata: metadata || {}
  });

  if (rpcError) {
    console.error('Error rolling back credits via RPC:', rpcError);
    return { success: false, reason: rpcError.message || "db_error" };
  }

  if (!result || result.success === false) {
    return {
      success: false,
      reason: result?.reason || "refund_failed"
    };
  }

  return {
    success: true,
    creditsLeft: result.credits_left
  };
}

/**
 * Add purchased credits (for top-up purchases)
 */
export async function addPurchasedCredits(userId: string, amount: number): Promise<{
  success: boolean;
  reason?: string;
}> {
  const { data: user } = await supabase
    .from("users")
    .select("plan")
    .eq("id", userId)
    .single();

  await ensureUsageRow(userId, DEFAULT_TIMEZONE);
  const { periodStartIso, nextPeriodStartIso } = getMonthPeriodRange(DEFAULT_TIMEZONE);

  // Get current usage and user plan to calculate new balance
  const { data: usage } = await supabase
    .from("usage")
    .select("credits_purchased, credits_used")
    .eq("user_id", userId)
    .gte("period_start", periodStartIso)
    .lt("period_start", nextPeriodStartIso)
    .single();

  const currentPurchased = usage?.credits_purchased ?? 0;
  const creditsUsed = usage?.credits_used ?? 0;
  const plan = user?.plan || 'free';
  const planCredits = getPlanCredits(plan);

  // Update purchased credits
  const { error } = await supabase
    .from("usage")
    .update({ credits_purchased: currentPurchased + amount })
    .eq("user_id", userId)
    .gte("period_start", periodStartIso)
    .lt("period_start", nextPeriodStartIso);

  if (error) return { success: false, reason: "db_error" };

  // Calculate and update credits_balance in users table
  const newTotalCredits = planCredits + (currentPurchased + amount);
  const newCreditsBalance = newTotalCredits - creditsUsed;

  await supabase
    .from("users")
    .update({
      credits_balance: newCreditsBalance,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  // Log to activity_log
  try {
    await trackActivity(userId, 'CREDIT_PURCHASED', {
      creditsUsed: 0, // Không dùng credits, chỉ mua
      creditsRemaining: newCreditsBalance,
      metadata: {
        amount,
        previousPurchased: currentPurchased,
        newPurchased: currentPurchased + amount
      }
    });
  } catch (activityError: any) {
    console.error('Error logging credit purchase activity:', activityError);
  }

  return { success: true };
}

/**
 * Track activity log - ghi lại toàn bộ thao tác sử dụng theo thời gian
 * Cho phép query linh hoạt theo 1 ngày, 3 ngày, 7 ngày, 30 ngày, toàn bộ thời gian
 * Sử dụng credit_transactions table để track tất cả activities
 */
export async function trackActivity(
  userId: string,
  actionType: 'PROJECT_CREATED' | 'POST_CREATED' | 'IMAGE_GENERATED' | 'VIDEO_GENERATED' | 'CREDIT_DEDUCTED' | 'CREDIT_PURCHASED' | 'POST_SCHEDULED' | 'POST_PUBLISHED' | 'AI_REFINEMENT' | 'VIDEO_PROCESSING' | 'TEXT_ONLY' | 'WITH_IMAGE' | 'WITH_VIDEO' | 'TEXT_TO_VIDEO' | 'CUT_CLIP' | 'VIDEO_FACTORY',
  options?: {
    creditsUsed?: number;
    creditsRemaining?: number;
    resourceId?: string;
    resourceType?: string;
    platform?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        action_type: actionType,
        credits_used: options?.creditsUsed ?? 0,
        credits_remaining: options?.creditsRemaining ?? null,
        resource_id: options?.resourceId ?? null,
        resource_type: options?.resourceType ?? null,
        platform: options?.platform ?? null,
        metadata: options?.metadata ?? null
      });

    if (error) {
      console.error('Error tracking activity:', error);
    }
  } catch (err: any) {
    console.error('Error in trackActivity:', err);
  }
}

/**
 * Track usage for different actions (legacy - vẫn giữ để tương thích)
 * Tự động log vào activity_log
 * @param amount - Optional amount to increment/decrement (use negative for refund)
 */
export async function trackUsage(
  userId: string,
  action: 'project_created' | 'post_created' | 'image_generated' | 'video_generated' | 'text_to_video_generated',
  amount: number = 1
): Promise<void> {
  await ensureMonthlyUsageRow(userId, DEFAULT_TIMEZONE);

  const month = getMonthStartDate(DEFAULT_TIMEZONE);

  const fieldMap = {
    project_created: 'projects_created',
    post_created: 'posts_created',
    image_generated: 'images_generated',
    video_generated: 'videos_generated',
    text_to_video_generated: 'videos_generated' // Maps to video counts
  } as const;

  const field = fieldMap[action];

  const { error } = await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_month: month,
    p_field: field,
    p_amount: amount
  });

  if (error) {
    console.error('Error tracking usage:', error);
  }

  // Note: DO NOT log to credit_transactions here
  // Credit deduction already logs to credit_transactions with action_type = WITH_IMAGE/WITH_VIDEO/TEXT_ONLY
  // This trackUsage is ONLY for updating monthly_usage statistics
  // Logging here would create duplicate rows in credit_transactions
}

/**
 * Check if user has reached profile limit
 */
export async function checkProfileLimit(userId: string): Promise<{
  canAdd: boolean;
  current: number;
  limit: number;
}> {
  const { data: user } = await supabase
    .from("users")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan = user?.plan ?? 'free';
  const limit = getPlanProfileLimit(plan);

  const { count } = await supabase
    .from("connected_accounts")
    .select("*", { count: 'exact', head: true })
    .eq("user_id", userId);

  const current = count ?? 0;

  return {
    canAdd: current < limit,
    current,
    limit
  };
}

/**
 * Check if user has reached post scheduling limit
 */
export async function checkPostLimit(userId: string): Promise<{
  canSchedule: boolean;
  current: number;
  limit: number;
}> {
  const { data: user } = await supabase
    .from("users")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan = user?.plan ?? 'free';
  const limit = getPlanPostLimit(plan);

  if (limit === -1) {
    return { canSchedule: true, current: 0, limit: -1 }; // unlimited
  }

  // Read monthly_usage.scheduled_posts for current month (UTC baseline)
  const month = getMonthStartDate(DEFAULT_TIMEZONE);

  const { data: usage } = await supabase
    .from('monthly_usage')
    .select('scheduled_posts')
    .eq('user_id', userId)
    .eq('month', month)
    .single();

  const current = usage?.scheduled_posts ?? 0;

  return { canSchedule: current < limit, current, limit };
}
