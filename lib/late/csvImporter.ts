/**
 * CSV Importer for getlate_accounts
 * Reads Acc_Info.csv and imports accounts into getlate_accounts table
 */

import { supabase } from "@/lib/supabase";
import { syncAccountOnCreate } from "./autoSync";

// Dynamic import for Node.js modules (only available in Node.js runtime)
let fs: typeof import("fs");
let path: typeof import("path");

// Lazy load Node.js modules
async function loadNodeModules() {
  if (!fs || !path) {
    fs = await import("fs");
    path = await import("path");
  }
  return { fs, path };
}

export interface CSVAccountRow {
  api_key: string;
  client_id?: string;
  client_secret?: string;
  webhook_secret?: string;
}

/**
 * Parse CSV file and return array of account rows
 * Automatically removes duplicates within CSV file (keeps first occurrence)
 */
export function parseCSV(csvContent: string): CSVAccountRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return []; // Need at least header + 1 data row
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim());
  const apiKeyIndex = headers.indexOf('api_key');
  const clientIdIndex = headers.indexOf('client_id');
  const clientSecretIndex = headers.indexOf('client_secret');
  const webhookSecretIndex = headers.indexOf('webhook_secret');

  if (apiKeyIndex === -1) {
    throw new Error('CSV file must have "api_key" column');
  }

  // Parse data rows and track duplicates within CSV
  const accounts: CSVAccountRow[] = [];
  const seenApiKeys = new Set<string>(); // Track api_keys seen in CSV to detect duplicates
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = line.split(',').map(v => v.trim());
    const apiKey = values[apiKeyIndex];

    if (!apiKey || apiKey.length === 0) {
      continue; // Skip rows without api_key
    }

    // Check for duplicates within CSV file
    if (seenApiKeys.has(apiKey)) {
      console.warn(`[csvImporter] Duplicate api_key found in CSV (line ${i + 1}): ${apiKey.substring(0, 20)}... - skipping`);
      continue; // Skip duplicate within CSV
    }

    seenApiKeys.add(apiKey);

    accounts.push({
      api_key: apiKey,
      client_id: clientIdIndex >= 0 && values[clientIdIndex] ? values[clientIdIndex] : undefined,
      client_secret: clientSecretIndex >= 0 && values[clientSecretIndex] ? values[clientSecretIndex] : undefined,
      webhook_secret: webhookSecretIndex >= 0 && values[webhookSecretIndex] ? values[webhookSecretIndex] : undefined,
    });
  }

  return accounts;
}

/**
 * Read CSV file from project root
 * Supports both development and production environments
 */
export async function readCSVFile(): Promise<string> {
  // Load Node.js modules
  const { fs: fsModule, path: pathModule } = await loadNodeModules();
  
  // Try multiple possible paths
  const possiblePaths = [
    pathModule.join(process.cwd(), 'db', 'Acc_Info.csv'),
    pathModule.join(process.cwd(), '..', 'db', 'Acc_Info.csv'),
  ];
  
  // Add __dirname path if available (for compiled code)
  try {
    const { fileURLToPath } = await import('url');
    const currentFileUrl = import.meta.url;
    const currentFilePath = fileURLToPath(currentFileUrl);
    const currentDir = pathModule.dirname(currentFilePath);
    possiblePaths.push(pathModule.join(currentDir, '..', '..', 'db', 'Acc_Info.csv'));
  } catch {
    // Ignore if __dirname is not available
  }

  for (const csvPath of possiblePaths) {
    if (fsModule.existsSync(csvPath)) {
      return fsModule.readFileSync(csvPath, 'utf-8');
    }
  }

  // If not found, log warning with all tried paths
  console.warn(`[csvImporter] CSV file not found. Tried paths:`, possiblePaths);
  return '';
}

/**
 * Import accounts from CSV file into getlate_accounts table
 * 
 * @param syncMetadata - Whether to sync metadata after import (default: true)
 * @returns Import results
 */
export async function importAccountsFromCSV(syncMetadata: boolean = true): Promise<{
  imported: number;
  skipped: number;
  errors: Array<{ api_key: string; error: string }>;
  synced: number;
}> {
  console.log(`[csvImporter] Starting import from Acc_Info.csv`);
  
  try {
    // Read CSV file (async)
    const csvContent = await readCSVFile();
    if (!csvContent) {
      return { imported: 0, skipped: 0, errors: [], synced: 0 };
    }

    // Parse CSV
    const csvAccounts = parseCSV(csvContent);
    if (csvAccounts.length === 0) {
      console.log(`[csvImporter] No accounts found in CSV file`);
      return { imported: 0, skipped: 0, errors: [], synced: 0 };
    }

    console.log(`[csvImporter] Found ${csvAccounts.length} unique account(s) in CSV file (after removing duplicates within CSV)`);

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ api_key: string; error: string }>,
      synced: 0
    };

    // Batch check which accounts already exist in DB and their metadata status
    const csvApiKeys = csvAccounts.map(acc => acc.api_key).filter(Boolean);
    
    let existingAccounts: any[] = [];
    let checkError: any = null;
    
    // Check if query is too large (Supabase has limits on .in() array size)
    if (csvApiKeys.length > 1000) {
      console.warn(`[csvImporter] Too many API keys (${csvApiKeys.length}), splitting into batches...`);
      // Split into batches of 1000
      const batches: string[][] = [];
      for (let i = 0; i < csvApiKeys.length; i += 1000) {
        batches.push(csvApiKeys.slice(i, i + 1000));
      }
      
      const allExistingAccounts: any[] = [];
      for (const batch of batches) {
        const { data: batchAccounts, error: batchError } = await supabase
          .from("getlate_accounts")
          .select("id, api_key, metadata")
          .in("api_key", batch);
        
        if (batchError && batchError.code !== 'PGRST116') {
          console.error(`[csvImporter] Error checking batch of ${batch.length} accounts:`, {
            code: batchError.code,
            message: batchError.message,
            details: batchError.details,
            hint: batchError.hint,
            status: (batchError as any).status
          });
          // Continue with other batches even if one fails
        } else if (batchAccounts) {
          allExistingAccounts.push(...batchAccounts);
        }
      }
      
      existingAccounts = allExistingAccounts;
      checkError = null;
    } else {
      const { data, error } = await supabase
        .from("getlate_accounts")
        .select("id, api_key, metadata")
        .in("api_key", csvApiKeys);
      
      existingAccounts = data || [];
      checkError = error;
    }

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned (OK)
      console.error(`[csvImporter] Error checking existing accounts:`, {
        code: checkError.code,
        message: checkError.message,
        details: checkError.details,
        hint: checkError.hint,
        status: (checkError as any).status,
        fullError: checkError
      });
      // If it's a critical Supabase error, log but continue (non-fatal)
      if (checkError.message?.includes('Internal server error') || checkError.code === '500' || (checkError as any).status === 500) {
        console.error(`[csvImporter] CRITICAL: Supabase database error detected. This may indicate Supabase service issues.`);
        console.error(`[csvImporter] Please check: https://status.supabase.com/`);
        // Don't throw - continue with import, existingAccounts will be empty array
      }
    }

    // Create map of existing accounts with their metadata status
    const existingAccountsMap = new Map<string, { id: string; hasMetadata: boolean }>();
    (existingAccounts || []).forEach((acc: any) => {
      const limits = acc.metadata?.limits || {};
      const hasMetadata = limits.max_profiles !== undefined || limits.max_posts_per_month !== undefined;
      existingAccountsMap.set(acc.api_key, { id: acc.id, hasMetadata });
    });

    // Import each account
    for (const csvAccount of csvAccounts) {
      try {
        // Check if account already exists in DB (by api_key)
        const existingAccountInfo = existingAccountsMap.get(csvAccount.api_key);
        
        if (existingAccountInfo) {
          // Account exists - only sync metadata if it doesn't have metadata yet
          if (syncMetadata && csvAccount.api_key && !existingAccountInfo.hasMetadata) {
            try {
              console.log(`[csvImporter] Account ${existingAccountInfo.id} exists but missing metadata, syncing limits and profiles...`);
              // Sync limits AND profiles (syncProfiles=true) - profiles will be checked and added if not exist
              const { syncAccountLimitsFromLateDev } = await import("@/lib/services/late");
              await syncAccountLimitsFromLateDev(existingAccountInfo.id, csvAccount.api_key, true);
              console.log(`[csvImporter] Successfully synced limits and profiles for account ${existingAccountInfo.id}`);
              results.synced++;
            } catch (syncError: any) {
              console.warn(`[csvImporter] Failed to sync metadata for account ${existingAccountInfo.id} (non-fatal):`, syncError);
              // Non-fatal: continue even if sync fails
            }
          } else if (existingAccountInfo.hasMetadata) {
            console.log(`[csvImporter] Account with api_key ${csvAccount.api_key.substring(0, 20)}... already exists with metadata, skipping`);
          } else {
            console.log(`[csvImporter] Account with api_key ${csvAccount.api_key.substring(0, 20)}... already exists, skipping`);
          }
          
          results.skipped++;
          continue;
        }

        // Insert new account
        const { data: insertedAccount, error: insertError } = await supabase
          .from("getlate_accounts")
          .insert({
            api_key: csvAccount.api_key,
            client_id: csvAccount.client_id || null,
            client_secret: csvAccount.client_secret || null,
            webhook_secret: csvAccount.webhook_secret || null,
            is_active: true,
            metadata: {
              limits: {} // Will be synced below
            }
          })
          .select()
          .single();

        if (insertError) {
          // Check if it's a unique constraint violation (duplicate api_key)
          if (insertError.code === '23505' || insertError.message?.includes('unique')) {
            console.log(`[csvImporter] Account with api_key ${csvAccount.api_key.substring(0, 20)}... already exists (race condition), skipping`);
            results.skipped++;
            continue;
          }
          
          // Log detailed error information
          console.error(`[csvImporter] Supabase insert error for account ${csvAccount.api_key.substring(0, 20)}...:`, {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            status: (insertError as any).status,
            fullError: insertError
          });
          
          // Check if it's a Supabase internal server error
          if (insertError.message?.includes('Internal server error') || insertError.code === '500' || (insertError as any).status === 500) {
            throw new Error(`Supabase database error: ${insertError.message}. This may indicate a temporary Supabase issue. Please check Supabase status and try again.`);
          }
          
          throw insertError;
        }

        if (!insertedAccount) {
          throw new Error("Failed to insert account (no data returned)");
        }

        console.log(`[csvImporter] Successfully imported account ${insertedAccount.id} (api_key: ${csvAccount.api_key.substring(0, 20)}...)`);
        results.imported++;

        // Auto-sync limits and profiles for newly imported account
        // Profiles will be checked - if already exist in DB, skip; if not, add to DB
        if (syncMetadata && csvAccount.api_key) {
          try {
            console.log(`[csvImporter] Syncing limits and profiles for new account ${insertedAccount.id}...`);
            // Sync limits AND profiles (syncProfiles=true) - profiles will be checked and added if not exist
              const { syncAccountLimitsFromLateDev } = await import("@/lib/services/late");
            await syncAccountLimitsFromLateDev(insertedAccount.id, csvAccount.api_key, true);
            console.log(`[csvImporter] Auto-synced limits and profiles for account ${insertedAccount.id}`);
            results.synced++;
          } catch (syncError: any) {
            console.warn(`[csvImporter] Failed to sync metadata for account ${insertedAccount.id} (non-fatal):`, syncError);
            // Non-fatal: account is imported, metadata can be synced later
          }
        }
      } catch (error: any) {
        console.error(`[csvImporter] Failed to import account with api_key ${csvAccount.api_key?.substring(0, 20)}...:`, error);
        results.errors.push({
          api_key: csvAccount.api_key || 'unknown',
          error: error.message || String(error)
        });
      }
    }

    console.log(`[csvImporter] Import completed: ${results.imported} imported, ${results.skipped} skipped, ${results.synced} synced, ${results.errors.length} errors`);
    return results;
  } catch (error: any) {
    console.error(`[csvImporter] Error during import:`, error);
    return {
      imported: 0,
      skipped: 0,
      errors: [{ api_key: 'unknown', error: error.message || String(error) }],
      synced: 0
    };
  }
}

