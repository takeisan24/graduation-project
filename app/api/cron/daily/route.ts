import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { onePayService } from '@/lib/onepay';
import { orderFulfillmentService } from '@/lib/services/billing/orderFulfillmentService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Security Check
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";

    // Allow if specific secret matches OR if it's a verified Vercel Cron
    if (process.env.CRON_SECRET &&
        authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
        !isVercelCron) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const report = {
        reconcile: {} as any,
        cleanup: {} as any,
        subscriptions: {} as any,
        errors: [] as string[]
    };

    const now = new Date();
    // Look back 25 hours to prevent infinite retry loop
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);

    // --- STEP 1: RECONCILE (Active Recovery) ---
    try {
        // Wait 5 mins before scanning to avoid race conditions with webhook
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // Fetch pending OR failed orders where we don't know the exact failure yet
        const { data: pendingOrders, error: pendingError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .or('status.eq.pending,and(status.eq.failed,onepay_response_code.is.null)')
            .lt('created_at', fiveMinutesAgo.toISOString())
            .gt('created_at', twentyFiveHoursAgo.toISOString())
            .limit(50);

        if (pendingError) throw pendingError;

        const reconciledResults = [];
        if (pendingOrders && pendingOrders.length > 0) {
            for (const order of pendingOrders) {
                try {
                    if (!order.onepay_txn_ref) {
                        // Skip if never initiated payment
                        continue;
                    }
                    const queryResult = await onePayService.queryTransaction(order.onepay_txn_ref);
                    if (queryResult['vpc_TxnResponseCode'] === '0') {
                        await orderFulfillmentService.fulfillOrder(order.id, queryResult);
                        reconciledResults.push({ id: order.id, status: 'fulfilled' });
                    } else if (queryResult['vpc_TxnResponseCode']) {
                        // Definitively failed on OnePay
                        const responseCode = queryResult['vpc_TxnResponseCode'];
                        const message = queryResult['vpc_Message'] || 'Unknown Error';
                        // Update if still pending or unset code
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
                } catch (rErr: any) {
                    reconciledResults.push({ id: order.id, error: rErr.message });
                }
            }
        }
        report.reconcile = { scanned: pendingOrders?.length || 0, fixed: reconciledResults };
    } catch (err: any) {
        console.error("Reconcile Step Failed:", err);
        report.errors.push(`Reconcile: ${err.message}`);
    }

    // --- STEP 1.5: RECOVER ZOMBIE ORDERS (Paid but Unfulfilled) ---
    try {
        const { data: zombieOrders, error: zombieError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('status', 'paid')
            .is('credits_added', false)
            .gt('created_at', twentyFiveHoursAgo.toISOString()) // Filter zombies by 25h window too
            .limit(20);

        if (zombieError) throw zombieError;

        const recoveredResults = [];
        if (zombieOrders && zombieOrders.length > 0) {
            for (const order of zombieOrders) {
                try {
                    // We assume it's paid, so we just retry fulfillment
                    // For safety, we can query OnePay again, but if DB says 'paid' trust it?
                    // Safer to re-query to get the latest 'onepay_raw_response' if missing.
                    // But if we have response code, we can just proceed.

                    // Let's just call fulfillOrder. It will re-read the order.
                    // We need 'paymentData' for fulfillOrder, but strictly it only uses it for logging.
                    // We can pass empty object or the saved raw response.
                    const paymentData = order.onepay_raw_response || {};

                    await orderFulfillmentService.fulfillOrder(order.id, paymentData);
                    recoveredResults.push({ id: order.id, status: 'recovered' });

                } catch (zErr: any) {
                    recoveredResults.push({ id: order.id, error: zErr.message });
                }
            }
        }
        report.reconcile = { ...report.reconcile, zombieFixed: recoveredResults };
    } catch (err: any) {
        console.error("Zombie Recovery Failed:", err);
        report.errors.push(`ZombieRecovery: ${err.message}`);
    }

    // --- STEP 2: CLEANUP (Stale Orders) ---
    try {
        const now = new Date();
        // User requested 30 minutes expiration for pending orders
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

        const { data: expiredData, error: cleanupError } = await supabaseAdmin
            .from('orders')
            .update({ status: 'expired' })
            .eq('status', 'pending')
            .lt('created_at', thirtyMinutesAgo.toISOString())
            .select('id');

        if (cleanupError) throw cleanupError;
        report.cleanup = { expiredCount: expiredData?.length || 0 };
    } catch (err: any) {
        console.error("Cleanup Step Failed:", err);
        report.errors.push(`Cleanup: ${err.message}`);
    }

    // --- STEP 3: SUBSCRIPTIONS (Expiry & Helper) ---
    try {
        const now = new Date();

        // A. Downgrade Expired
        const { data: expiredUsers, error: subError } = await supabaseAdmin
            .from('users')
            .select('id')
            .neq('plan', 'free')
            .lt('subscription_ends_at', now.toISOString());

        if (subError) throw subError;

        const downgrades = [];
        if (expiredUsers && expiredUsers.length > 0) {
            for (const user of expiredUsers) {
                const nextGrant = new Date();
                nextGrant.setMonth(nextGrant.getMonth() + 1);
                await supabaseAdmin.from('users').update({
                    plan: 'free',
                    current_plan_slug: 'free',
                    subscription_status: 'active',
                    subscription_ends_at: null,
                    next_credit_grant_at: nextGrant.toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', user.id);
                downgrades.push(user.id);
            }
        }

        // B. Refill Free Plans (Simple Check)
        const { data: refillUsers, error: refillError } = await supabaseAdmin
            .from('users')
            .select('id, credits_balance, next_credit_grant_at')
            .eq('plan', 'free')
            .lt('next_credit_grant_at', now.toISOString());

        if (refillError) throw refillError;

        const refills = [];
        if (refillUsers && refillUsers.length > 0) {
            for (const user of refillUsers) {
                const current = user.credits_balance || 0;
                if (current < 10) {
                    const nextGrant = new Date();
                    nextGrant.setMonth(nextGrant.getMonth() + 1);
                    await supabaseAdmin.from('users').update({
                        credits_balance: 10,
                        next_credit_grant_at: nextGrant.toISOString(),
                        updated_at: new Date().toISOString()
                    }).eq('id', user.id);
                    refills.push(user.id);
                }
            }
        }

        report.subscriptions = { downgraded: downgrades.length, refilled: refills.length };
    } catch (err: any) {
        console.error("Subscription Step Failed:", err);
        report.errors.push(`Subscription: ${err.message}`);
    }

    return NextResponse.json({ message: "Daily Job Complete", report });
}
