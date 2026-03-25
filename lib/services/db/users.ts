/**
 * Database Service: Users
 * 
 * Handles all database operations related to users, usage, and limits
 * 
 * @module db/users
 */

// Import supabase for most functions (they're only called from server-side API routes)
// getUserPlanAndCredits uses lazy import to avoid loading on client-side
import { supabase } from "@/lib/supabase";
import { getMonthPeriodRange, DEFAULT_TIMEZONE } from "@/lib/utils/date";

/**
 * Basic user profile information
 */
export interface UserProfile {
  id: string;
  plan: string;
  subscription_status: string | null;
  credits_balance: number | null;
  subscription_ends_at?: string | null;
  next_credit_grant_at?: string | null;
  [key: string]: unknown;
}

/**
 * User profile with subscription relation
 */
export interface UserWithSubscription extends UserProfile {
  subscriptions?: Array<{
    id: string;
    plan: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  }>;
}

/**
 * Usage record from usage table (monthly usage tracking)
 */
export interface UsageRecord {
  user_id: string;
  credits_used: number;
  credits_purchased: number;
  period_start: string;
  period_end: string;
  [key: string]: unknown;
}

/**
 * Monthly usage record from monthly_usage table
 */
export interface MonthlyUsage {
  user_id: string;
  month: string;
  projects_created: number;
  posts_created: number;
  images_generated: number;
  videos_generated: number;
  scheduled_posts: number;
  [key: string]: unknown;
}

/**
 * Get user profile with subscription details
 * 
 * Retrieves user profile including related subscription information.
 * Includes subscription details like plan, status, period dates, and cancellation status.
 * 
 * @param {string} userId - User ID to get profile for
 * @returns {Promise<UserWithSubscription | null>} User profile with subscriptions or null if not found/error
 * 
 * @example
 * ```typescript
 * const profile = await getUserProfileWithSubscription('user_123');
 * const subscription = profile?.subscriptions?.[0];
 * ```
 */
export async function getUserProfileWithSubscription(userId: string): Promise<UserWithSubscription | null> {
  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      subscriptions (
        id,
        plan,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end
      )
    `)
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.warn("[db/users] Error fetching user profile:", error);
    return null;
  }

  return data;
}

/**
 * Get user profile (basic)
 * 
 * Retrieves basic user profile information: id, plan, subscription_status, and credits_balance.
 * Does not include subscription relation.
 * 
 * @param {string} userId - User ID to get profile for
 * @returns {Promise<UserProfile | null>} User profile or null if not found/error
 * 
 * @example
 * ```typescript
 * const profile = await getUserProfile('user_123');
 * const credits = profile?.credits_balance ?? 0;
 * ```
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, plan, subscription_status, credits_balance, subscription_ends_at, next_credit_grant_at")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.warn("[db/users] Error fetching user profile:", error);
    return null;
  }

  return data as UserProfile | null;
}

/**
 * Get user plan and credits balance
 * 
 * Retrieves only the plan and credits_balance fields for a user.
 * More efficient than getUserProfile when only these fields are needed.
 * 
 * @param {string} userId - User ID to get plan and credits for
 * @returns {Promise<{ plan: string; credits_balance: number; subscription_ends_at?: string | null; next_credit_grant_at?: string | null } | null>} Plan and credits or null if not found/error
 * 
 * @example
 * ```typescript
 * const data = await getUserPlanAndCredits('user_123');
 * const plan = data?.plan ?? 'free';
 * const credits = data?.credits_balance ?? 0;
 * ```
 */
export async function getUserPlanAndCredits(userId: string): Promise<{ plan: string; credits_balance: number; subscription_ends_at?: string | null; next_credit_grant_at?: string | null } | null> {
  // Lazy import supabase to avoid loading lib/supabase.ts on client-side
  // This function is called from videoGenerationService which might be bundled for client
  // Ensure no caching for this data fetch
  const { unstable_noStore } = await import("next/cache");
  unstable_noStore();

  const { supabase } = await import("@/lib/supabase");

  const { data, error } = await supabase
    .from("users")
    .select("plan, credits_balance, subscription_ends_at, next_credit_grant_at")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.warn("[db/users] Error fetching user plan:", error);
    return null;
  }

  if (!data) return null;
  return {
    plan: data.plan,
    credits_balance: data.credits_balance,
    subscription_ends_at: data.subscription_ends_at,
    next_credit_grant_at: data.next_credit_grant_at
  };
}

/**
 * Ensure user profile exists (via RPC)
 * 
 * Calls the database RPC function `ensure_user_profile` to create or update
 * a user profile. This function handles:
 * - Creating user record if it doesn't exist
 * - Updating email, name, avatar_url if provided
 * - Initializing credits_balance if new user
 * - Returning current credits_balance
 * 
 * @param {string} userId - User ID (required)
 * @param {string | null} [email] - User email (optional, for new users or updates)
 * @param {string | null} [name] - User name (optional, for new users or updates)
 * @param {string | null} [avatarUrl] - User avatar URL (optional, for new users or updates)
 * @returns {Promise<number | null>} Current credits_balance or null if error
 * 
 * @example
 * ```typescript
 * const credits = await ensureUserProfile('user_123', 'user@example.com', 'John Doe');
 * ```
 */
export async function ensureUserProfile(
  userId: string,
  email?: string | null,
  name?: string | null,
  avatarUrl?: string | null
): Promise<number | null> {
  const params: Record<string, string | null> = {
    p_user_id: userId
  };

  if (email !== undefined) params.p_email = email ?? null;
  if (name !== undefined) params.p_name = name ?? null;
  if (avatarUrl !== undefined) params.p_avatar_url = avatarUrl ?? null;

  const { data, error } = await supabase.rpc('ensure_user_profile', params);

  if (error) {
    console.warn("[db/services/users] Error ensuring user profile:", error);
    return null;
  }

  return data as number | null;
}

/**
 * Get current month usage record for user
 * 
 * Retrieves the usage record for the current month from the usage table.
 * This includes credits_used, credits_purchased, and period dates.
 * 
 * @param {string} userId - User ID to get usage for
 * @returns {Promise<UsageRecord | null>} Current month usage record or null if not found/error
 * 
 * @example
 * ```typescript
 * const usage = await getCurrentMonthUsage('user_123');
 * const creditsUsed = usage?.credits_used ?? 0;
 * ```
 */
export async function getCurrentMonthUsage(userId: string, timeZone: string = DEFAULT_TIMEZONE): Promise<UsageRecord | null> {
  const { periodStartIso, nextPeriodStartIso } = getMonthPeriodRange(timeZone);

  const { data, error } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", periodStartIso)
    .lt("period_start", nextPeriodStartIso)
    .single();

  if (error && error.code !== "PGRST116") {
    console.warn("[db/users] Error fetching current month usage:", error);
    return null;
  }

  return data;
}

/**
 * Get monthly usage for specific month
 */
export async function getMonthlyUsage(userId: string, month: string): Promise<MonthlyUsage | null> {
  const { data, error } = await supabase
    .from("monthly_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .single();

  if (error && error.code !== "PGRST116") {
    console.warn("[db/users] Error fetching monthly usage:", error);
    return null;
  }

  return data;
}

/**
 * Count connected accounts for user
 */
export async function countConnectedAccounts(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("connected_accounts")
    .select("*", { count: 'exact', head: true })
    .eq("user_id", userId);

  if (error) {
    console.warn("[db/users] Error counting connected accounts:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get credit transactions for user within date range
 */
export async function getCreditTransactions(
  userId: string,
  startDate: Date,
  endDate?: Date
): Promise<Array<{
  id: string;
  created_at: string;
  action_type: string;
  credits_used: number;
  platform: string | null;
}>> {
  let query = supabase
    .from('credit_transactions')
    .select('id, created_at, action_type, credits_used, platform')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("[db/users] Error fetching credit transactions:", error);
    return [];
  }

  return data || [];
}

/**
 * Subscription record from subscriptions table
 */
export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  billing_cycle: string | null;
  credits_per_period: number | null;
  next_credit_date: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Get user subscription by user ID
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionRecord | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[db/users] Error fetching subscription:", error);
    return null;
  }

  return data;
}

/**
 * Get current month usage record (from usage table)
 */
export async function getCurrentMonthUsageRecord(userId: string, timeZone: string = DEFAULT_TIMEZONE): Promise<UsageRecord | null> {
  const { periodStartIso } = getMonthPeriodRange(timeZone);

  const { data, error } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", periodStartIso)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[db/users] Error fetching current month usage:", error);
    return null;
  }

  return data;
}

/**
 * Increment monthly usage for a specific field
 * @param userId - User ID
 * @param month - Month in format 'YYYY-MM'
 * @param field - Field to increment (e.g., 'scheduled_posts', 'posts_created', 'images_generated')
 * @param amount - Amount to increment (default: 1)
 * @returns true if successful, false otherwise
 */
export async function incrementMonthlyUsage(
  userId: string,
  month: string,
  field: string,
  amount: number = 1
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_month: month,
      p_field: field,
      p_amount: amount
    });

    if (error) {
      console.error("[db/users] Error incrementing monthly usage:", error);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.error("[db/users] Error calling increment_usage RPC:", err);
    return false;
  }
}

/**
 * Update subscription status
 * @param subscriptionId - Subscription ID
 * @param updates - Updates to apply (status, cancel_at_period_end, etc.)
 * @returns Updated subscription or null if error
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  updates: {
    status?: string;
    cancel_at_period_end?: boolean;
    current_period_start?: string;
    current_period_end?: string;
  }
): Promise<SubscriptionRecord | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", subscriptionId)
    .select()
    .single();

  if (error) {
    console.error("[db/users] Error updating subscription status:", error);
    return null;
  }

  return data;
}

/**
 * Update user's plan and subscription status
 * @param userId - User ID
 * @param updates - Updates to apply (plan, subscription_status, etc.)
 * @returns true if successful, false otherwise
 */
export async function updateUserPlan(
  userId: string,
  updates: {
    plan?: string;
    subscription_status?: string;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId);

  if (error) {
    console.error("[db/users] Error updating user plan:", error);
    return false;
  }

  return true;
}

