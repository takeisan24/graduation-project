import { createClient } from '@supabase/supabase-js';
import { createVNPayClient } from '@/lib/payments/vnpay-client';
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';


/**
 * VNPay IPN (Instant Payment Notification) Webhook
 * This endpoint receives payment notifications from VNPay
 */
export async function GET(request: Request) {
    try {
        // Parse query parameters from VNPay
        const { searchParams } = new URL(request.url);
        const vnpParams: Record<string, string> = {};

        searchParams.forEach((value, key) => {
            vnpParams[key] = value;
        });

        console.log('VNPay IPN received:', {
            txnRef: vnpParams.vnp_TxnRef,
            responseCode: vnpParams.vnp_ResponseCode,
        });

        // Initialize Admin Client explicitly for reliable DB updates
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!serviceRoleKey) {
            console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is missing');
            return NextResponse.json({ RspCode: '99', Message: 'Server Config Error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Initialize VNPay client
        const vnpayClient = createVNPayClient();

        // Parse and verify VNPay response
        const parsedResponse = vnpayClient.parseReturnUrl(vnpParams as any);

        // Check signature
        if (!parsedResponse.isValidSignature) {
            console.error('Invalid VNPay signature!', vnpParams);
            await logPaymentEvent(supabaseAdmin, null, 'ipn_signature_invalid', vnpParams, 'failed');

            return NextResponse.json(
                { RspCode: '97', Message: 'Invalid Signature' },
                { status: 400 }
            );
        }

        // Find order by order_number (since vnp_TxnRef IS our order_number)
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('order_number', parsedResponse.orderId)
            .single();

        if (orderError || !order) {
            console.error('Order not found:', parsedResponse.orderId);
            await logPaymentEvent(supabaseAdmin, null, 'ipn_order_not_found', vnpParams, 'failed');

            return NextResponse.json(
                { RspCode: '01', Message: 'Order Not Found' },
                { status: 404 }
            );
        }

        // Idempotency check - prevent duplicate processing
        if (order.status === 'completed' && order.credits_added) {
            console.log('Order already processed:', order.order_number);
            return NextResponse.json(
                { RspCode: '00', Message: 'Order Already Confirmed' },
                { status: 200 }
            );
        }

        // Check if payment was successful
        if (parsedResponse.isSuccess) {
            // Update order status (Admin Client)
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    vnpay_response_code: parsedResponse.responseCode,
                    vnpay_transaction_no: parsedResponse.transactionNo,
                    vnpay_secure_hash: parsedResponse.secureHash,
                    vnpay_bank_code: parsedResponse.bankCode,
                    vnpay_bank_tran_no: parsedResponse.bankTranNo,
                    vnpay_card_type: parsedResponse.cardType,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);

            if (updateError) {
                console.error('Failed to update order:', updateError);
                await logPaymentEvent(supabaseAdmin, order.id, 'ipn_update_failed', updateError, 'failed');

                return NextResponse.json(
                    { RspCode: '99', Message: 'Update Order Failed' },
                    { status: 500 }
                );
            }

            // Add credits to user (Admin Client)
            if (order.user_id) {
                const { error: creditsError } = await addCreditsToUser(
                    supabaseAdmin,
                    order.user_id,
                    order.credits_amount, // Corrected column name
                    order.id,
                    order.plan_id
                );

                if (creditsError) {
                    console.error('Failed to add credits:', creditsError);
                    // Don't fail the IPN, but log the error
                    await logPaymentEvent(supabaseAdmin, order.id, 'ipn_credits_failed', creditsError, 'failed');
                } else {
                    // Mark credits as added
                    await supabaseAdmin
                        .from('orders')
                        .update({
                            credits_added: true,
                            status: 'completed',
                        })
                        .eq('id', order.id);
                }

                // Record coupon usage if applicable
                if (order.coupon_id) {
                    await supabaseAdmin.from('coupon_usage').insert({
                        coupon_id: order.coupon_id,
                        user_id: order.user_id,
                        order_id: order.id,
                        discount_amount: order.discount_amount,
                    });
                }
            }

            // Log success
            await logPaymentEvent(supabaseAdmin, order.id, 'ipn_success', parsedResponse, 'success');

            return NextResponse.json(
                { RspCode: '00', Message: 'Confirm Success' },
                { status: 200 }
            );
        } else {
            // Payment failed
            await supabaseAdmin
                .from('orders')
                .update({
                    status: 'failed',
                    vnpay_response_code: parsedResponse.responseCode,
                    vnpay_transaction_no: parsedResponse.transactionNo,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);

            await logPaymentEvent(supabaseAdmin, order.id, 'ipn_payment_failed', parsedResponse, 'failed');

            return NextResponse.json(
                { RspCode: '00', Message: 'Payment Failed Recorded' },
                { status: 200 }
            );
        }
    } catch (error) {
        console.error('IPN processing error:', error);
        return NextResponse.json(
            { RspCode: '99', Message: 'Unknown Error' },
            { status: 500 }
        );
    }
}

/**
 * Add credits to user and create credit transaction
 */
async function addCreditsToUser(
    supabase: any,
    userId: string,
    credits: number,
    orderId: string,
    planId: string
) {
    try {
        // Get current user credits
        const { data: user } = await supabase
            .from('users')
            .select('credits_balance')
            .eq('id', userId)
            .single();

        const currentBalance = user?.credits_balance || 0;
        const newBalance = currentBalance + credits;

        // Update user credits
        const { error: updateError } = await supabase
            .from('users')
            .update({
                credits_balance: newBalance,
                last_plan_purchase_at: new Date().toISOString(),
            })
            .eq('id', userId);

        if (updateError) return { error: updateError };

        // Create credit transaction
        const { error: txnError } = await supabase
            .from('credit_transactions')
            .insert({
                user_id: userId,
                credits_used: -credits, // Negative means added
                balance_after: newBalance,
                source: 'purchase',
                order_id: orderId,
                description: `Purchased ${credits} credits`,
            });

        if (txnError) return { error: txnError };

        // Create or update subscription
        const { error: subError } = await createSubscription(supabase, userId, planId, orderId);

        return { error: subError };
    } catch (error) {
        return { error };
    }
}

/**
 * Create subscription record
 */
async function createSubscription(supabase: any, userId: string, planId: string, orderId: string) {
    try {
        // Get plan details
        const { data: plan } = await supabase
            .from('plans')
            .select('*')
            .eq('id', planId)
            .single();

        if (!plan) return { error: 'Plan not found' };

        // Get order to determine billing cycle
        const { data: order } = await supabase
            .from('orders')
            .select('billing_cycle, credits_amount')
            .eq('id', orderId)
            .single();

        if (!order) return { error: 'Order not found' };

        const isYearly = order.billing_cycle === 'yearly';
        const creditsPerPeriod = isYearly ? plan.credits_monthly : order.credits_amount;

        // Create subscription
        const { error } = await supabase
            .from('subscriptions')
            .insert({
                user_id: userId,
                plan_id: planId,
                billing_cycle: order.billing_cycle,
                credits_per_period: creditsPerPeriod,
                status: 'active',
                current_period_start: new Date().toISOString(),
                current_period_end: calculatePeriodEnd(order.billing_cycle),
                next_credit_date: isYearly ? calculateNextMonth() : null,
                is_auto_renew: false, // Manual payments only for now
                original_order_id: orderId,
            });

        return { error };
    } catch (error) {
        return { error };
    }
}

/**
 * Calculate subscription period end
 */
function calculatePeriodEnd(billingCycle: string): string {
    const now = new Date();
    if (billingCycle === 'yearly') {
        now.setFullYear(now.getFullYear() + 1);
    } else {
        now.setMonth(now.getMonth() + 1);
    }
    return now.toISOString();
}

/**
 * Calculate next month for yearly subscriptions
 */
function calculateNextMonth(): string {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    return now.toISOString();
}

/**
 * Log payment event
 */
async function logPaymentEvent(
    supabase: any,
    orderId: string | null,
    eventType: string,
    eventData: any,
    status: string
) {
    try {
        await supabase.from('payment_logs').insert({
            order_id: orderId,
            event_type: eventType,
            event_data: eventData,
            status: status,
        });
    } catch (error) {
        console.error('Failed to log payment event:', error);
    }
}
