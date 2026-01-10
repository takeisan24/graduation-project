import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { getLateAccounts } from "@/lib/services/late";
import { syncAllAccountsOnStartup } from "@/lib/late/autoSync";

/**
 * POST /api/admin/sync-late-accounts
 * Sync metadata (limits) from late.dev API for all accounts
 * 
 * This endpoint:
 * 1. Loads all active accounts from database
 * 2. For each account, calls late.dev API to get usage stats
 * 3. Updates metadata.limits in database
 * 
 * Can be called:
 * - Manually via API call
 * - On system startup (via cron job or startup script)
 * - Periodically (via cron job)
 * 
 * Query params:
 * - ?force=true - Force sync even if limits already exist
 * 
 * Headers:
 * - x-api-key - Admin API key (if ADMIN_API_KEY is set in env)
 */
export async function POST(req: NextRequest) {
  try {
    // Optional: Check for admin API key
    const apiKey = req.headers.get("x-api-key");
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    if (adminApiKey && apiKey !== adminApiKey) {
      return fail("Unauthorized. Provide valid x-api-key header.", 401);
    }

    const forceSync = req.nextUrl.searchParams.get("force") === "true";
    
    // Use autoSync function for consistency
    const results = await syncAllAccountsOnStartup(forceSync);

    return success({
      message: `Synced ${results.synced} account(s), skipped ${results.skipped}, ${results.errors.length} error(s)`,
      ...results
    });

  } catch (err: any) {
    console.error("[sync-late-accounts] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * GET /api/admin/sync-late-accounts
 * Get sync status for all accounts (without actually syncing)
 */
export async function GET(req: NextRequest) {
  try {
    // Optional: Check for admin API key
    const apiKey = req.headers.get("x-api-key");
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    if (adminApiKey && apiKey !== adminApiKey) {
      return fail("Unauthorized. Provide valid x-api-key header.", 401);
    }

    const accounts = await getLateAccounts();
    
    const status = accounts
      .filter(acc => acc.id !== "env-fallback")
      .map(account => ({
        id: account.id,
        account_name: account.account_name,
        has_limits: !!(account.limits.max_profiles !== undefined || account.limits.max_posts_per_month !== undefined),
        limits: account.limits,
        api_key_present: !!(account.api_key && String(account.api_key).trim().length > 0)
      }));

    return success({
      total_accounts: accounts.length,
      accounts: status,
      message: "Use POST to sync limits from late.dev API"
    });

  } catch (err: any) {
    console.error("[sync-late-accounts] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

