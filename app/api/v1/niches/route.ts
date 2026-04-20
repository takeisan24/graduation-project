import { NextRequest } from 'next/server';
import { withAuthOnly } from '@/lib/middleware/api-protected';
import { success, fail } from '@/lib/response';
import { getAllNiches } from '@/lib/services/source/nicheService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const auth = await withAuthOnly(req);
        if ("error" in auth) return auth.error;

        const data = await getAllNiches();
        return success(data);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Server error";
        console.error("[API/v1/niches] Error:", message);
        return fail(message, 500);
    }
}
