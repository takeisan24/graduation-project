/**
 * Next.js Instrumentation Hook
 * This file runs once when the Next.js server starts
 * Used to automatically import accounts from CSV on startup
 */

let hasImported = false;

export async function register() {
  // Only run in server environment (Node.js runtime, not Edge runtime)
  // This runs on both development and production (including Vercel)
  if (typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
    // Prevent multiple imports if hot reload triggers this multiple times
    if (hasImported) {
      console.log('[instrumentation] Accounts already imported, skipping...');
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const isVercel = !!process.env.VERCEL;
    
    console.log(`[instrumentation] Next.js server starting (${isProduction ? 'production' : 'development'}${isVercel ? ', Vercel' : ''}), auto-importing accounts from CSV...`);
    
    try {
      // Dynamic import to ensure Node.js modules are available
      const { importAccountsFromCSV } = await import("./lib/late/csvImporter");
      
      // Import accounts from CSV (auto-sync metadata)
      const results = await importAccountsFromCSV(true);
      
      console.log(`[instrumentation] Auto-import completed: ${results.imported} imported, ${results.skipped} skipped, ${results.synced} synced`);
      
      hasImported = true;
    } catch (error: any) {
      console.error('[instrumentation] Failed to auto-import accounts:', error);
      // Don't throw - allow server to start even if import fails
      // This is important for Vercel deployments to succeed even if CSV is missing
    }
  }
}

