import { NextRequest } from "next/server";
import { supabase } from "./supabase";
import { createClient } from "@supabase/supabase-js";

/**
 * Helper function to get Supabase session from query param or cookies
 * Used when Authorization header is not available (e.g., browser image/video tags)
 * 
 * Note: Supabase client-side stores session in localStorage, not cookies.
 * For browser image/video tags, we use query param as workaround.
 */
async function getSessionFromCookies(req: NextRequest): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !anonKey) {
      return null;
    }

    // Priority 1: Try to get token from query param (for browser image/video tags)
    // This is a workaround since browser doesn't send Authorization header
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get('token');
    if (tokenFromQuery) {
      return tokenFromQuery;
    }

    // Priority 2: Try to get from cookies (if using @supabase/ssr)
    // Note: Supabase client-side uses localStorage, so this won't work by default
    // But if using @supabase/ssr package, session might be in cookies
    const cookies = req.cookies;
    
    // Try common Supabase cookie patterns
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'project';
    const cookieNames = [
      `sb-${projectRef}-auth-token`,
      `sb-${projectRef}-auth-token.0`,
      `sb-${projectRef}-auth-token.1`,
      'sb-access-token',
      'sb-refresh-token',
    ];
    
    for (const cookieName of cookieNames) {
      const cookieValue = cookies.get(cookieName)?.value;
      if (cookieValue) {
        try {
          // Try to parse as JSON (session object)
          const sessionData = JSON.parse(cookieValue);
          if (sessionData?.access_token) {
            return sessionData.access_token;
          }
        } catch {
          // If not JSON, might be direct token
          if (cookieValue.length > 50) {
            return cookieValue;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[getSessionFromCookies] Error getting session from cookies:', error);
    return null;
  }
}

/**
 * requireAuth - validate Authorization: Bearer <access_token> or cookies
 * Returns user object from Supabase Auth or null.
 *
 * Note: This expects an access token (Supabase session.access_token) issued by Supabase Auth.
 * Supports both Authorization header (for API calls) and cookies (for browser image/video tags).
 * 
 * Includes retry logic with exponential backoff to handle connection timeouts.
 */
export async function requireAuth(req: NextRequest) {
  // Priority 1: Check Authorization header (for API calls)
  const authHeader = req.headers.get("authorization") || "";
  let token = authHeader.replace("Bearer ", "").trim();
  
  // Priority 2: If no Authorization header, try to get token from cookies (for browser tags)
  if (!token) {
    token = await getSessionFromCookies(req) || "";
  }
  
  if (!token) return null;

  // Retry logic with exponential backoff for connection timeouts
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // supabase.auth.getUser requires the token
      const res = await supabase.auth.getUser(token);
      
      if (res.error) {
        // If it's a connection timeout error, retry
        const isTimeoutError = res.error.message?.includes('timeout') || 
                               res.error.message?.includes('fetch failed') ||
                               res.error.message?.includes('UND_ERR_CONNECT_TIMEOUT');
        
        if (isTimeoutError && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
          console.warn(`[requireAuth] Connection timeout (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        }
        
        // Non-timeout error or last attempt - return null
        console.error(`[requireAuth] Auth error:`, res.error.message);
        return null;
      }
      
      // Success - return user
      if (res.data?.user) {
        return res.data.user;
      }
      
      // No user data
      return null;
    } catch (error: any) {
      // Catch network errors (timeout, connection refused, etc.)
      const isNetworkError = error?.message?.includes('fetch failed') ||
                            error?.message?.includes('timeout') ||
                            error?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                            error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
      
      if (isNetworkError && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[requireAuth] Network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Retry
      }
      
      // Non-network error or last attempt
      console.error(`[requireAuth] Unexpected error:`, error);
      return null;
    }
  }
  
  // All retries exhausted
  console.error(`[requireAuth] All retries exhausted, returning null`);
  return null;
}
