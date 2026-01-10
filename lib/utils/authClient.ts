/**
 * Auth Client Utilities
 * 
 * Handles client-side reactions to authentication errors (401),
 * including forced logout, clearing all local state, and redirecting
 * the user back to the sign-in page.
 */

import { supabaseClient } from '@/lib/supabaseClient';
import { clearAllUserData } from './storeReset';

// Module-level flag to avoid running logout logic multiple times in parallel
let isHandlingUnauthorized = false;

/**
 * Force logout on client when a 401/Unauthorized is detected from BE.
 * 
 * - Signs out from Supabase (best-effort)
 * - Clears all Zustand stores + localStorage via clearAllUserData
 * - Redirects user to the localized sign-in page
 */
export async function handleUnauthorizedOnClient(source?: string) {
  if (typeof window === 'undefined') return;
  if (isHandlingUnauthorized) return;

  isHandlingUnauthorized = true;

  try {
    console.warn('[authClient] Unauthorized response detected. Forcing logout...', {
      source: source || 'unknown',
      location: window.location.href,
    });

    // Best-effort Supabase signOut (ignore AuthSessionMissing)
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
          const msg = String(error.message || error.name || '');
          if (!msg.toLowerCase().includes('auth session missing')) {
            console.warn('[authClient] Supabase signOut error during unauthorized handling:', error);
          }
        }
      }
    } catch (signOutErr: any) {
      const msg = String(signOutErr?.message || signOutErr?.name || '');
      if (!msg.toLowerCase().includes('auth session missing')) {
        console.warn('[authClient] Ignoring Supabase error during unauthorized handling:', signOutErr);
      }
    }

    // Clear all client-side user data (stores + localStorage + known intervals)
    try {
      await clearAllUserData();
    } catch (clearErr) {
      console.error('[authClient] Error while clearing user data after unauthorized:', clearErr);
    }

    // Determine localized sign-in URL
    let signinUrl = '/signin';
    try {
      const path = window.location.pathname || '';
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0 && (parts[0] === 'vi' || parts[0] === 'en')) {
        signinUrl = `/${parts[0]}/signin`;
      }
    } catch {
      // Fallback to default /signin
    }

    // Redirect user to sign-in page
    window.location.href = signinUrl;
  } finally {
    // Do not reset isHandlingUnauthorized here to avoid redirect loops;
    // if user is still on an unauthorized page, they should be redirected once.
  }
}


