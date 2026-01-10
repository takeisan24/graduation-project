import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Security Check
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 1. Calculate Cleanup Date (Today - 7 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 2. Update Old Pending Orders to 'expired'
        const { data, error, count } = await supabaseAdmin
            .from('orders')
            .update({ status: 'expired' })
            .eq('status', 'pending')
            .lt('created_at', sevenDaysAgo.toISOString())
            .select('id');

        if (error) throw error;

        console.log(`Cleanup: Expired ${data.length} stale orders created before ${sevenDaysAgo.toISOString()}`);


        return NextResponse.json({
            message: 'Cleanup successful',
            expiredCount: data.length,
            expiredOrderIds: data.map(o => o.id)
        });

    } catch (error: any) {
        console.error("Cleanup Job Failed:", error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}
