
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PLAN_CONFIG } from "@/lib/payments/lemonsqueezy";

// Helper to get formatted size (though frontend can do this, backend logic is safer info)
// But here we return bytes and limit in GB

export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth(req);
        if (!user) return fail("Unauthorized", 401);

        // 1. Get total size from 'files' table
        // Note: We need to use supabaseClient with service role or ensuring RLS allows reading 'files' for own user
        // Since requireAuth returns user info, we can query directly if RLS is set up, 
        // but usually backend queries use admin client for aggregates to be faster/safer or just standard client with user context.

        // Note: Using supabaseAdmin to calculate size from 'files' table directly.
        // In production with millions of files, this should be an RPC or a cached value in 'users' table.
        // For now, calculating on fly is acceptable for MVP.

        // Since we didn't create the RPC yet, let's fallback to direct query if RPC doesn't exist.
        // Actually, let's just do a direct query on 'files' table.

        // "sum" is an aggregate, Supabase js lib supports .select('size.sum()') ? No, syntax is different.
        // .select('size', { count: 'exact' }) gets all rows. 
        // Better to write a raw query or simple loop if small.
        // Or, we can use a simple SQL function? 
        // For now, let's try direct select. If many files, this is slow. 

        // Let's create an RPC or use a direct query if possible.
        // Alternative: fetch all file sizes

        const { data: files, error: filesError } = await supabaseAdmin
            .from('files')
            .select('size')
            .eq('user_id', user.id);

        if (filesError) {
            console.error("Error fetching files:", filesError);
            return fail("Failed to fetch storage usage", 500);
        }

        const totalBytes = files?.reduce((acc, file) => acc + (file.size || 0), 0) || 0;

        // 2. Get Plan Limit
        // Fetch plan from 'users' table because auth user object handles plan via metadata which might be stale or missing in type
        const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('plan')
            .eq('id', user.id)
            .single();

        let plan = dbUser?.plan || 'free';

        // If plan not in config, fallback to free
        if (!PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]) {
            plan = 'free';
        }
        const config = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
        const limitGB = config.storage || 1;
        const limitBytes = limitGB * 1024 * 1024 * 1024;

        return success({
            usedBytes: totalBytes,
            limitBytes: limitBytes,
            limitGB: limitGB,
            usagePercent: limitBytes > 0 ? (totalBytes / limitBytes) * 100 : 0
        });

    } catch (error: any) {
        console.error("GET /api/usage/storage error:", error);
        return fail("Server error", 500);
    }
}
