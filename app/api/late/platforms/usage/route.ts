import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getLateAccounts } from "@/lib/services/late";
import { getPlatformUsageSummary } from "@/lib/services/late";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/late/platforms/usage
 * Get platform usage summary: which platforms are connected and which are available
 * 
 * Returns:
 * - connected_platforms: All platforms that are connected
 * - available_platforms: Platforms that can still be connected
 * - profiles: List of profiles with their connected and available platforms
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get all active late.dev accounts
    const accounts = await getLateAccounts();

    if (accounts.length === 0) {
      return success({
        accounts: [],
        message: "No active late.dev accounts found"
      });
    }

    // Get platform usage summary for each account
    const accountsWithUsage = await Promise.all(
      accounts.map(async (account) => {
        const usage = await getPlatformUsageSummary(account.id);
        return {
          account_id: account.id,
          account_name: account.account_name,
          ...usage
        };
      })
    );

    return success({
      accounts: accountsWithUsage,
      total_accounts: accounts.length
    });

  } catch (err: any) {
    console.error("[late/platforms/usage] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

