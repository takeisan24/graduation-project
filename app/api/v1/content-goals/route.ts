import { NextResponse } from 'next/server';
import { getAllContentGoal } from '@/lib/services/source/contentGoalsService';

// --- Force No cache ---
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
// --------------------

export async function GET() {
    try {
        const data = await getAllContentGoal();
        // Thêm log để debug xem server thực sự lấy được gì
        console.log(`[API Content-Goals] Real-time fetched: ${data.length} items`); 
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}