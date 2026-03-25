import { NextRequest } from 'next/server';
import { withAuthOnly } from '@/lib/middleware/api-protected';
import { success, fail } from '@/lib/response';
import { getFrameworks } from '@/lib/services/source/frameworkService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const auth = await withAuthOnly(req);
        if ("error" in auth) return auth.error;

        const { searchParams } = new URL(req.url);
        const nicheId = searchParams.get('niche_id');
        const goalId = searchParams.get('goal_id');

        const data = await getFrameworks(nicheId, goalId);
        return success(data);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Server error";
        console.error("[API/v1/frameworks] Error:", message);
        return fail(message, 500);
    }
}
