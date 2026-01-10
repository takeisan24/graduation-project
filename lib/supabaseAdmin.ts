
import { createClient } from "@supabase/supabase-js";

// Check for required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
}

if (!serviceRoleKey) {
    // Warn instead of throw in case it's built in client-side context inadvertently,
    // though this file should only be used server-side.
    console.warn("Missing SUPABASE_SERVICE_ROLE_KEY, admin client will not have admin privileges.");
}

/**
 * Supabase Admin Client
 * 
 * Uses the Service Role Key to bypass Row Level Security (RLS).
 * Use only in server-side API routes. NEVER expose this to the client.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
