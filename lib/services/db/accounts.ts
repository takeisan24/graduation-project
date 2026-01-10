/**
 * Database Service: Accounts
 * 
 * Handles all database operations related to getlate_accounts table
 */

import { supabase } from "@/lib/supabase";

export interface AccountMetadata {
  limits?: {
    current_profiles?: number;
    max_profiles?: number;
    current_connections?: number;
    max_connections?: number;
    [key: string]: any;
  };
  usage?: {
    [key: string]: any;
  };
  [key: string]: any;
}

export interface LateAccount {
  id: string;
  account_name: string | null;
  api_key: string;
  client_id: string | null;
  client_secret: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  metadata: AccountMetadata;
  created_at: string;
  updated_at: string;
}

/**
 * Get all active accounts
 */
export async function getActiveAccounts(): Promise<LateAccount[]> {
  const { data, error } = await supabase
    .from("getlate_accounts")
    .select("*")
    .eq("is_active", true);
  
  if (error) {
    console.error("[db/accounts] Error getting active accounts:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Get account by ID
 */
export async function getAccountById(id: string): Promise<LateAccount | null> {
  const { data, error } = await supabase
    .from("getlate_accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  
  if (error) {
    console.error("[db/accounts] Error getting account:", error);
    return null;
  }
  
  return data;
}

/**
 * Get account by API key
 */
export async function getAccountByApiKey(apiKey: string): Promise<LateAccount | null> {
  const { data, error } = await supabase
    .from("getlate_accounts")
    .select("*")
    .eq("api_key", apiKey)
    .maybeSingle();
  
  if (error) {
    console.error("[db/accounts] Error getting account by API key:", error);
    return null;
  }
  
  return data;
}

/**
 * Get accounts by multiple API keys
 * Returns only api_key field for checking existence
 */
export async function getAccountsByApiKeys(apiKeys: string[]): Promise<Array<{ api_key: string }>> {
  if (apiKeys.length === 0) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("getlate_accounts")
    .select("api_key")
    .in("api_key", apiKeys);
  
  if (error) {
    console.error("[db/accounts] Error getting accounts by API keys:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Create account
 */
export async function createAccount(data: {
  account_name?: string | null;
  api_key: string;
  client_id?: string | null;
  client_secret?: string | null;
  webhook_secret?: string | null;
  is_active?: boolean;
  metadata?: AccountMetadata;
}): Promise<LateAccount | null> {
  const { data: account, error } = await supabase
    .from("getlate_accounts")
    .insert({
      account_name: data.account_name || null,
      api_key: data.api_key,
      client_id: data.client_id || null,
      client_secret: data.client_secret || null,
      webhook_secret: data.webhook_secret || null,
      is_active: data.is_active ?? true,
      metadata: data.metadata || {}
    })
    .select()
    .single();
  
  if (error) {
    console.error("[db/accounts] Error creating account:", error);
    return null;
  }
  
  return account;
}

/**
 * Update account
 */
export async function updateAccount(
  id: string,
  updates: Partial<LateAccount>
): Promise<boolean> {
  const { error } = await supabase
    .from("getlate_accounts")
    .update(updates)
    .eq("id", id);
  
  if (error) {
    console.error("[db/accounts] Error updating account:", error);
    return false;
  }
  
  return true;
}

/**
 * Update account metadata
 */
export async function updateAccountMetadata(
  id: string,
  metadata: Partial<AccountMetadata>
): Promise<boolean> {
  const { data: account } = await supabase
    .from("getlate_accounts")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();
  
  if (!account) {
    console.error("[db/accounts] Account not found:", id);
    return false;
  }
  
  const updatedMetadata = {
    ...(account.metadata || {}),
    ...metadata
  };
  
  const { error } = await supabase
    .from("getlate_accounts")
    .update({ metadata: updatedMetadata })
    .eq("id", id);
  
  if (error) {
    console.error("[db/accounts] Error updating account metadata:", error);
    return false;
  }
  
  return true;
}

/**
 * Update account limits in metadata
 */
export async function updateAccountLimits(
  id: string,
  limits: Partial<AccountMetadata['limits']>
): Promise<boolean> {
  const { data: account } = await supabase
    .from("getlate_accounts")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();
  
  if (!account) {
    console.error("[db/accounts] Account not found:", id);
    return false;
  }
  
  const currentMetadata = account.metadata || {};
  const currentLimits = currentMetadata.limits || {};
  
  const updatedMetadata = {
    ...currentMetadata,
    limits: {
      ...currentLimits,
      ...limits
    }
  };
  
  const { error } = await supabase
    .from("getlate_accounts")
    .update({ metadata: updatedMetadata })
    .eq("id", id);
  
  if (error) {
    console.error("[db/accounts] Error updating account limits:", error);
    return false;
  }
  
  return true;
}

/**
 * Deactivate account
 */
export async function deactivateAccount(id: string): Promise<boolean> {
  return updateAccount(id, { is_active: false });
}

/**
 * Activate account
 */
export async function activateAccount(id: string): Promise<boolean> {
  return updateAccount(id, { is_active: true });
}

