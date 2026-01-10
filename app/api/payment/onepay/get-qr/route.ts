import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseClient } from '@/lib/supabaseClient';
import { getAppUrl } from '@/lib/utils/urlConfig';

export const dynamic = 'force-dynamic';

function sortObject(obj: any) {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    keys.forEach((key) => {
        sorted[key] = obj[key];
    });
    return sorted;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { orderId, locale } = body; // Removed amount

        const ONEPAY_MERCHANT = process.env.ONEPAY_MERCHANT_ID || '';
        const ONEPAY_ACCESS_CODE = process.env.ONEPAY_ACCESS_CODE || '';
        const ONEPAY_HASH_KEY = process.env.ONEPAY_HASH_KEY || '';

        // Note: The URL is different for the API call vs the redirect
        // PROMPT.md: https://mtf.onepay.vn/paygate/api/vpc/v1/merchants/TESTONEPAY/purchases/<vpc_MerchTxnRef>

        const currentLocale = locale || 'vi';
        const appUrl = getAppUrl();

        // Fetch Order from DB to get the correct amount
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const amount = order.total_amount;

        // Generate unique Transaction Reference
        const timestamp = Date.now();
        const shortId = orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
        const txnRef = `${shortId}_${timestamp}`;

        // IMPORTANT: Save this txnRef to the order in DB so IPN can identify it later
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update({ onepay_txn_ref: txnRef })
            .eq('id', orderId);

        if (updateError) {
            console.error('Failed to update txnRef for order:', updateError);
            // We might continue or fail? Ideally fail because payment tracking will break.
            // But for now let's just log it.
        }

        // Sanitize Iip
        let clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
        if (clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
        }
        // OnePay often dislikes IPv6 or weird formats, ensure simple IPv4 if local
        if (clientIp === '::1') clientIp = '127.0.0.1';

        const params: any = {
            vpc_Version: '2',
            vpc_Currency: 'VND',
            vpc_Command: 'pay',
            vpc_AccessCode: ONEPAY_ACCESS_CODE,
            vpc_Merchant: ONEPAY_MERCHANT,
            vpc_Locale: currentLocale === 'vi' ? 'vn' : 'en',
            vpc_CardList: 'VIETQR', // Required for QR
            vpc_ReturnURL: `${appUrl}/${currentLocale}/buy-plan/payment-return`,
            vpc_IpnURL: `${appUrl}/api/payment/onepay/ipn`,
            vpc_MerchTxnRef: txnRef,
            vpc_OrderInfo: `Order ${shortId}`, // Limit 34 chars. shortId is 8 chars.
            vpc_Amount: String(Math.floor(amount * 100)), // Amount * 100
            vpc_TicketNo: clientIp,
        };

        // Sort params for hashing
        const sortedParams = sortObject(params);

        // Create Sign Data
        // PROMPT.md says: "HashString include all parameters... sorted in alphabetical order"
        // Usually OnePay requires query string format key=value&key2=value2
        const signData = Object.keys(sortedParams)
            .map((key) => `${key}=${sortedParams[key]}`)
            .join('&');

        // Create Hash
        const hmac = crypto.createHmac('sha256', Buffer.from(ONEPAY_HASH_KEY, 'hex') as any);
        const secureHash = hmac.update(signData).digest('hex').toUpperCase();

        // Add hash to params
        params['vpc_SecureHash'] = secureHash;

        // Construct Query String for the API body (or URL params if GET, but prompt says POST)
        // Prompt says: Content-Type: application/x-www-form-urlencoded
        const formData = new URLSearchParams();
        Object.keys(params).forEach(key => {
            formData.append(key, params[key]);
        });

        const apiUrl = `https://onepay.vn/paygate/api/vpc/v1/merchants/${ONEPAY_MERCHANT}/purchases/${txnRef}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OnePay API Error:', response.status, errorText);
            throw new Error(`OnePay API failed: ${response.statusText}`);
        }

        // OnePay often returns query string formatted text, not JSON
        const responseText = await response.text();
        // console.log("OnePay Raw Response:", responseText); // Debugging - Uncomment if needed

        const match = responseText.match(/vpc_DataQr=([^&]+)/);
        let dataQr = match ? match[1] : null;

        // Look for vpc_DataQr
        if (dataQr) {
            // OnePay might send URL Encoded string (%2B) OR raw string (+).
            // If it contains %, try decoding.
            if (dataQr.includes('%')) {
                dataQr = decodeURIComponent(dataQr);
            }

            // If after decoding (or if it was raw), it has spaces, those are likely supposed to be + in Base64
            // (Standard URL encoding uses + for space, but Base64 uses + as a character)
            // It's safer to assume a Base64 string for an image should NOT have spaces.
            if (dataQr.includes(' ')) {
                dataQr = dataQr.replace(/ /g, '+');
            }

            // console.log("Extracted QR Length:", dataQr.length);

            return NextResponse.json({
                qrData: dataQr,
                txnRef: txnRef
            });
            /* Original Debug Response:
            const debugData = { raw: responseText };
            console.error('OnePay API Response missing QR:', debugData);
            return NextResponse.json({ error: 'No QR code received from OnePay', debug: debugData }, { status: 500 });
            */
        } else {
            console.error('OnePay API Response missing QR.');
            return NextResponse.json({ error: 'No QR code received from OnePay' }, { status: 500 });
        }

    } catch (error: any) {
        console.error('OnePay QR create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
