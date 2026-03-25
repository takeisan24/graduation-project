import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

if (typeof window !== 'undefined' && supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn("Missing NEXT_PUBLIC_SUPABASE env vars. Authentication will not work.");
}

/**
 * Supabase Client Configuration
 * 
 * Features:
 * - persistSession: true - Save session to localStorage
 * - storage: window.localStorage - Use localStorage for session storage
 * - autoRefreshToken: true - Auto refresh token when expiring
 * - detectSessionInUrl: true - Auto detect session from URL (for OAuth flow)
 * - flowType: 'pkce' - Use PKCE flow for OAuth
 *
 * Storage key: sb-{projectRef}-auth-token
 * 
 * IMPORTANT: OAuth Redirect URLs Configuration
 * 
 * If you get error 556 when signing in with OAuth (Google/Facebook):
 * 1. Go to Supabase Dashboard > Authentication > URL Configuration
 * 2. Add these Redirect URLs:
 *    - http://localhost:3000/vi/auth/success
 *    - http://localhost:3000/en/auth/success
 *    - http://localhost:3000/[locale]/auth/success (for all locales)
 *    - Or use wildcard pattern to allow all paths
 * 3. Set Site URL to: http://localhost:3000
 * 
 * CORS Configuration (if you get "CORS Missing Allow Origin"):
 * 1. Go to Supabase Dashboard > Settings > API
 * 2. Add to "Allowed Origins": http://localhost:3000
 */

const projectRef: string = (() => {
  try {
    const u = new URL(supabaseUrl)
    const sub = u.hostname.split(".")[0]
    return sub || "project"
  } catch {
    return "project"
  }
})()

/**
 * Generate a unique storage key per domain/browser
 * This ensures each domain (localhost, production, etc.) has its own session storage
 * Format: sb-{projectRef}-{domainHash}-auth-token
 * 
 * Why: Even though localStorage is already isolated per domain, using a domain-specific
 * storage key makes it explicit and easier to debug. It also prevents any potential
 * conflicts if the same user logs in on different domains (e.g., localhost:3000 vs production).
 */
const getStorageKey = (): string => {
  if (typeof window === 'undefined') {
    return `sb-${projectRef}-auth-token`; // Server-side fallback
  }

  try {
    // Get current domain (e.g., "localhost:3000" or "content-schedule-ai-demo.vercel.app")
    const hostname = window.location.hostname;
    const port = window.location.port;
    const domain = port ? `${hostname}:${port}` : hostname;

    // Create a simple hash of the domain for the storage key
    // This ensures uniqueness per domain while keeping the key readable
    const domainHash = domain
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .substring(0, 32); // Limit length

    const storageKey = `sb-${projectRef}-${domainHash}-auth-token`;

    return storageKey;
  } catch {
    return `sb-${projectRef}-auth-token`; // Fallback to default
  }
};

const storageKey = getStorageKey();

/**
 * Supabase Client Configuration
 * 
 * IMPORTANT: Multiple Sessions Support
 * 
 * Supabase natively supports multiple sessions for the same user across different browsers/devices.
 * Each browser/device will have its own independent session stored in localStorage.
 * 
 * - Each domain (localhost:3000, production, etc.) has its own localStorage
 * - Each browser (Chrome, Firefox, etc.) has its own localStorage
 * - Each session is independent and won't interfere with others
 * 
 * The storageKey is made domain-specific to ensure explicit isolation and easier debugging.
 */
export const supabaseClient = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Use domain-specific storage key to ensure explicit isolation per domain
    // This makes it easier to debug and prevents any potential conflicts
    storageKey: typeof window !== 'undefined' ? storageKey : undefined,
  },
});