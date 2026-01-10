
import { NextRequest, NextResponse } from 'next/server';
import { onePayService } from '@/lib/onepay';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { orderFulfillmentService } from '@/lib/services/billing/orderFulfillmentService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orderId, txnRef } = body;

        let transactionRef = txnRef;
        let debugInfo: any = {};

        // If no txnRef provided, find it from orderId
        if (!transactionRef && orderId) {
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('onepay_txn_ref')
                .eq('id', orderId)
                .single();

            if (order) {
                transactionRef = order.onepay_txn_ref;
            }
        }

        if (!transactionRef) {
            return NextResponse.json({ success: false, message: 'Transaction Reference not found.' }, { status: 404 });
        }

        // Call OnePay QueryDR
        const result = await onePayService.queryTransaction(transactionRef);

        const drExists = result['vpc_DRExists'];
        const responseCode = result['vpc_TxnResponseCode'];
        const isSuccess = responseCode === '0' || responseCode === '00';

        let updated = false;

        if (drExists === 'Y' || drExists === 'y') {
            // Found transaction on OnePay

            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('onepay_txn_ref', transactionRef)
                .single();

            if (!order) {
                console.error(`CRITICAL: Transaction ${transactionRef} exists on OnePay but Order not found in DB.`);
                debugInfo.reason = 'order_not_found_in_db';
                // Potentially log to separate alerts table
            } else {
                debugInfo.orderId = order.id;
                debugInfo.currentStatus = order.status;
                debugInfo.creditsAdded = order.credits_added;

                if (isSuccess) {
                    // OnePay says SUCCESS

                    // Allow retry if status is pending OR (status is paid/completed but credits_added is FALSE)
                    const needsFulfillment = order.status !== 'completed' || !order.credits_added;
                    debugInfo.needsFulfillment = needsFulfillment;

                    if (needsFulfillment) {
                        updated = true;
                        debugInfo.action = 'fulfilling_order';

                        // 1. Update Order
                        await supabaseAdmin
                            .from('orders')
                            .update({
                                status: 'paid',
                                onepay_response_code: responseCode,
                                onepay_transaction_status: 'success',
                                onepay_transaction_no: result.vpc_TransactionNo as string,
                                onepay_raw_response: result,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', order.id);

                        // Log Payment Event ONLY if it wasn't paid before
                        if (order.status !== 'paid') {
                            await supabaseAdmin.from('payment_logs').insert({
                                order_id: order.id,
                                event_type: 'onepay_query_dr',
                                payload: result,
                                error_message: null
                            });
                        } else {
                            console.log(`Order ${order.id} is already paid, retrying fulfillment via QueryDR...`);
                        }

                        // 2. Fulfill
                        try {
                            const fulfillmentResult = await orderFulfillmentService.fulfillOrder(order.id, result);
                            if (fulfillmentResult.success) {
                                console.log(`Order ${order.id} fulfilled via QueryDR`);
                            }
                        } catch (err: any) {
                            console.error("Fulfillment failed in QueryDR:", err);
                            debugInfo.fulfillmentError = err.message;
                        }
                    } else {
                        debugInfo.action = 'skipped_already_completed';
                    }
                } else {
                    // OnePay says FAILED
                    debugInfo.onepayStatus = 'failed';
                    debugInfo.responseCode = responseCode;

                    if (order.status === 'pending') {
                        updated = true;
                        debugInfo.action = 'marking_failed';

                        await supabaseAdmin
                            .from('orders')
                            .update({
                                status: 'failed',
                                onepay_response_code: responseCode,
                                onepay_transaction_status: 'failed',
                                onepay_transaction_no: result.vpc_TransactionNo as string,
                                onepay_raw_response: result,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', order.id);

                        await supabaseAdmin.from('payment_logs').insert({
                            order_id: order.id,
                            event_type: 'onepay_query_dr_fail',
                            payload: result,
                            error_message: `OnePay Failed: ${responseCode}`
                        });
                    } else {
                        debugInfo.action = 'skipped_failure_already_handled';
                    }
                }
            }
        } else {
            debugInfo.reason = 'transaction_not_found_on_onepay';
            // Transaction NOT found on OnePay
            return NextResponse.json({ success: false, message: 'Transaction not found on OnePay system.', data: result, debug: debugInfo });
        }

        return NextResponse.json({
            success: true,
            data: result,
            updated: updated,
            message: updated ? 'Order status updated via QueryDR' : 'Order status unchanged'
        });

    } catch (error: any) {
        console.error("QueryDR API Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
