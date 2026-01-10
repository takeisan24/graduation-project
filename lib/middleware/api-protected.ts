/**
 * API Protection Middleware
 * Centralized authentication, paywall, and credit checking for all API routes
 * 

 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withPaywallCheck, PaywallResult } from "@/lib/paywall";
import { deductCredits, CREDIT_COSTS, type CreditResult } from "@/lib/usage";
import { fail } from "@/lib/response";
import type { User } from "@supabase/supabase-js";

export interface ApiProtectionOptions {
  /** Skip paywall check (still checks credits) */
  skipPaywall?: boolean;
  /** Skip credit deduction (still checks paywall) */
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
 * 2. Paywall check
 */
export async function checkPaywall(
  req: NextRequest,
  creditAction: keyof typeof CREDIT_COSTS,
  totalCreditsNeeded: number,
  count: number = 1,
  returnError: boolean = false
): Promise<{ paywallResult: PaywallResult } | ApiProtectionError> {
  const paywallCheck = await withPaywallCheck(req, 'credits', creditAction);
  if ('error' in paywallCheck) {
    const error = fail(paywallCheck.error.message, paywallCheck.error.status);
    if (returnError) return { error };
    throw new Error(paywallCheck.error.message);
  }

  const paywallResult = paywallCheck.paywallResult;

  console.log(`[checkPaywall] creditAction: ${creditAction}, totalCreditsNeeded: ${totalCreditsNeeded}, count: ${count}`);
  console.log(`[checkPaywall] paywallResult:`, paywallResult);

  // Check if user has enough credits for the total count
  if (paywallResult.creditsRemaining !== undefined && paywallResult.creditsRemaining < totalCreditsNeeded) {
    console.warn(`[checkPaywall] INSUFFICIENT CREDITS - creditsRemaining: ${paywallResult.creditsRemaining}, totalCreditsNeeded: ${totalCreditsNeeded}`);

    // Lazy import error messages to avoid loading on client-side
    const { CREDIT_ERRORS } = await import('@/lib/messages/errors');
    const localizedMessage = CREDIT_ERRORS.INSUFFICIENT_CREDITS_GENERIC(creditAction);

    const error = fail(JSON.stringify({
      message: localizedMessage,
      upgradeRequired: paywallResult.upgradeRequired ?? true,
      creditsRequired: totalCreditsNeeded,
      creditsRemaining: paywallResult.creditsRemaining,
      totalCredits: paywallResult.totalCredits,
      count
    }), 403);
    if (returnError) return { error };
    throw new Error(localizedMessage);
  }

  // If paywall blocks for single check, return error
  if (!paywallResult.allowed) {
    console.warn(`[checkPaywall] PAYWALL BLOCKED - allowed: ${paywallResult.allowed}, reason: ${paywallResult.reason}`);

    // Lazy import error messages to avoid loading on client-side
    const { CREDIT_ERRORS } = await import('@/lib/messages/errors');
    const localizedMessage = paywallResult.reason || "Paywall check failed";
    const message = localizedMessage === "insufficient_credits"
      ? CREDIT_ERRORS.INSUFFICIENT_CREDITS_GENERIC(creditAction)
      : localizedMessage;

    const error = fail(JSON.stringify({
      message,
      upgradeRequired: paywallResult.upgradeRequired,
      creditsRequired: totalCreditsNeeded,
      creditsRemaining: paywallResult.creditsRemaining,
      totalCredits: paywallResult.totalCredits,
      count
    }), 403);
    if (returnError) return { error };
    throw new Error(paywallResult.reason || "Paywall check failed");
  }

  console.log(`[checkPaywall] PAYWALL CHECK PASSED`);
  return { paywallResult };
}

/**
 * 3. Credit deduction
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
 * Middleware to protect API routes with authentication, paywall, and credit checks
 * 
 */
/**
 * Create default paywall result when skipping paywall check
 */
function createDefaultPaywallResult(totalCreditsNeeded: number): PaywallResult {
  return {
    allowed: true,
    creditsRequired: totalCreditsNeeded,
    creditsRemaining: 0,
    totalCredits: 0
  };
}

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

    // 2. Paywall check (unless skipped)
    const paywallCheckResult = options.skipPaywall
      ? { paywallResult: createDefaultPaywallResult(totalCreditsNeeded) }
      : await checkPaywall(req, creditAction, totalCreditsNeeded, count, options.returnError);
    if ('error' in paywallCheckResult) return paywallCheckResult;
    const { paywallResult } = paywallCheckResult;

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
 * Helper: Check only authentication (no paywall/credits)
 */
export async function withAuthOnly(
  req: NextRequest
): Promise<{ user: User } | ApiProtectionError> {
  return checkAuth(req, true);
}

/**
 * Helper: Check authentication + paywall (no credit deduction)
 * Useful for read-only operations that need to check limits
 */
export async function withAuthAndPaywall(
  req: NextRequest,
  creditAction: keyof typeof CREDIT_COSTS
): Promise<ApiProtectionResult | ApiProtectionError> {
  return withApiProtection(req, creditAction, { skipDeduct: true });
}
