import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { onePayService } from '@/lib/onepay';
import { orderFulfillmentService } from '@/lib/services/billing/orderFulfillmentService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Security Check
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";

    if (process.env.CRON_SECRET &&
        authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
        !isVercelCron) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const report = {
        scanned: 0,
        recovered: [] as any[],
        zombiesRecovered: [] as any[],
        errors: [] as string[]
    };

    try {
        const now = new Date();
        // Look back 20 minutes
        const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

        // Fetch orders from the last 20 mins that have a OnePay reference
        // Scan: 'pending' OR ('failed' but we don't know why yet - i.e. onepay_response_code is null)
        const { data: ordersToScan, error: scanError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .or('status.eq.pending,and(status.eq.failed,onepay_response_code.is.null)')
            .gt('created_at', twentyMinutesAgo.toISOString())
            .not('onepay_txn_ref', 'is', null) // Must have a OnePay ref to query
            .limit(100);

        if (scanError) throw scanError;

        if (ordersToScan && ordersToScan.length > 0) {
            report.scanned = ordersToScan.length;

            for (const order of ordersToScan) {
                try {
                    const queryResult = await onePayService.queryTransaction(order.onepay_txn_ref);

                    if (queryResult['vpc_TxnResponseCode'] === '0') {
                        // First update status to paid to avoid race conditions
                        if (order.status !== 'paid') {
                            await supabaseAdmin
                                .from('orders')
                                .update({
                                    status: 'paid',
                                    onepay_response_code: '0',
                                    onepay_transaction_status: 'success',
                                    onepay_raw_response: queryResult,
                                    paid_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', order.id);
                        }

                        // Then fulfill
                        await orderFulfillmentService.fulfillOrder(order.id, queryResult);
                        report.recovered.push({ id: order.id, onepayRef: order.onepay_txn_ref });
                    } else if (queryResult['vpc_TxnResponseCode']) {
                        // It's a definitive failure from OnePay (not 0)
                        const responseCode = queryResult['vpc_TxnResponseCode'];

                        // If it's still pending or missing the code, update it so we don't query it again
                        if (order.status === 'pending' || !order.onepay_response_code) {
                            await supabaseAdmin
                                .from('orders')
                                .update({
                                    status: 'failed',
                                    onepay_response_code: responseCode,
                                    onepay_transaction_status: 'failed',
                                    onepay_raw_response: queryResult,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', order.id);
                        }
                    }

                    // Delay to prevent Rate-Limiting by OnePay (300ms)
                    await new Promise(resolve => setTimeout(resolve, 300));

                } catch (rErr: any) {
                    console.error(`[15-Min Cron] Error verifying order ${order.id}:`, rErr.message);
                    report.errors.push(`Order ${order.id}: ${rErr.message}`);
                }
            }
        }

        // --- NEW LOGIC: RECOVER ZOMBIE ORDERS (Paid but Unfulfilled) ---
        try {
            const { data: zombieOrders, error: zombieError } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('status', 'paid')
                .is('credits_added', false)
                .gt('created_at', twentyMinutesAgo.toISOString()) // Filter zombies by 20m window too
                .limit(20);

            if (zombieError) throw zombieError;

            if (zombieOrders && zombieOrders.length > 0) {
                for (const order of zombieOrders) {
                    try {
                        const paymentData = order.onepay_raw_response || {};
                        await orderFulfillmentService.fulfillOrder(order.id, paymentData);
                        report.zombiesRecovered.push({ id: order.id, status: 'recovered' });
                    } catch (zErr: any) {
                        console.error(`[15-Min Cron] Error recovering zombie order ${order.id}:`, zErr.message);
                        report.errors.push(`ZombieOrder ${order.id}: ${zErr.message}`);
                    }
                }
            }
        } catch (err: any) {
            console.error("[15-Min Cron] Zombie Recovery Failed:", err);
            report.errors.push(`ZombieRecovery: ${err.message}`);
        }

    } catch (err: any) {
        console.error("[15-Min Cron] Critical Error:", err);
        report.errors.push(`Critical: ${err.message}`);
    }

    return NextResponse.json({ message: "15-Minutes Job Complete", report });
}
