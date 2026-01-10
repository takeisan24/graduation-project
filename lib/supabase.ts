import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy initialization of Supabase client
 * This prevents the error from being thrown during module evaluation on client-side
 * The client is only created when actually accessed (server-side)
 */
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  // If already initialized, return cached instance
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Only check environment variables when actually used (server-side)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceRoleKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    
    throw new Error(
      `Missing SUPABASE environment variables: ${missingVars.join(', ')}. ` +
      `Please add them to your .env.local file. ` +
      `Get these values from Supabase Dashboard > Settings > API. ` +
      `After adding, restart your Next.js dev server.`
    );
  }

  // Create and cache the client
  // Note: Supabase client doesn't support custom timeout directly
  // We handle retries and timeouts in requireAuth() function instead
  supabaseInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false, // We handle token refresh manually
    },
  });

  return supabaseInstance;
}

/**
 * Server-side Supabase client (service_role key)
 * 
 * This is a Proxy that lazily initializes the client only when accessed.
 * This prevents the error from being thrown during module evaluation on client-side.
 * 
 * Usage:
 * ```typescript
 * import { supabase } from '@/lib/supabase';
 * const { data } = await supabase.from('users').select('*');
 * ```
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});
