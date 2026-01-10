
import { NextRequest, NextResponse } from 'next/server';
import { onePayService } from '@/lib/onepay';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { orderFulfillmentService } from '@/lib/services/billing/orderFulfillmentService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const query = Object.fromEntries(searchParams.entries());
        // console.log('OnePay IPN Params:', query);

        // --- ENHANCED LOGGING START ---
        // Try to verify signature immediately
        let isValid = false;
        try {
            isValid = onePayService.verifyReturnUrl(query);
        } catch (verErr) {
            console.error("OnePay verification error:", verErr);
        }

        if (!isValid) {
            console.error("Invalid Checksum for params:", query);
            await supabaseAdmin.from('payment_logs').insert({
                order_id: null,
                event_type: 'onepay_ipn_fail',
                payload: query,
                error_message: 'Invalid Checksum'
            });
            return new NextResponse('Invalid Checksum', { status: 400 });
        }
        // --- ENHANCED LOGGING END ---

        const transactionRef = query['vpc_MerchTxnRef'];
        const responseCode = query['vpc_TxnResponseCode'];
        const isSuccess = responseCode === '0';

        if (transactionRef) {
            const { data: order, error: orderErr } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('onepay_txn_ref', transactionRef)
                .single();

            if (orderErr || !order) {
                console.error("Order not found or error:", orderErr);
                await supabaseAdmin.from('payment_logs').insert({
                    order_id: null,
                    event_type: 'onepay_ipn_error',
                    payload: query,
                    error_message: `Order not found for ref: ${transactionRef}`
                });
                return new NextResponse('Order not found', { status: 200 });
            }

            const needsProcessing = order && (
                order.status === 'pending' ||
                order.status === 'expired' ||
                order.status === 'failed' || // Allow recovery if previously marked as failed but IPN says success
                (order.status === 'paid' && !order.credits_added)
            );

            if (needsProcessing) {
                // Update status
                const status = isSuccess ? 'paid' : 'failed';

                // Only update DB if status changed or we need to refresh data
                if (order.status !== status) {
                    await supabaseAdmin
                        .from('orders')
                        .update({
                            status: status,
                            onepay_response_code: responseCode,
                            onepay_transaction_status: isSuccess ? 'success' : 'failed',
                            onepay_transaction_no: query.vpc_TransactionNo as string,
                            onepay_raw_response: query,
                            paid_at: isSuccess ? new Date().toISOString() : null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', order.id);
                }

                // Log Payment Event only if it's new
                if (order.status === 'pending') {
                    await supabaseAdmin.from('payment_logs').insert({
                        order_id: order.id,
                        event_type: 'onepay_ipn',
                        payload: query,
                        error_message: isSuccess ? null : `Response Code: ${responseCode}`
                    });
                } else {
                    console.log(`IPN: Order ${order.id} already paid, regarding as retry/fulfillment check.`);
                }

                if (isSuccess) {
                    try {
                        await orderFulfillmentService.fulfillOrder(order.id, query);
                    } catch (err) {
                        console.error("Fulfillment failed in IPN:", err);
                    }
                }
            }
        }

        return new NextResponse('responsecode=1&desc=confirm-success', { status: 200 });

    } catch (e: any) {
        console.error('OnePay IPN Critical Error:', e);
        // Try to log to DB if possible
        try {
            await supabaseAdmin.from('payment_logs').insert({
                order_id: null, // Unknown
                event_type: 'onepay_ipn_critical_crash',
                payload: { error: e.toString(), stack: e.stack },
                error_message: 'Critical Crash in IPN'
            });
        } catch (logErr) {
            console.error("Failed to log critical error", logErr);
        }
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
