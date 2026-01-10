import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { onePayService } from '@/lib/onepay';
import { orderFulfillmentService } from '@/lib/services/billing/orderFulfillmentService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Security Check: Verify CRON_SECRET if needed
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 1. Calculate Time Windows
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        // Changed to 30 days to handle backlog
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // 2. Fetch Pending Orders (Created 30 days ago <-> 5m ago)
        // We limit to 50 to avoid timeouts
        const { data: pendingOrders, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('status', 'pending')
            .lt('created_at', fiveMinutesAgo.toISOString())
            .gt('created_at', thirtyDaysAgo.toISOString())
            .limit(50);

        if (error) throw error;
        if (!pendingOrders || pendingOrders.length === 0) {
            return NextResponse.json({ message: 'No pending orders to reconcile.' });
        }

        const results = [];

        // 3. Process Each Order
        for (const order of pendingOrders) {
            try {
                if (!order.onepay_txn_ref) {
                    continue;
                }

                // Call OnePay QueryDR using the correct transaction reference
                const queryResult = await onePayService.queryTransaction(order.onepay_txn_ref);

                // vpc_TxnResponseCode = '0' means Success
                if (queryResult['vpc_TxnResponseCode'] === '0') {
                    console.log(`Reconcile: Order ${order.id} found successful on OnePay. Fulfilling...`);

                    // Fulfill Order
                    await orderFulfillmentService.fulfillOrder(order.id, queryResult);
                    results.push({ orderId: order.id, status: 'fulfilled', onepayCode: '0' });
                } else {
                    // Transaction failed or not found or pending at OnePay side
                    // We just log it, but don't change status to failed yet (let user retry or wait for cleanup)
                    // Or we could update onepay_response_code if we had that column
                    results.push({ orderId: order.id, status: 'still_pending_or_failed', onepayCode: queryResult['vpc_TxnResponseCode'] });
                }
            } catch (err: any) {
                console.error(`Reconcile: Error processing order ${order.id}`, err);
                results.push({ orderId: order.id, error: err.message });
            }
        }

        return NextResponse.json({
            processed: pendingOrders.length,
            results
        });

    } catch (error: any) {
        console.error("Reconciliation Job Failed:", error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}
