import { NextResponse } from 'next/server';
import { getAllContentGoal } from '@/lib/services/source/contentGoalsService';
import { getAllNiches } from '@/lib/services/source/nicheService';
import { getFrameworks } from '@/lib/services/source/frameworkService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        console.log("[API Strategy-Config] Fetching all strategy data...");
        
        // Gọi song song 3 service để tiết kiệm thời gian
        const [goals, niches, frameworks] = await Promise.all([
            getAllContentGoal(),
            getAllNiches(),
            getFrameworks() // Lấy tất cả frameworks (không filter niche/goal ở server nữa, để client filter)
        ]);

        return NextResponse.json({
            success: true,
            data: {
                goals,
                niches,
                frameworks
            }
        });
    } catch (error: any) {
        console.error("[API Strategy-Config] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}