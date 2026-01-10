import { NextResponse } from 'next/server';
import { onePayService } from '@/lib/onepay';
import { supabaseClient } from '@/lib/supabaseClient';
import { getAppUrl } from '@/lib/utils/urlConfig';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { orderId, locale } = body; // Removed amount from body

        const currentLocale = locale || 'vi';
        const appUrl = getAppUrl();

        // Get Client IP
        let clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
        if (clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
        }

        // Fetch Order from DB to get the correct amount
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const amount = order.total_amount; // Use server-side trusted amount

        // Generate unique Transaction Reference to allow retries
        // Format: ShortUUID_Timestamp (e.g. ab12cd34_1700000000)
        const timestamp = Date.now();
        const shortId = orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
        const txnRef = `${shortId}_${timestamp}`;

        // Save txnRef to the order so we can verify it later
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update({ onepay_txn_ref: txnRef })
            .eq('id', orderId);

        if (updateError) {
            console.error("Failed to save txnRef:", updateError);
        }

        const returnUrl = `${appUrl}/${currentLocale}/buy-plan/payment-return`;

        // Use OnePay Service to build URL
        const paymentUrl = onePayService.buildPaymentUrl({
            amount,
            orderId: txnRef, // Use txnRef as the Merchant Transaction Reference
            orderInfo: `Order ${order.order_number}`,
            returnUrl,
            ipAddr: clientIp,
            locale: currentLocale
        });

        return NextResponse.json({ url: paymentUrl });

    } catch (error: any) {
        console.error('OnePay URL create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
