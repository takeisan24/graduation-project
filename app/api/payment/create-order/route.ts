import { createClient } from '@supabase/supabase-js';
import { createVNPayClient } from '@/lib/payments/vnpay-client';
import { onePayService } from '@/lib/onepay';
import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/utils/urlConfig';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { planSlug, billingCycle, couponCode, customerInfo, userId, paymentMethod } = body;

        // Initialize Admin Client explicity for reliable database operations
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!serviceRoleKey) {
            console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Validation
        if (!planSlug || !billingCycle) {
            return NextResponse.json(
                { error: 'Missing required fields: planSlug, billingCycle' },
                { status: 400 }
            );
        }

        if (!['monthly', 'yearly'].includes(billingCycle)) {
            return NextResponse.json(
                { error: 'Invalid billing cycle' },
                { status: 400 }
            );
        }

        // Fetch plan (Admin Client)
        const { data: plan, error: planError } = await supabaseAdmin
            .from('plans')
            .select('*')
            .eq('slug', planSlug)
            .eq('is_active', true)
            .single();

        if (planError || !plan) {
            return NextResponse.json(
                { error: 'Plan not found or inactive' },
                { status: 404 }
            );
        }

        // Calculate pricing
        // Calculate pricing
        const isYearly = billingCycle === 'yearly';
        const basePriceUSD = isYearly ? plan.price_yearly : plan.price_monthly;
        const credits = isYearly ? plan.credits_yearly : plan.credits_monthly;

        if (basePriceUSD === undefined || basePriceUSD === null) {
            return NextResponse.json(
                { error: 'Invalid plan pricing' },
                { status: 400 }
            );
        }

        // Fetch Exchange Rate using live API with Fallback
        // Matching logic from app/api/exchange-rate/route.ts
        let exchangeRate = Number(process.env.FALLBACK_RATE) || 26275;
        try {
            // Cache for 24 hours (86400s) to match the exchange-rate API
            const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 86400 } });
            if (res.ok) {
                const data = await res.json();
                if (data.rates?.VND) {
                    exchangeRate = data.rates.VND;
                }
            }
        } catch (e) {
            console.error("Failed to fetch fresh exchange rate, using fallback:", exchangeRate);
        }

        // Always calculate in VND for VN Payment Gateways
        const basePrice = Math.round(Number(basePriceUSD) * exchangeRate);

        let subtotal = basePrice;
        let discountAmount = 0;
        let couponId = null;

        // Apply coupon if provided (Admin Client)
        if (couponCode) {
            const { data: coupon } = await supabaseAdmin
                .from('coupons')
                .select('*')
                .eq('code', couponCode.toUpperCase())
                .eq('is_active', true)
                .single();

            if (coupon) {
                // Validate coupon (basic check, full validation in coupon API)
                const now = new Date();
                const isValid =
                    now >= new Date(coupon.start_date) &&
                    now <= new Date(coupon.end_date) &&
                    (!coupon.usage_limit || coupon.usage_count < coupon.usage_limit);

                if (isValid) {
                    couponId = coupon.id;

                    // Calculate discount
                    if (coupon.discount_type === 'percentage') {
                        discountAmount = Math.round((subtotal * coupon.discount_value) / 100);
                        if (coupon.max_discount_amount) {
                            const maxDiscountVND = Math.round(coupon.max_discount_amount * exchangeRate);
                            if (discountAmount > maxDiscountVND) {
                                discountAmount = maxDiscountVND;
                            }
                        }
                    } else if (coupon.discount_type === 'fixed_amount') {
                        // Assume fixed_amount is in USD
                        discountAmount = Math.round(coupon.discount_value * exchangeRate);
                    }
                }
            }
        }

        const totalAmount = Math.max(0, subtotal - discountAmount);

        // Check minimum order amount
        if (couponId) {
            const { data: coupon } = await supabaseAdmin
                .from('coupons')
                .select('min_order_amount')
                .eq('id', couponId)
                .single();

            if (coupon?.min_order_amount && totalAmount < coupon.min_order_amount) {
                return NextResponse.json(
                    { error: `Minimum order amount is ${coupon.min_order_amount} VNĐ` },
                    { status: 400 }
                );
            }
        }

        // 2026-01-24: Check for existing pending order to prevent duplicates if user clicks multiple times
        // Note: For now, we always create new order to keep it simple, or reused pending.
        // Let's create new for now to avoid complexity with updating txn_refs for different providers

        const orderNumber = `ORD-${Date.now()}`;

        // Create order (Admin Client - bypassing RLS for INSERT)
        const orderData = {
            user_id: userId || null, // Can be null for guest checkout
            plan_id: plan.id,
            plan_slug: planSlug,
            plan_name: plan.name,
            billing_cycle: billingCycle,
            credits_amount: credits,
            subtotal: subtotal,
            discount_amount: discountAmount,
            total_amount: totalAmount,
            coupon_id: couponId,
            coupon_code: couponCode?.toUpperCase() || null,
            customer_name: customerInfo?.name || null,
            customer_email: customerInfo?.email || null,
            customer_phone: customerInfo?.phone || null,
            status: 'pending',
            currency: 'VND',
            order_number: orderNumber,
            payment_method: paymentMethod || 'onepay'
        };

        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert(orderData)
            .select()
            .single();

        if (orderError || !order) {
            console.error('Order creation error:', orderError);
            return NextResponse.json(
                { error: 'Failed to create order' },
                { status: 500 }
            );
        }

        // Log payment creation (Admin Client)
        await supabaseAdmin.from('payment_logs').insert({
            order_id: order.id,
            event_type: 'order_created',
            event_data: { orderNumber: order.order_number, totalAmount },
            status: 'success',
        });

        // HANDLE PAYMENT GENERATION BASED ON METHOD
        const selectedMethod = paymentMethod || 'onepay';

        if (selectedMethod === 'onepay') {
            // Generate OnePay URL or just return Order Info for Modal
            // We'll generate URL just in case, but modal might use QR

            // Create a transaction reference for OnePay
            const timestamp = Date.now();
            const shortId = order.id.replace(/-/g, '').slice(0, 8).toUpperCase();
            const txnRef = `${shortId}_${timestamp}`;

            // Save txnRef
            await supabaseAdmin
                .from('orders')
                .update({ onepay_txn_ref: txnRef })
                .eq('id', order.id);

            const appUrl = getAppUrl();
            const paymentUrl = onePayService.buildPaymentUrl({
                amount: totalAmount,
                orderId: txnRef,
                orderInfo: `Order ${order.order_number}`,
                // Use a default path, or parameterized
                returnUrl: `${appUrl}/buy-plan/payment-return`,
                ipAddr: '127.0.0.1', // Should extract from request headers if possible
                locale: 'vn'
            });

            return NextResponse.json({
                success: true,
                orderId: order.order_number,
                orderUuid: order.id,
                paymentUrl: paymentUrl,
                amount: totalAmount,
                orderDetails: {
                    planName: plan.name,
                    planSlug: plan.slug,
                    billingCycle: billingCycle,
                    credits: credits,
                    subtotal: subtotal,
                    discount: discountAmount,
                    total: totalAmount,
                    currency: 'VND',
                },
            });

        } else {
            // Default: VNPay
            const vnpayClient = createVNPayClient();

            try {
                const paymentUrl = vnpayClient.createPaymentUrl({
                    orderId: order.vnpay_txn_ref || orderNumber, // vnpay client handles txn ref logic usually or we pass unique
                    amount: totalAmount,
                    orderInfo: `Thanh toan ${plan.name}`,
                    customerName: customerInfo?.name,
                    customerEmail: customerInfo?.email,
                    customerPhone: customerInfo?.phone || '',
                    returnUrl: process.env.VNPAY_RETURN_URL || `${getAppUrl()}/buy-plan/payment-return`,
                    ipAddr: '127.0.0.1',
                    locale: 'vn',
                });

                console.log('[VNPay] Generated Payment URL:', paymentUrl);

                return NextResponse.json({
                    success: true,
                    orderId: order.order_number,
                    orderUuid: order.id,
                    paymentUrl: paymentUrl,
                    orderDetails: {
                        planName: plan.name,
                        planSlug: plan.slug,
                        billingCycle: billingCycle,
                        credits: credits,
                        subtotal: subtotal,
                        discount: discountAmount,
                        total: totalAmount,
                        currency: 'VND',
                    },
                });
            } catch (vnpayError: any) {
                console.error('VNPay URL generation error:', vnpayError);
                return NextResponse.json(
                    { error: `Failed to generate payment URL: ${vnpayError.message}` },
                    { status: 500 }
                );
            }
        }

    } catch (error) {
        console.error('Create order error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
