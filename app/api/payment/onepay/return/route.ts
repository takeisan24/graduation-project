
import { NextRequest, NextResponse } from 'next/server';
import { onePayService } from '@/lib/onepay';
import { supabaseClient } from '@/lib/supabaseClient';
import { orderFulfillmentService } from '@/lib/services/billing/orderFulfillmentService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const query = Object.fromEntries(searchParams.entries());

    // 1. Verify Checksum
    const isValid = onePayService.verifyReturnUrl(query);

    // console.log('OnePay Return Params:', query);
    console.log('Checksum Valid:', isValid);

    const transactionRef = query['vpc_MerchTxnRef'];
    const responseCode = query['vpc_TxnResponseCode'];

    console.log('Response Code:', responseCode);

    if (!isValid) {
        console.error('Invalid Checksum for txn:', transactionRef);
        return NextResponse.redirect(new URL('/buy-plan?status=failed&reason=checksum', req.url));
    }

    const isSuccess = responseCode === '0';

    let order: any = null;

    // 2. Update DB (orders table)
    if (transactionRef) {
        const status = isSuccess ? 'paid' : 'failed'; // 'paid' matches schema CHECK constraint

        const { data: updatedOrder, error } = await supabaseClient
            .from('orders')
            .update({
                status: status,
                onepay_response_code: responseCode,
                onepay_transaction_status: isSuccess ? 'success' : 'failed', // Keep strict status in our specific col
                onepay_raw_response: query,
                paid_at: isSuccess ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq('onepay_txn_ref', transactionRef)
            .select()
            .single();

        order = updatedOrder;

        order = updatedOrder;

        if (isSuccess && order) {
            try {
                const fulfillmentResult = await orderFulfillmentService.fulfillOrder(order.id, query);
                if (fulfillmentResult.success) {
                    console.log(`Order ${order.id} fulfilled via Return URL`);
                    // Refresh order to get latest status if needed for UI, though redirect query params are set from 'order' var above
                    // Ideally we should refetch or update the local 'order' object status
                    order.status = 'completed';
                }
            } catch (err) {
                console.error("Fulfillment failed in Return URL:", err);
            }
        }
    }

    // 3. Redirect
    if (isSuccess) {
        const successUrl = new URL('/buy-plan?status=success', req.url);
        // Append details for the frontend to display
        if (order) {
            successUrl.searchParams.set('amount', order.total_amount?.toString() || '0');
            successUrl.searchParams.set('plan', order.plan_slug || 'creator'); // Use Slug for ID
            successUrl.searchParams.set('plan_name', order.plan_name || ''); // Separate Name for Display
            successUrl.searchParams.set('credits', order.credits_amount?.toString() || '0');
        }
        return NextResponse.redirect(successUrl);
    } else {
        return NextResponse.redirect(new URL('/buy-plan?status=failed', req.url));
    }
}
