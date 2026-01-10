import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { PLAN_CONFIG, CREDIT_PACKAGES } from "@/lib/payments/lemonsqueezy";

/**
 * GET /api/pricing
 * Get pricing information for all plans and credit packages
 */
export async function GET(req: NextRequest) {
  try {
    return success({
      plans: PLAN_CONFIG,
      creditPackages: CREDIT_PACKAGES,
      features: {
        free: [
          'ai_content',
          'ai_refinement_limited'
        ],
        creator: [
          'ai_content',
          'ai_refinement',
          'branding',
          'unlimited_scheduling'
        ],
        creator_pro: [
          'ai_content',
          'ai_refinement',
          'branding',
          'unlimited_scheduling',
          'team_members'
        ],
        agency: [
          'ai_content',
          'ai_refinement',
          'branding',
          'unlimited_scheduling',
          'team_members',
          'priority_support'
        ]
      }
    });
    
  } catch (err: any) {
    console.error("GET /api/pricing error:", err);
    return fail(err.message || "Server error", 500);
  }
}
