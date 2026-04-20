/**
 * API Protection Middleware
 * Centralized authentication and credit checking for all API routes
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deductCredits, CREDIT_COSTS, type CreditResult } from "@/lib/usage";
import { fail } from "@/lib/response";
import type { User } from "@supabase/supabase-js";

export interface ApiProtectionOptions {
  /** Skip credit deduction */
  skipDeduct?: boolean;
  /** Return error response instead of throwing */
  returnError?: boolean;
  /** Number of times to deduct credits (for batch operations like multiple platforms) */
  count?: number;
  /** Metadata for credit transaction tracking (model, platform, prompt, etc.) */
  metadata?: Record<string, any>;
  /** Specific credit amount to deduct (overrides default action cost) */
  amount?: number;
}

export interface PaywallResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  currentLimit?: number;
  limitReached?: boolean;
  creditsRequired?: number;
  creditsRemaining?: number;
  totalCredits?: number;
}

export interface ApiProtectionResult {
  user: User;
  paywallResult: PaywallResult;
  creditResult?: CreditResult;
  creditsRemaining?: number;
  totalCredits?: number;
}

export interface ApiProtectionError {
  error: ReturnType<typeof fail>;
}

/**
 * 1. Authentication check
 */
export async function checkAuth(
  req: NextRequest,
  returnError: boolean = false
): Promise<{ user: User } | ApiProtectionError> {
  const user = await requireAuth(req);
  if (!user) {
    const error = fail("Unauthorized", 401);
    if (returnError) return { error };
    throw new Error("Unauthorized");
  }
  return { user };
}

/**
 * 2. Credit deduction
 */
export async function deductCredit(
  userId: string,
  creditAction: keyof typeof CREDIT_COSTS,
  count: number = 1,
  returnError: boolean = false,
  metadata?: Record<string, any>,
  amount?: number
): Promise<{ creditResult: CreditResult } | ApiProtectionError> {
  let creditResult: CreditResult | undefined;

  // Deduct credits for each count
  for (let i = 0; i < count; i++) {
    // Merge metadata with count index for batch operations
    const txMetadata = count > 1
      ? { ...metadata, batch_index: i + 1, batch_total: count }
      : metadata;

    creditResult = await deductCredits(userId, creditAction, txMetadata, undefined, amount);
    if (!creditResult.success) {
      const error = fail(JSON.stringify({
        message: count > 1
          ? `Failed to deduct credits. ${creditResult.reason} (attempt ${i + 1}/${count})`
          : creditResult.reason,
        upgradeRequired: creditResult.reason === 'insufficient_credits',
        creditsRequired: CREDIT_COSTS[creditAction],
        creditsRemaining: creditResult.creditsLeft,
        count,
        deducted: i
      }), 403);
      if (returnError) return { error };
      throw new Error(creditResult.reason || "Credit deduction failed");
    }
  }

  return { creditResult: creditResult! };
}

/**
 * Create default paywall result (always allowed since paywall is removed)
 */
function createDefaultPaywallResult(totalCreditsNeeded: number): PaywallResult {
  return {
    allowed: true,
    creditsRequired: totalCreditsNeeded,
    creditsRemaining: 0,
    totalCredits: 0
  };
}

/**
 * Middleware to protect API routes with authentication and credit checks
 */
export async function withApiProtection(
  req: NextRequest,
  creditAction: keyof typeof CREDIT_COSTS,
  options: ApiProtectionOptions = {}
): Promise<ApiProtectionResult | ApiProtectionError> {
  try {
    const count = options.count || 1;
    const totalCreditsNeeded = options.amount !== undefined
      ? options.amount * count
      : CREDIT_COSTS[creditAction] * count;

    // 1. Authentication check
    const authResult = await checkAuth(req, options.returnError);
    if ('error' in authResult) return authResult;
    const { user } = authResult;

    // 2. Paywall is removed - always allow
    const paywallResult = createDefaultPaywallResult(totalCreditsNeeded);

    // 3. Credit deduction (unless skipped)
    const deductResult = options.skipDeduct
      ? undefined
      : await deductCredit(user.id, creditAction, count, options.returnError, options.metadata, options.amount);
    if (deductResult && 'error' in deductResult) return deductResult;
    const creditResult = deductResult?.creditResult;

    // Return success result
    return {
      user,
      paywallResult,
      creditResult,
      creditsRemaining: creditResult?.creditsLeft ?? paywallResult.creditsRemaining ?? 0,
      totalCredits: paywallResult.totalCredits ?? 0
    };
  } catch (err: any) {
    console.error("[ApiProtection] Error:", err);
    const error = fail(err.message || "Server error", 500);
    if (options.returnError) return { error };
    throw err;
  }
}

/**
 * Helper: Check only authentication (no credits)
 */
export async function withAuthOnly(
  req: NextRequest
): Promise<{ user: User } | ApiProtectionError> {
  return checkAuth(req, true);
}

/**
 * Helper: Check authentication + credits (no deduction)
 * Useful for read-only operations that need to check limits
 */
export async function withAuthAndPaywall(
  req: NextRequest,
  creditAction: keyof typeof CREDIT_COSTS
): Promise<ApiProtectionResult | ApiProtectionError> {
  return withApiProtection(req, creditAction, { skipDeduct: true });
}
