import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { importAccountsFromCSV } from "@/lib/late/csvImporter";

/**
 * POST /api/admin/import-accounts
 * Import accounts from Acc_Info.csv into getlate_accounts table
 * 
 * This endpoint:
 * 1. Reads Acc_Info.csv from db/ directory
 * 2. Parses CSV and extracts account information
 * 3. Inserts accounts into getlate_accounts table (skips duplicates)
 * 4. Auto-syncs metadata for newly imported accounts
 * 
 * Query params:
 * - ?skip_sync=true - Skip metadata sync after import
 * 
 * Headers:
 * - x-api-key - Admin API key (optional, if ADMIN_API_KEY is set in env)
 */
export async function POST(req: NextRequest) {
  try {
    // Optional: Check for admin API key
    const apiKey = req.headers.get("x-api-key");
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    if (adminApiKey && apiKey !== adminApiKey) {
      return fail("Unauthorized. Provide valid x-api-key header.", 401);
    }

    const skipSync = req.nextUrl.searchParams.get("skip_sync") === "true";
    
    console.log(`[import-accounts] Starting import from Acc_Info.csv (skip_sync=${skipSync})`);
    
    // Import accounts from CSV
    const results = await importAccountsFromCSV(!skipSync);

    return success({
      message: `Import completed: ${results.imported} imported, ${results.skipped} skipped, ${results.synced} synced, ${results.errors.length} errors`,
      ...results
    });

  } catch (err: any) {
    console.error("[import-accounts] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * GET /api/admin/import-accounts
 * Check CSV file and preview accounts that would be imported (without actually importing)
 */
export async function GET(req: NextRequest) {
  try {
    // Optional: Check for admin API key
    const apiKey = req.headers.get("x-api-key");
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    if (adminApiKey && apiKey !== adminApiKey) {
      return fail("Unauthorized. Provide valid x-api-key header.", 401);
    }

    const { readCSVFile, parseCSV } = await import("@/lib/late/csvImporter");
    const { getAccountsByApiKeys } = await import("@/lib/services/db/accounts");
    
    // Read and parse CSV (async)
    const csvContent = await readCSVFile();
    if (!csvContent) {
      return success({
        message: "CSV file not found or empty",
        accounts: [],
        existing: [],
        new: []
      });
    }

    const csvAccounts = parseCSV(csvContent);
    
    // Check for duplicates within CSV (should already be handled by parseCSV, but double-check)
    const csvApiKeys = csvAccounts.map(acc => acc.api_key).filter(Boolean);
    const csvDuplicates = csvApiKeys.filter((key, index) => csvApiKeys.indexOf(key) !== index);
    const uniqueCsvApiKeys = new Set(csvApiKeys);
    
    // Check which accounts already exist in DB via service layer
    const existingAccounts = await getAccountsByApiKeys(Array.from(uniqueCsvApiKeys));
    const existingApiKeys = new Set(existingAccounts.map(acc => acc.api_key));
    
    const newAccounts = csvAccounts.filter(acc => !existingApiKeys.has(acc.api_key));
    const existingAccountsList = csvAccounts.filter(acc => existingApiKeys.has(acc.api_key));

    return success({
      message: `Found ${csvAccounts.length} unique account(s) in CSV: ${newAccounts.length} new, ${existingAccountsList.length} existing in DB${csvDuplicates.length > 0 ? `, ${csvDuplicates.length} duplicate(s) in CSV (already removed)` : ''}`,
      total: csvAccounts.length,
      new: newAccounts.length,
      existing: existingAccountsList.length,
      csv_duplicates: csvDuplicates.length,
      accounts: csvAccounts.map(acc => ({
        api_key: acc.api_key?.substring(0, 20) + "...",
        client_id: acc.client_id || null,
        has_client_secret: !!acc.client_secret,
        has_webhook_secret: !!acc.webhook_secret,
        exists_in_db: existingApiKeys.has(acc.api_key),
        is_csv_duplicate: csvDuplicates.includes(acc.api_key)
      }))
    });

  } catch (err: any) {
    console.error("[import-accounts] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

