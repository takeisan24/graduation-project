/**
 * Service: Late.dev Validation
 * 
 * Business logic for validating late.dev operations
 * Refactored from lib/late/operationValidator.ts with reduced if-else nesting
 */

import { findConnectionsByUserId } from "@/lib/services/db/connections";
import { 
  getLateAccounts, 
  selectLateAccount, 
  selectAccountForProfileCreation,
  syncAccountLimitsFromLateDev,
  canPerformOperation,
  getLateClientForAccount,
  type LateAccountWithLimits
} from "./accountService";
import { findProfileWithoutPlatform } from "./profileService";

export interface ValidationResult {
  canProceed: boolean;
  errorMessage?: string;
  account?: LateAccountWithLimits;
  profileId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Validate connection request for a social media platform
 * Refactored: Split into smaller functions to reduce nesting
 */
export async function validateConnectionRequest(
  provider: string,
  userId: string
): Promise<ValidationResult> {
  try {
    console.log(`[late/validationService] Validating connection request for ${provider}...`);
    
    // Step 1: Check for existing profile without this platform
    const existingProfileResult = await checkExistingProfile(provider);
    if (existingProfileResult.canProceed) {
      return existingProfileResult;
    }
    
    // Step 2: Sync and check again
    await syncAllAccountLimits();
    const existingProfileAfterSync = await checkExistingProfile(provider);
    if (existingProfileAfterSync.canProceed) {
      return existingProfileAfterSync;
    }
    
    // Step 3: Check if we can create new profile
    return await checkProfileCreation(provider);
    
  } catch (error: any) {
    console.error(`[late/validationService] Error validating connection request:`, error);
    return {
      canProceed: false,
      errorMessage: `Failed to validate connection request: ${error.message}`
    };
  }
}

/**
 * Check for existing profile without platform connection
 */
async function checkExistingProfile(provider: string): Promise<ValidationResult> {
  const existingProfile = await findProfileWithoutPlatform(provider);
  
  if (!existingProfile) {
    return { canProceed: false };
  }
  
  console.log(`[late/validationService] ✅ Found existing profile ${existingProfile.late_profile_id} without ${provider} connection`);
  
  const account = await getAccountForProfile(existingProfile);
  if (!account) {
    return {
      canProceed: false,
      errorMessage: "No available late.dev account found. Please configure an account first."
    };
  }
  
  await syncAccountLimits(account);
  
  const check = canPerformOperation(account, "connect_social");
  if (!check.canPerform) {
    return {
      canProceed: false,
      errorMessage: check.reason || `Account has reached connection limit. Cannot connect ${provider}.`
    };
  }
  
  return {
    canProceed: true,
    account,
    profileId: existingProfile.late_profile_id,
    metadata: {
      profileFromDB: true,
      profileId: existingProfile.id
    }
  };
}

// findProfileWithoutPlatform is imported from profileService

/**
 * Get account for profile
 */
async function getAccountForProfile(profile: any): Promise<LateAccountWithLimits | null> {
  if (profile.getlate_account_id) {
    const accounts = await getLateAccounts();
    const account = accounts.find(acc => acc.id === profile.getlate_account_id);
    if (account) {
      return account;
    }
  }
  
  return selectLateAccount("connect_social");
}

/**
 * Sync account limits
 */
async function syncAccountLimits(account: LateAccountWithLimits): Promise<void> {
  try {
    const syncedLimits = await syncAccountLimitsFromLateDev(account.id, account.api_key);
    account.limits = syncedLimits;
    console.log(`[late/validationService] ✅ Synced limits for account ${account.id}`);
  } catch (syncError: any) {
    console.warn(`[late/validationService] ⚠️ Failed to sync limits:`, syncError.message);
  }
}

/**
 * Sync all account limits
 */
async function syncAllAccountLimits(): Promise<void> {
  const accounts = await getLateAccounts();
  
  for (const acc of accounts) {
    try {
      const syncedLimits = await syncAccountLimitsFromLateDev(acc.id, acc.api_key, true);
      acc.limits = syncedLimits;
      console.log(`[late/validationService] ✅ Synced limits for account ${acc.id}`);
    } catch (syncError: any) {
      console.warn(`[late/validationService] ⚠️ Failed to sync limits for account ${acc.id}:`, syncError.message);
    }
  }
}

/**
 * Check if we can create new profile
 */
async function checkProfileCreation(provider: string): Promise<ValidationResult> {
  console.log(`[late/validationService] No existing profile found. Checking if account can create new profile...`);
  
  const accountForProfile = await selectAccountForProfileCreation();
  
  if (!accountForProfile) {
    const accounts = await getLateAccounts();
    const limitsInfo = accounts.map(acc => {
      const limits = acc.limits || {};
      return `Account ${acc.id}: ${limits.current_profiles || 0}/${limits.max_profiles || 'unlimited'} profiles`;
    }).join(', ');
    
    return {
      canProceed: false,
      errorMessage: `All late.dev accounts have reached their profile limit. Cannot create new profile to connect ${provider}. Please upgrade your plan or remove unused profiles. Details: ${limitsInfo}`
    };
  }
  
  console.log(`[late/validationService] ✅ Account ${accountForProfile.id} can create new profile`);
  
  return {
    canProceed: true,
    account: accountForProfile,
    profileId: null,
    metadata: {
      needsProfileCreation: true
    }
  };
}

/**
 * Validate posting request for a social media platform
 * Refactored: Split into smaller functions to reduce nesting
 */
export async function validatePostingRequest(
  connectedAccountId: string,
  userId: string
): Promise<ValidationResult> {
  try {
    console.log(`[late/validationService] Validating posting request for connected account ${connectedAccountId}...`);
    
    const connectedAccount = await getConnectedAccount(connectedAccountId, userId);
    if (!connectedAccount) {
      return {
        canProceed: false,
        errorMessage: "Connected account not found or you don't have permission to use it."
      };
    }
    
    const profile = await getProfileForConnection(connectedAccount);
    if (!profile) {
      return {
        canProceed: false,
        errorMessage: "Profile information not found for this connected account."
      };
    }
    
    const account = await getAccountForProfileId(profile.getlate_account_id);
    if (!account) {
      return {
        canProceed: false,
        errorMessage: "Late.dev account not found for this profile."
      };
    }
    
    await syncAccountLimits(account);
    
    const check = canPerformOperation(account, "create_post");
    if (!check.canPerform) {
      return buildPostLimitError(account, connectedAccount.platform, check.reason);
    }
    
    console.log(`[late/validationService] ✅ Account ${account.id} can post to ${connectedAccount.platform}`);
    
    return {
      canProceed: true,
      account,
      profileId: profile.late_profile_id,
      metadata: {
        platform: connectedAccount.platform,
        connectedAccountId: connectedAccount.id
      }
    };
    
  } catch (error: any) {
    console.error(`[late/validationService] Error validating posting request:`, error);
    return {
      canProceed: false,
      errorMessage: `Failed to validate posting request: ${error.message}`
    };
  }
}

/**
 * Get connected account
 */
async function getConnectedAccount(connectedAccountId: string, userId: string) {
  const { supabase } = await import("@/lib/supabase");
  
  const { data, error } = await supabase
    .from("connected_accounts")
    .select(`
      id,
      platform,
      getlate_profile_id,
      getlate_profiles!inner(
        id,
        getlate_account_id,
        late_profile_id
      )
    `)
    .eq("id", connectedAccountId)
    .eq("user_id", userId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data;
}

/**
 * Get profile for connection
 */
function getProfileForConnection(connectedAccount: any) {
  const profile = connectedAccount.getlate_profiles;
  if (!profile || !profile.getlate_account_id) {
    return null;
  }
  return profile;
}

/**
 * Get account for profile ID
 */
async function getAccountForProfileId(accountId: string): Promise<LateAccountWithLimits | null> {
  const accounts = await getLateAccounts();
  return accounts.find(acc => acc.id === accountId) || null;
}

/**
 * Build post limit error message
 */
function buildPostLimitError(
  account: LateAccountWithLimits,
  platform: string,
  reason?: string
): ValidationResult {
  const limits = account.limits || {};
  const current = limits.current_posts_this_month || 0;
  const max = limits.max_posts_per_month;
  
  const errorMessage = max !== undefined
    ? `Account has reached monthly post limit (${current}/${max}). Cannot post to ${platform}. Please wait until next month or upgrade your plan.`
    : reason || `Cannot post to ${platform}.`;
  
  return {
    canProceed: false,
    errorMessage
  };
}

/**
 * Create profile for connection
 */
export async function createProfileForConnection(
  account: LateAccountWithLimits,
  provider: string,
  userId: string
): Promise<{ profileId: string; profileName: string }> {
  const { generateProfileName } = await import("@/lib/late/profileNameGenerator");
  const accountLateClient = getLateClientForAccount(account);
  
  const profileName = await generateProfileName();
  
  console.log(`[late/validationService] Creating new profile "${profileName}" for ${provider}...`);
  const newProfile = await accountLateClient.createProfile(profileName);
  
  if (!newProfile?.id) {
    throw new Error("Failed to create profile: No profile ID returned from late.dev");
  }
  
  const profileId = newProfile.id;
  console.log(`[late/validationService] ✅ Created new profile ${profileId} for ${provider}`);
  
  await saveProfileToDB(account.id, profileId, profileName, provider, userId);
  await updateAccountLimitsAfterProfileCreation(account);
  
  return { profileId, profileName };
}

/**
 * Save profile to DB
 */
async function saveProfileToDB(
  accountId: string,
  profileId: string,
  profileName: string,
  provider: string,
  userId: string
): Promise<void> {
  const { createProfile } = await import("@/lib/services/db/profiles");
  
  try {
    await createProfile({
      getlate_account_id: accountId,
      late_profile_id: profileId,
      profile_name: profileName,
      metadata: {
        created_via: "auto_create_on_connect",
        provider: provider,
        created_at: new Date().toISOString(),
        pending_user_id: userId,
        pending_provider: provider,
        pending_timestamp: Date.now()
      }
    });
    
    console.log(`[late/validationService] ✅ Saved profile ${profileId} to DB`);
  } catch (saveError: any) {
    console.warn(`[late/validationService] Failed to save profile to DB:`, saveError);
  }
}

/**
 * Update account limits after profile creation
 */
async function updateAccountLimitsAfterProfileCreation(account: LateAccountWithLimits): Promise<void> {
  const { updateAccountLimits } = await import("@/lib/services/db/accounts");
  
  try {
    await updateAccountLimits(account.id, {
      current_profiles: (account.limits.current_profiles || 0) + 1
    });
    console.log(`[late/validationService] ✅ Updated account limits`);
  } catch (limitError: any) {
    console.warn(`[late/validationService] Failed to update account limits:`, limitError.message);
  }
}

