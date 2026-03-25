import { NextRequest } from 'next/server';
import { withAuthOnly } from '@/lib/middleware/api-protected';
import { success, fail } from '@/lib/response';
import { getAllContentGoal } from '@/lib/services/source/contentGoalsService';
import { getAllNiches } from '@/lib/services/source/nicheService';
import { getFrameworks } from '@/lib/services/source/frameworkService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const auth = await withAuthOnly(req);
        if ("error" in auth) return auth.error;

        const [goals, niches, frameworks] = await Promise.all([
            getAllContentGoal(),
            getAllNiches(),
            getFrameworks()
        ]);

        return success({ goals, niches, frameworks });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Server error";
        console.error("[API/v1/strategy-config] Error:", message);
        return fail(message, 500);
    }
}
