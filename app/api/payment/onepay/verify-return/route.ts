import { NextRequest, NextResponse } from 'next/server';
import { onePayService } from '@/lib/onepay';
import { supabaseClient } from '@/lib/supabaseClient';
import { orderFulfillmentService } from '@/lib/services/billing/orderFulfillmentService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    let orderDetailsForResponse: any = null;

    try {
        const body = await req.json();
        const query = body; // The body is the params object

        // 1. Validate Checksum
        const isValid = onePayService.verifyReturnUrl(query);
        if (!isValid) {
            return NextResponse.json({ success: false, message: 'Invalid Checksum. Data integrity check failed.' });
        }

        // 2. Check Response Code
        const transactionRef = query['vpc_MerchTxnRef'];
        const responseCode = query['vpc_TxnResponseCode'];
        const isSuccess = responseCode === '0' || responseCode === '00';

        // 3. Update Order Status
        if (transactionRef) {
            const { data: order } = await supabaseClient
                .from('orders')
                .select('*')
                .eq('onepay_txn_ref', transactionRef)
                .single();

            if (order) {
                // Determine if we need to process this order
                // Process if: 1. It's pending OR 2. It's Paid/Completed but credits check says NO (retry logic)
                const shouldProcess = order.status === 'pending' || (isSuccess && !order.credits_added);

                let finalCredits = order.credits_amount;

                // Delegate fulfillment to the shared service
                if (shouldProcess) {
                    try {
                        const result = await orderFulfillmentService.fulfillOrder(order.id, query);
                        if (result.creditsAdded) {
                            finalCredits = result.creditsAdded; // Update credits if calculated dynamically
                        }
                    } catch (err: any) {
                        console.error("Fulfillment failed in verify-return:", err);
                        // If fulfillment fails (e.g. user update error), we should probably fail the request specific to "success"
                        // But usually we might want to show success if payment succeeded?
                        // Actually, if fulfillment fails, credits aren't added. We should show error.
                        return NextResponse.json({ success: false, message: 'Fulfillment failed: ' + err.message });
                    }
                }

                // Prepare order details for UI
                // finalCredits is already calculated above

                orderDetailsForResponse = {
                    id: order.id,
                    order_number: order.order_number,
                    amount: order.total_amount,
                    plan_name: order.plan_name,
                    credits_amount: finalCredits,
                    billing_cycle: order.billing_cycle,
                    plan_slug: order.plan_slug
                };

                return NextResponse.json({
                    isValid: true,
                    success: isSuccess,
                    message: isSuccess ? 'Payment verified' : 'Payment failed',
                    order: orderDetailsForResponse
                });
            }
        }

        return NextResponse.json({ success: false, message: 'Transaction Ref not found' });

    } catch (error: any) {
        console.error("Verify API Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
