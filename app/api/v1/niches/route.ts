import { NextResponse } from 'next/server';
import { getAllNiches } from '@/lib/services/source/nicheService';

// --- Force No cache ---
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// --------------------

export async function GET() {
    try {
        const data = await getAllNiches();
        console.log(`[API Niches] Real-time fetched: ${data.length} items`);
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}