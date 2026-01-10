import { createVNPayClient } from '@/lib/payments/vnpay-client';
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

/**
 * VNPay Return URL Handler
 * This page is where users are redirected after payment
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const vnpParams: Record<string, string> = {};

        searchParams.forEach((value, key) => {
            vnpParams[key] = value;
        });

        // Parse VNPay response
        const vnpayClient = createVNPayClient();
        const parsedResponse = vnpayClient.parseReturnUrl(vnpParams as any);

        // Build return URL with payment status
        const returnParams = new URLSearchParams({
            orderId: parsedResponse.orderId,
            status: parsedResponse.isSuccess ? 'success' : 'failed',
            responseCode: parsedResponse.responseCode,
            amount: parsedResponse.amount.toString(),
            transactionNo: parsedResponse.transactionNo || '',
            isValidSignature: parsedResponse.isValidSignature.toString(),
        });

        // Redirect to frontend payment result page
        redirect(`/buy-plan/payment-return?${returnParams.toString()}`);
    } catch (error) {
        console.error('VNPay return URL error:', error);
        // Redirect to error page
        redirect('/buy-plan/payment-return?status=error');
    }
}
