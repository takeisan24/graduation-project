/**
 * Service: Late.dev Account Management
 * 
 * Business logic for managing late.dev accounts, limits, and account selection
 * Refactored from lib/late/accountManager.ts
 */

import { supabase } from "@/lib/supabase";
import { LateClient } from "@/lib/late/client";
import { getActiveAccounts, updateAccountLimits, getAccountById } from "@/lib/services/db/accounts";
import { getProfilesByAccountId } from "@/lib/services/db/profiles";
import { getConnectionsByProfileId } from "@/lib/services/db/connections";

export interface LateAccountLimits {
  max_profiles?: number;
  max_connections?: number;
  max_posts_per_month?: number;
  current_profiles?: number;
  current_connections?: number;
  current_posts_this_month?: number;
  last_reset_month?: string;
}

export interface LateAccountWithLimits {
  id: string;
  account_name: string | null;
  api_key: string;
  client_id: string | null;
  client_secret: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  limits: LateAccountLimits;
  metadata: any;
}

export type LateAccountOperation = 
  | "create_profile" 
  | "connect_social" 
  | "create_post" 
  | "schedule_post";

/**
 * Sync current_profiles count from database
 */
async function syncCurrentProfilesFromDB(accountId: string): Promise<number> {
  try {
    const profiles = await getProfilesByAccountId(accountId);
    return profiles.length;
  } catch (error: any) {
    console.warn(`[late/accountService] Error syncing current_profiles from DB for account ${accountId}:`, error);
    return 0;
  }
}

/**
 * Sync current_connections count from database
 */
async function syncCurrentConnectionsFromDB(accountId: string): Promise<number> {
  try {
    const profiles = await getProfilesByAccountId(accountId);
    if (profiles.length === 0) return 0;
    
    let totalConnections = 0;
    for (const profile of profiles) {
      const connections = await getConnectionsByProfileId(profile.id);
      totalConnections += connections.length;
    }
    
    return totalConnections;
  } catch (error: any) {
    console.warn(`[late/accountService] Error syncing current_connections from DB for account ${accountId}:`, error);
    return 0;
  }
}

/**
 * Sync current_posts_this_month count from database
 */
async function syncCurrentPostsFromDB(accountId: string, currentMonth: string): Promise<number> {
  try {
    const monthStart = new Date(currentMonth + "-01");
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    
    const { supabase } = await import("@/lib/supabase");
    const { count, error } = await supabase
      .from("scheduled_posts")
      .select("*", { count: 'exact', head: true })
      .eq("getlate_account_id", accountId)
      .gte("scheduled_at", monthStart.toISOString())
      .lt("scheduled_at", monthEnd.toISOString());
    
    if (error) {
      console.warn(`[late/accountService] Error counting posts for account ${accountId}:`, error);
      return 0;
    }
    
    return count || 0;
  } catch (error: any) {
    console.warn(`[late/accountService] Error syncing current_posts_this_month from DB for account ${accountId}:`, error);
    return 0;
  }
}

/**
 * Sync account limits from late.dev API
 */
export async function syncAccountLimitsFromLateDev(
  accountId: string,
  apiKey: string,
  syncProfiles: boolean = true
): Promise<LateAccountLimits> {
  try {
    const lateClient = new LateClient(apiKey);
    
    // Get usage stats from late.dev API
    const usageStats = await lateClient.getUsageStats();
    
    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Get existing limits to preserve last_reset_month
    const account = await getAccountById(accountId);
    const existingLimits = account?.metadata?.limits || {};
    const lastResetMonth = existingLimits.last_reset_month;
    
    // Handle monthly reset for posts
    let postsThisMonth = usageStats.usage?.uploads || 0;
    if (lastResetMonth && lastResetMonth !== currentMonth) {
      console.log(`[late/accountService] New month detected (${lastResetMonth} -> ${currentMonth}), resetting post count`);
      postsThisMonth = 0;
    }
    
    // Build limits object
    const limits: LateAccountLimits = {
      max_profiles: usageStats.limits?.profiles === -1 ? undefined : usageStats.limits?.profiles,
      max_posts_per_month: usageStats.limits?.uploads === -1 ? undefined : usageStats.limits?.uploads,
      current_profiles: usageStats.usage?.profiles || 0,
      current_posts_this_month: postsThisMonth,
      last_reset_month: lastResetMonth || currentMonth
    };
    
    // Update limits in DB (only if not env fallback)
    if (accountId !== "env-fallback") {
      await updateAccountLimits(accountId, limits);
      console.log(`[late/accountService] Synced limits for account ${accountId} from late.dev API`);
      
      // Sync profiles if requested
      if (syncProfiles) {
        try {
          await syncProfilesFromLateDev(accountId, apiKey);
        } catch (profileSyncError: any) {
          console.warn(`[late/accountService] Failed to sync profiles (non-fatal):`, profileSyncError);
        }
      }
    }
    
    return limits;
  } catch (error: any) {
    console.error(`[late/accountService] Error syncing limits from late.dev API:`, error);
    // Return empty limits on error (non-fatal)
    return {};
  }
}

/**
 * Sync profiles from late.dev API to database
 */
async function syncProfilesFromLateDev(accountId: string, apiKey: string): Promise<number> {
  try {
    const { syncAndCleanupProfiles } = await import("./profileService");
    const result = await syncAndCleanupProfiles(accountId, apiKey);
    return result.syncedCount;
  } catch (error: any) {
    console.error(`[late/accountService] Error syncing profiles from late.dev API:`, error);
    return 0;
  }
}

/**
 * Check if account can perform operation
 */
export function canPerformOperation(
  account: LateAccountWithLimits,
  operation: LateAccountOperation
): { canPerform: boolean; reason?: string } {
  const { limits } = account;

  switch (operation) {
    case "create_profile":
      return checkProfileLimit(limits);
    
    case "connect_social":
      return checkConnectionLimit(limits);
    
    case "create_post":
    case "schedule_post":
      return checkPostLimit(limits);
    
    default:
      return { canPerform: false, reason: `Unknown operation: ${operation}` };
  }
}

/**
 * Check profile limit
 */
function checkProfileLimit(limits: LateAccountLimits): { canPerform: boolean; reason?: string } {
  if (limits.max_profiles === undefined) {
    return { canPerform: true };
  }
  
  const current = limits.current_profiles || 0;
  if (current >= limits.max_profiles) {
    return {
      canPerform: false,
      reason: `Account has reached profile limit (${current}/${limits.max_profiles})`
    };
  }
  
  return { canPerform: true };
}

/**
 * Check connection limit
 */
function checkConnectionLimit(limits: LateAccountLimits): { canPerform: boolean; reason?: string } {
  if (limits.max_connections === undefined) {
    return { canPerform: true };
  }
  
  const current = limits.current_connections || 0;
  if (current >= limits.max_connections) {
    return {
      canPerform: false,
      reason: `Account has reached connection limit (${current}/${limits.max_connections})`
    };
  }
  
  return { canPerform: true };
}

/**
 * Check post limit
 */
function checkPostLimit(limits: LateAccountLimits): { canPerform: boolean; reason?: string } {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const lastResetMonth = limits.last_reset_month;
  
  // Check if monthly reset is needed
  if (lastResetMonth !== currentMonth && limits.current_posts_this_month !== undefined) {
    console.log(`[late/accountService] Monthly reset needed (${lastResetMonth || 'never'} -> ${currentMonth})`);
  }
  
  if (limits.max_posts_per_month === undefined) {
    return { canPerform: true };
  }
  
  const current = limits.current_posts_this_month || 0;
  if (current >= limits.max_posts_per_month) {
    return {
      canPerform: false,
      reason: `Account has reached monthly post limit (${current}/${limits.max_posts_per_month})`
    };
  }
  
  return { canPerform: true };
}

/**
 * Get all active late.dev accounts with synced limits
 */
export async function getLateAccounts(): Promise<LateAccountWithLimits[]> {
  const accounts = await getActiveAccounts();

  if (accounts.length === 0) {
    return [];
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const mapped = await Promise.all(accounts.map(async (account) => {
    const limits = account.metadata?.limits || {};
    const lastResetMonth = limits.last_reset_month;
    
    // Auto-sync limits if missing
    const hasLimits = limits.max_profiles !== undefined || limits.max_posts_per_month !== undefined;
    if (!hasLimits && account.api_key) {
      try {
        console.log(`[late/accountService] Account ${account.id} missing limits, auto-syncing...`);
        const syncedLimits = await syncAccountLimitsFromLateDev(account.id, account.api_key);
        Object.assign(limits, syncedLimits);
      } catch (syncError: any) {
        console.warn(`[late/accountService] Failed to auto-sync limits:`, syncError);
      }
    }
    
    // Sync current counts from DB
    const dbCurrentProfiles = await syncCurrentProfilesFromDB(account.id);
    const dbCurrentConnections = await syncCurrentConnectionsFromDB(account.id);
    
    // Handle monthly post reset
    let dbCurrentPosts = 0;
    if (lastResetMonth === currentMonth) {
      dbCurrentPosts = await syncCurrentPostsFromDB(account.id, currentMonth);
    } else {
      dbCurrentPosts = 0;
      if (lastResetMonth && lastResetMonth !== currentMonth) {
        console.log(`[late/accountService] Resetting monthly post count (${lastResetMonth} -> ${currentMonth})`);
      }
    }
    
    // Update limits
    const updatedLimits: LateAccountLimits = {
      ...limits,
      current_profiles: dbCurrentProfiles,
      current_connections: dbCurrentConnections,
      current_posts_this_month: dbCurrentPosts,
      last_reset_month: lastResetMonth || currentMonth
    };
    
    // Update DB if values changed
    const needsUpdate = 
      limits.current_profiles !== dbCurrentProfiles ||
      limits.current_connections !== dbCurrentConnections ||
      limits.current_posts_this_month !== dbCurrentPosts ||
      (lastResetMonth !== currentMonth && limits.current_posts_this_month !== undefined);
    
    if (needsUpdate) {
      await updateAccountLimits(account.id, {
        current_profiles: dbCurrentProfiles,
        current_connections: dbCurrentConnections,
        current_posts_this_month: dbCurrentPosts,
        last_reset_month: updatedLimits.last_reset_month
      });
    }
    
    return {
      id: account.id,
      account_name: account.account_name,
      api_key: account.api_key,
      client_id: account.client_id,
      client_secret: account.client_secret,
      webhook_secret: account.webhook_secret,
      is_active: account.is_active,
      limits: updatedLimits,
      metadata: {
        ...account.metadata,
        limits: updatedLimits
      }
    };
  }));

  return mapped;
}

/**
 * Select best account for operation
 */
export async function selectLateAccount(
  operation: LateAccountOperation
): Promise<LateAccountWithLimits | null> {
  const accounts = await getLateAccounts();

  // Fallback to env variables if no accounts
  if (accounts.length === 0) {
    return createFallbackAccountFromEnv();
  }

  // Filter accounts that can perform operation
  const availableAccounts = accounts.filter(account => {
    const check = canPerformOperation(account, operation);
    return check.canPerform;
  });

  if (availableAccounts.length === 0) {
    return null;
  }

  // Select account with most remaining capacity
  return selectBestAccount(availableAccounts, operation);
}

/**
 * Create fallback account from environment variables
 */
function createFallbackAccountFromEnv(): LateAccountWithLimits | null {
  const envApiKey = process.env.LATE_API_KEY;
  if (!envApiKey || String(envApiKey).trim().length === 0) {
    return null;
  }

  console.log("[late/accountService] Using API key from environment variable");
  return {
    id: "env-fallback",
    account_name: "Environment Fallback",
    api_key: envApiKey,
    client_id: process.env.LATE_CLIENT_ID || null,
    client_secret: process.env.LATE_CLIENT_SECRET || null,
    webhook_secret: process.env.LATE_WEBHOOK_SECRET || null,
    is_active: true,
    limits: {},
    metadata: {}
  };
}

/**
 * Select best account based on remaining capacity
 */
function selectBestAccount(
  accounts: LateAccountWithLimits[],
  operation: LateAccountOperation
): LateAccountWithLimits {
  return accounts.reduce((best, current) => {
    const bestRemaining = calculateRemainingCapacity(best, operation);
    const currentRemaining = calculateRemainingCapacity(current, operation);
    
    if (currentRemaining > bestRemaining) {
      return current;
    }
    if (currentRemaining === bestRemaining) {
      // If same capacity, prefer account with less current usage
      return getAccountWithLessUsage(best, current, operation);
    }
    return best;
  });
}

/**
 * Calculate remaining capacity for operation
 */
function calculateRemainingCapacity(
  account: LateAccountWithLimits,
  operation: LateAccountOperation
): number {
  const { limits } = account;
  
  switch (operation) {
    case "create_profile":
      if (limits.max_profiles === undefined) return Infinity;
      return (limits.max_profiles || 0) - (limits.current_profiles || 0);
    
    case "connect_social":
      if (limits.max_connections === undefined) return Infinity;
      return (limits.max_connections || 0) - (limits.current_connections || 0);
    
    case "create_post":
    case "schedule_post":
      if (limits.max_posts_per_month === undefined) return Infinity;
      return (limits.max_posts_per_month || 0) - (limits.current_posts_this_month || 0);
    
    default:
      return 0;
  }
}

/**
 * Get account with less current usage
 */
function getAccountWithLessUsage(
  account1: LateAccountWithLimits,
  account2: LateAccountWithLimits,
  operation: LateAccountOperation
): LateAccountWithLimits {
  const getCurrentUsage = (account: LateAccountWithLimits): number => {
    const { limits } = account;
    switch (operation) {
      case "create_profile":
        return limits.current_profiles || 0;
      case "connect_social":
        return limits.current_connections || 0;
      case "create_post":
      case "schedule_post":
        return limits.current_posts_this_month || 0;
      default:
        return 0;
    }
  };
  
  return getCurrentUsage(account1) <= getCurrentUsage(account2) ? account1 : account2;
}

/**
 * Get LateClient instance for account
 */
export function getLateClientForAccount(account: LateAccountWithLimits): LateClient {
  return new LateClient(
    account.api_key,
    account.client_id || undefined,
    account.client_secret || undefined
  );
}

/**
 * Select account for profile creation
 */
export async function selectAccountForProfileCreation(): Promise<LateAccountWithLimits | null> {
  return selectLateAccount("create_profile");
}

/**
 * Increment account usage after performing an operation
 */
export async function incrementAccountUsage(
  accountId: string,
  operation: LateAccountOperation
): Promise<void> {
  const account = await getAccountById(accountId);
  if (!account) {
    console.warn(`[late/accountService] Account ${accountId} not found for incrementing usage`);
    return;
  }

  const limits = account.metadata?.limits || {};
  const updates: Partial<LateAccountLimits> = {};

  switch (operation) {
    case "create_profile":
      updates.current_profiles = (limits.current_profiles || 0) + 1;
      break;
    
    case "connect_social":
      updates.current_connections = (limits.current_connections || 0) + 1;
      break;
    
    case "create_post":
    case "schedule_post":
      updates.current_posts_this_month = (limits.current_posts_this_month || 0) + 1;
      break;
  }

  if (Object.keys(updates).length > 0) {
    await updateAccountLimits(accountId, updates);
    console.log(`[late/accountService] Incremented ${operation} usage for account ${accountId}`);
  }
}

