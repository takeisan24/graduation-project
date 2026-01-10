import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { checkCredits, checkProfileLimit, checkPostLimit } from "@/lib/usage";
import { CREDIT_COSTS } from "@/lib/usage";
import { getMonthPeriodRange, DEFAULT_TIMEZONE } from "@/lib/utils/date";

/**
 * Paywall check result
 */
export interface PaywallResult {
  allowed: boolean;
  reason?: string;
  creditsRequired?: number;
  creditsRemaining?: number;
  totalCredits?: number;
  upgradeRequired?: boolean;
  upgradeUrl?: string;
  currentLimit?: number;
  limitReached?: boolean;
}

/**
 * Check if user can perform a credit-based action
 */
export async function checkCreditPaywall(
  userId: string, 
  action: keyof typeof CREDIT_COSTS
): Promise<PaywallResult> {
  try {
    const creditCheck = await checkCredits(userId, action);
    
    console.log(`[checkCreditPaywall] User ${userId} - action: ${action}, creditCheck result:`, creditCheck);
    
    if (!creditCheck.success) {
      const result = {
        allowed: false,
        reason: creditCheck.reason,
        creditsRequired: CREDIT_COSTS[action],
        creditsRemaining: creditCheck.creditsLeft,
        totalCredits: creditCheck.totalCredits,
        upgradeRequired: creditCheck.reason === 'insufficient_credits'
      };
      console.log(`[checkCreditPaywall] User ${userId} - NOT ALLOWED:`, result);
      return result;
    }
    
    const result = {
      allowed: true,
      creditsRequired: CREDIT_COSTS[action],
      creditsRemaining: creditCheck.creditsLeft,
      totalCredits: creditCheck.totalCredits
    };
    console.log(`[checkCreditPaywall] User ${userId} - ALLOWED:`, result);
    return result;
    
  } catch (error) {
    console.error('Credit paywall check error:', error);
    return {
      allowed: false,
      reason: 'check_failed'
    };
  }
}

/**
 * Check if user can add more social media profiles
 */
export async function checkProfilePaywall(userId: string): Promise<PaywallResult> {
  try {
    const profileCheck = await checkProfileLimit(userId);
    
    if (!profileCheck.canAdd) {
      return {
        allowed: false,
        reason: 'profile_limit_reached',
        currentLimit: profileCheck.limit,
        limitReached: true,
        upgradeRequired: true
      };
    }
    
    return {
      allowed: true,
      currentLimit: profileCheck.limit
    };
    
  } catch (error) {
    console.error('Profile paywall check error:', error);
    return {
      allowed: false,
      reason: 'check_failed'
    };
  }
}

/**
 * Check if user can schedule more posts
 */
export async function checkPostPaywall(userId: string): Promise<PaywallResult> {
  try {
    const postCheck = await checkPostLimit(userId);
    
    if (!postCheck.canSchedule) {
      return {
        allowed: false,
        reason: 'post_limit_reached',
        currentLimit: postCheck.limit,
        limitReached: true,
        upgradeRequired: true
      };
    }
    
    return {
      allowed: true,
      currentLimit: postCheck.limit
    };
    
  } catch (error) {
    console.error('Post paywall check error:', error);
    return {
      allowed: false,
      reason: 'check_failed'
    };
  }
}

/**
 * Check if user has access to premium features
 */
export async function checkPremiumFeaturePaywall(
  userId: string, 
  feature: 'branding' | 'team_members' | 'priority_support'
): Promise<PaywallResult> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("plan, subscription_status")
      .eq("id", userId)
      .single();
    
    if (!user) {
      return {
        allowed: false,
        reason: 'user_not_found'
      };
    }
    
    const plan = user.plan || 'free';
    const isSubscriptionActive = user.subscription_status === 'active' || plan === 'free';
    
    // Check feature access based on plan
    let hasAccess = false;
    
    switch (feature) {
      case 'branding':
        hasAccess = ['creator', 'creator_pro', 'agency'].includes(plan);
        break;
      case 'team_members':
        hasAccess = ['creator_pro', 'agency'].includes(plan);
        break;
      case 'priority_support':
        hasAccess = plan === 'agency';
        break;
    }
    
    if (!hasAccess || !isSubscriptionActive) {
      return {
        allowed: false,
        reason: 'premium_feature_required',
        upgradeRequired: true
      };
    }
    
    return {
      allowed: true
    };
    
  } catch (error) {
    console.error('Premium feature paywall check error:', error);
    return {
      allowed: false,
      reason: 'check_failed'
    };
  }
}

/**
 * Middleware to check paywall for API routes
 */
export async function withPaywallCheck(
  req: NextRequest,
  checkType: 'credits' | 'profiles' | 'posts' | 'premium',
  actionOrFeature?: keyof typeof CREDIT_COSTS | 'branding' | 'team_members' | 'priority_support'
): Promise<{ user: any; paywallResult: PaywallResult } | { error: any }> {
  try {
    // First check authentication
    const user = await requireAuth(req);
    if (!user) {
      return { error: { message: "Unauthorized", status: 401 } };
    }
    
    let paywallResult: PaywallResult;
    
    switch (checkType) {
      case 'credits':
        if (!actionOrFeature || !(actionOrFeature in CREDIT_COSTS)) {
          return { error: { message: "Invalid credit action", status: 400 } };
        }
        paywallResult = await checkCreditPaywall(user.id, actionOrFeature as keyof typeof CREDIT_COSTS);
        break;
        
      case 'profiles':
        paywallResult = await checkProfilePaywall(user.id);
        break;
        
      case 'posts':
        paywallResult = await checkPostPaywall(user.id);
        break;
        
      case 'premium':
        if (!actionOrFeature || !['branding', 'team_members', 'priority_support'].includes(actionOrFeature)) {
          return { error: { message: "Invalid premium feature", status: 400 } };
        }
        paywallResult = await checkPremiumFeaturePaywall(user.id, actionOrFeature as 'branding' | 'team_members' | 'priority_support');
        break;
        
      default:
        return { error: { message: "Invalid check type", status: 400 } };
    }
    
    return { user, paywallResult };
    
  } catch (error) {
    console.error('Paywall middleware error:', error);
    return { error: { message: "Paywall check failed", status: 500 } };
  }
}

/**
 * Get user's current plan and limits for frontend display
 */
export async function getUserPlanInfo(userId: string) {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("plan, subscription_status")
      .eq("id", userId)
      .single();
    
    if (!user) {
      return null;
    }
    
    const plan = user.plan || 'free';
    const isSubscriptionActive = user.subscription_status === 'active' || plan === 'free';
    const timezone = DEFAULT_TIMEZONE;
    
    // Get current usage
    const { periodStartIso, nextPeriodStartIso } = getMonthPeriodRange(timezone);
    
    const { data: usage } = await supabase
      .from("usage")
      .select("*")
      .eq("user_id", userId)
      .gte("period_start", periodStartIso)
      .lt("period_start", nextPeriodStartIso)
      .single();
    
    const { data: profileCount } = await supabase
      .from("connected_accounts")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId);
    
    return {
      plan,
      isSubscriptionActive,
      usage: usage || null,
      connectedProfiles: profileCount || 0
    };
    
  } catch (error) {
    console.error('Get user plan info error:', error);
    return null;
  }
}
