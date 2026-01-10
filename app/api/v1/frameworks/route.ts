import { NextResponse } from 'next/server';
import { getFrameworks } from '@/lib/services/source/frameworkService';

// --- Force No cache ---
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// --------------------

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const nicheId = searchParams.get('niche_id');
        const goalId = searchParams.get('goal_id');

        // Debug log để xem Frontend gửi gì lên
        console.log(`[API Frameworks] Filtering by Niche: ${nicheId}, Goal: ${goalId}`);

        const data = await getFrameworks(nicheId, goalId);

        return NextResponse.json(data);

    } catch (error: any) {
        console.error("[API Frameworks] Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}