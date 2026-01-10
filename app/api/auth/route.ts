import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { success, fail } from "@/lib/response";
import { ensureUserProfile } from "@/lib/services/db/users";

/**
 * POST /api/auth
 * Body JSON:
 *  - mode: "signup" | "login"
 *  - email, password
 *
 * Response:
 *  - success: { user?, session? } on login
 *  - For signup, Supabase will send confirmation email depending on settings.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body.mode;
    const email = body.email;
    const password = body.password;

    if (!mode || !email || !password) return fail("mode, email, password required", 400);

    if (mode === "signup") {
      // Use Supabase Auth signUp
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return fail(error.message, 400);
      // Ensure user profile exists via service layer (auth trigger also inserts; avoid unique violations)
      try {
        if (data.user?.id) {
          await ensureUserProfile(data.user.id, email, body.name, undefined);
        }
      } catch (e) {
        // non-fatal: don't fail signup if profile upsert errors
        console.warn("profile upsert warning", e);
      }
      return success({ user: data.user, message: "Signup OK. Confirm email if required." }, 201);
    } else if (mode === "login") {
      // signInWithPassword to obtain session
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return fail(error.message, 400);
      
      // Ensure user profile exists and get credits_balance via service layer
      // Note: Supabase Auth user object doesn't have credits_balance (it's in public.users table)
      // ensureUserProfile RPC now returns credits_balance directly
      let creditsBalance = 0;
      if (data.user?.id) {
        try {
          // Call ensureUserProfile which returns credits_balance
          const creditsFromRPC = await ensureUserProfile(
            data.user.id,
            data.user.email,
            data.user.user_metadata?.full_name || data.user.user_metadata?.name,
            data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture
          );
          
          if (creditsFromRPC !== null && creditsFromRPC !== undefined) {
            creditsBalance = creditsFromRPC;
          }
        } catch (e) {
          console.warn("Failed to get credits_balance from RPC:", e);
        }
      }
      
      // data contains session, user, and credits
      return success({ 
        session: data.session, 
        user: data.user,
        creditsRemaining: creditsBalance
      }, 200);
    } else {
      return fail("mode must be 'signup' or 'login'", 400);
    }
  } catch (err: any) {
    console.error("auth route error", err);
    return fail(err.message || "Server error", 500);
  }
}
