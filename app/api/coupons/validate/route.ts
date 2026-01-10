import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const { code, planSlug, billingCycle, userId } = body;

        // Initialize Admin Client explicitly for production security
        // This allows the API to validate coupons without exposing the table to public RLS
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
        if (!code || !planSlug || !billingCycle) {
            return NextResponse.json(
                { error: 'Missing required fields: code, planSlug, billingCycle' },
                { status: 400 }
            );
        }

        if (!['monthly', 'yearly'].includes(billingCycle)) {
            return NextResponse.json(
                { error: 'Invalid billing cycle. Must be monthly or yearly' },
                { status: 400 }
            );
        }

        // Fetch coupon from database (Using Admin Client)
        const { data: coupon, error: couponError } = await supabaseAdmin
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

        console.log('[CouponAPI] DB Result:', { coupon, error: couponError });

        if (couponError || !coupon) {
            console.error('[CouponAPI] Not found or error:', couponError);
            return NextResponse.json(
                { valid: false, message: 'Coupon not found' },
                { status: 404 }
            );
        }

        // Check if active
        if (!coupon.is_active) {
            return NextResponse.json(
                { valid: false, message: 'Coupon is no longer active' },
                { status: 400 }
            );
        }

        // Check dates
        const now = new Date();
        const startDate = new Date(coupon.start_date);
        const endDate = new Date(coupon.end_date);

        if (now < startDate) {
            return NextResponse.json(
                { valid: false, message: 'Coupon is not yet valid' },
                { status: 400 }
            );
        }

        if (now > endDate) {
            return NextResponse.json(
                { valid: false, message: 'Coupon has expired' },
                { status: 400 }
            );
        }

        // Check usage limit
        if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
            return NextResponse.json(
                { valid: false, message: 'Coupon usage limit reached' },
                { status: 400 }
            );
        }

        // Check billing cycle applicability
        if (
            coupon.applies_to_billing !== 'both' &&
            coupon.applies_to_billing !== billingCycle
        ) {
            return NextResponse.json(
                {
                    valid: false,
                    message: `Coupon only applies to ${coupon.applies_to_billing} billing`,
                },
                { status: 400 }
            );
        }

        // Check plan applicability
        if (coupon.applies_to_plans && coupon.applies_to_plans.length > 0) {
            // Get plan ID from slug using Admin Client
            const { data: plan } = await supabaseAdmin
                .from('plans')
                .select('id')
                .eq('slug', planSlug)
                .single();

            if (!plan || !coupon.applies_to_plans.includes(plan.id)) {
                return NextResponse.json(
                    { valid: false, message: 'Coupon does not apply to this plan' },
                    { status: 400 }
                );
            }
        }

        // Check user usage limit (if userId provided)
        if (userId && coupon.usage_per_user) {
            const { data: usageData, error: usageError } = await supabaseAdmin
                .from('coupon_usage')
                .select('id')
                .eq('coupon_id', coupon.id)
                .eq('user_id', userId);

            if (!usageError && usageData && usageData.length >= coupon.usage_per_user) {
                return NextResponse.json(
                    {
                        valid: false,
                        message: 'You have already used this coupon the maximum number of times',
                    },
                    { status: 400 }
                );
            }
        }

        // Coupon is valid!
        return NextResponse.json({
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                discountType: coupon.discount_type,
                discountValue: coupon.discount_value,
                maxDiscountAmount: coupon.max_discount_amount,
                minOrderAmount: coupon.min_order_amount,
            },
            message: 'Coupon is valid',
        });
    } catch (error) {
        console.error('Coupon validation error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
