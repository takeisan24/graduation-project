/**
 * Auto-sync metadata for late.dev accounts
 * This module handles automatic syncing of limits from late.dev API
 * 
 * Usage:
 * - Call syncAllAccountsOnStartup() when system starts
 * - Call syncAccountOnCreate() when a new account is created
 */

import { getLateAccounts, syncAccountLimitsFromLateDev } from "@/lib/services/late";

/**
 * Sync metadata for all accounts (called on startup)
 * Only syncs accounts that don't have limits yet (to avoid unnecessary API calls)
 * 
 * @param force - Force sync even if limits already exist (default: false)
 * @returns Promise with sync results
 */
export async function syncAllAccountsOnStartup(force: boolean = false): Promise<{
  synced: number;
  skipped: number;
  errors: Array<{ accountId: string; error: string }>;
}> {
  console.log(`[autoSync] Starting auto-sync for all accounts (force=${force})`);
  
  try {
    // Load all active accounts
    const accounts = await getLateAccounts();
    
    if (accounts.length === 0) {
      console.log(`[autoSync] No active accounts found`);
      return { synced: 0, skipped: 0, errors: [] };
    }

    const results = {
      synced: 0,
      skipped: 0,
      errors: [] as Array<{ accountId: string; error: string }>
    };

    // Sync each account
    for (const account of accounts) {
      // Skip env-fallback account (no DB record)
      if (account.id === "env-fallback") {
        continue;
      }

      try {
        // Check if limits already exist (unless force sync)
        const hasLimits = account.limits.max_profiles !== undefined || 
                         account.limits.max_posts_per_month !== undefined;
        
        if (hasLimits && !force) {
          console.log(`[autoSync] Account ${account.id} already has limits, skipping`);
          results.skipped++;
          continue;
        }

        console.log(`[autoSync] Syncing limits for account ${account.id} (${account.account_name || 'unnamed'})`);
        
        // Sync limits from late.dev API (NOT profiles - profiles only created when user connects social media)
        await syncAccountLimitsFromLateDev(account.id, account.api_key, false);
        
        console.log(`[autoSync] Successfully synced account ${account.id}`);
        results.synced++;
      } catch (error: any) {
        console.error(`[autoSync] Failed to sync account ${account.id}:`, error);
        results.errors.push({
          accountId: account.id,
          error: error.message || String(error)
        });
      }
    }

    console.log(`[autoSync] Finished: synced ${results.synced}, skipped ${results.skipped}, errors ${results.errors.length}`);
    return results;
  } catch (error: any) {
    console.error(`[autoSync] Error during auto-sync:`, error);
    return { synced: 0, skipped: 0, errors: [{ accountId: "unknown", error: error.message || String(error) }] };
  }
}

/**
 * Sync metadata for a specific account (called when account is created)
 * 
 * @param accountId - The getlate_accounts.id
 * @param apiKey - The API key for the account
 * @returns Promise with sync result
 */
export async function syncAccountOnCreate(
  accountId: string,
  apiKey: string,
  syncProfiles: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[autoSync] Auto-syncing new account ${accountId} (syncProfiles=${syncProfiles})`);
    // By default, don't sync profiles - they will be created when user connects social media
    await syncAccountLimitsFromLateDev(accountId, apiKey, syncProfiles);
    console.log(`[autoSync] Successfully synced new account ${accountId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[autoSync] Failed to sync new account ${accountId}:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Check if accounts need syncing (called periodically)
 * Returns true if any account is missing limits
 */
export async function needsSync(): Promise<boolean> {
  try {
    const accounts = await getLateAccounts();
    
    for (const account of accounts) {
      if (account.id === "env-fallback") continue;
      
      const hasLimits = account.limits.max_profiles !== undefined || 
                       account.limits.max_posts_per_month !== undefined;
      
      if (!hasLimits) {
        return true; // Found account without limits
      }
    }
    
    return false; // All accounts have limits
  } catch (error) {
    console.error(`[autoSync] Error checking sync status:`, error);
    return false;
  }
}

