
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Simple plan config for storage limits (in GB) */
const PLAN_STORAGE_CONFIG: Record<string, number> = {
  free: 1,
  starter: 5,
  pro: 20,
  business: 100,
};

export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth(req);
        if (!user) return fail("Unauthorized", 401);

        const { data: files, error: filesError } = await supabaseAdmin
            .from('files')
            .select('size')
            .eq('user_id', user.id);

        if (filesError) {
            console.error("Error fetching files:", filesError);
            return fail("Failed to fetch storage usage", 500);
        }

        const totalBytes = files?.reduce((acc, file) => acc + (file.size || 0), 0) || 0;

        // Get plan from users table
        const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('plan')
            .eq('id', user.id)
            .single();

        let plan = dbUser?.plan || 'free';

        // If plan not in config, fallback to free
        if (!PLAN_STORAGE_CONFIG[plan]) {
            plan = 'free';
        }
        const limitGB = PLAN_STORAGE_CONFIG[plan] || 1;
        const limitBytes = limitGB * 1024 * 1024 * 1024;

        return success({
            usedBytes: totalBytes,
            limitBytes: limitBytes,
            limitGB: limitGB,
            usagePercent: limitBytes > 0 ? (totalBytes / limitBytes) * 100 : 0
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Server error";
        console.error("GET /api/usage/storage error:", message);
        return fail(message, 500);
    }
}
