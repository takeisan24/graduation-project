import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { syncAllAccountsOnStartup, needsSync } from "@/lib/late/autoSync";
import { importAccountsFromCSV } from "@/lib/late/csvImporter";

/**
 * POST /api/admin/startup-sync
 * Auto-sync metadata for all late.dev accounts on system startup
 * 
 * This endpoint is designed to be called automatically:
 * - On Vercel deployment (via deployment hook)
 * - On system startup (via startup script)
 * - Periodically (via cron job)
 * 
 * It only syncs accounts that don't have limits yet (to avoid unnecessary API calls)
 * 
 * Query params:
 * - ?force=true - Force sync even if limits already exist
 * 
 * Headers:
 * - x-api-key - Admin API key (optional, if ADMIN_API_KEY is set in env)
 * - x-vercel-cron - Set to "1" if called from Vercel Cron (bypasses auth)
 */
export async function POST(req: NextRequest) {
  try {
    // Check if called from Vercel Cron
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    const apiKey = req.headers.get("x-api-key");
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    // Require auth unless called from Vercel Cron
    if (!isVercelCron && adminApiKey && apiKey !== adminApiKey) {
      return fail("Unauthorized. Provide valid x-api-key header or call from Vercel Cron.", 401);
    }

    const forceSync = req.nextUrl.searchParams.get("force") === "true";
    const skipImport = req.nextUrl.searchParams.get("skip_import") === "true";
    
    // Step 1: Import accounts from CSV file (if not skipped)
    let importResults: {
      imported: number;
      skipped: number;
      errors: Array<{ api_key: string; error: string }>;
      synced: number;
    } = { imported: 0, skipped: 0, errors: [], synced: 0 };
    if (!skipImport) {
      console.log(`[startup-sync] Step 1: Importing accounts from Acc_Info.csv...`);
      importResults = await importAccountsFromCSV(true); // Auto-sync metadata after import
      console.log(`[startup-sync] Import completed: ${importResults.imported} imported, ${importResults.skipped} skipped`);
    } else {
      console.log(`[startup-sync] Skipping CSV import (skip_import=true)`);
    }
    
    // Step 2: Sync metadata for all accounts (including newly imported ones)
    // Check if sync is needed (unless force)
    if (!forceSync) {
      const needsSyncCheck = await needsSync();
      if (!needsSyncCheck && importResults.imported === 0) {
        console.log(`[startup-sync] All accounts already have limits and no new accounts imported, skipping sync`);
        return success({
          message: "All accounts already have limits. Use ?force=true to override.",
          import: importResults,
          sync: { synced: 0, skipped: 0, errors: [] },
          triggered_by: isVercelCron ? "vercel-cron" : apiKey ? "api-key" : "manual"
        });
      }
    }
    
    console.log(`[startup-sync] Step 2: Syncing metadata for all accounts (force=${forceSync})`);
    
    // Sync all accounts
    const syncResults = await syncAllAccountsOnStartup(forceSync);

    return success({
      message: `Startup sync completed: ${importResults.imported} account(s) imported, ${syncResults.synced} account(s) synced`,
      import: importResults,
      sync: syncResults,
      triggered_by: isVercelCron ? "vercel-cron" : apiKey ? "api-key" : "manual"
    });

  } catch (err: any) {
    console.error("[startup-sync] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * GET /api/admin/startup-sync
 * Check if accounts need syncing (without actually syncing)
 */
export async function GET(req: NextRequest) {
  try {
    const needsSyncCheck = await needsSync();
    
    return success({
      needs_sync: needsSyncCheck,
      message: needsSyncCheck 
        ? "Some accounts are missing limits. Use POST to sync."
        : "All accounts have limits."
    });

  } catch (err: any) {
    console.error("[startup-sync] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

