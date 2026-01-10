/**
 * URL Configuration Utility
 * Centralizes application URL management and ensures reliable formatting (no spaces, no trailing slashes).
 */

/**
 * Normalizes the application URL.
 * 1. Trims whitespace (prevents "https://app.com /api" errors)
 * 2. Removes trailing slashes (prevents "https://app.com//api" errors)
 * 3. Falls back to window.location.origin in client-side if env is missing
 */
export const getAppUrl = (): string => {
    // Use env var first (works in server-side and client-side via Next.js baking)
    let appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    // Fallback to window.location.origin on client-side if env is empty
    if (!appUrl && typeof window !== 'undefined') {
        appUrl = window.location.origin;
    }

    // Fallback to localhost for dev sanity if both are missing
    if (!appUrl) {
        appUrl = 'http://localhost:3000';
    }

    // CLEANUP: 
    // 1. Trim all spaces (fixes the "https://app.maiovo.com " production issue)
    // 2. Clear any invisible characters (carriage returns, etc)
    // 3. Remove all trailing slashes to ensure standardized concatenation
    return appUrl.trim().replace(/[\r\n]/g, '').replace(/\/+$/, '');
};
