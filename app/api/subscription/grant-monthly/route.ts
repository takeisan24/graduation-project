import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id') || req.nextUrl.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ success: false, message: 'Missing User ID' }, { status: 400 });
        }

        // 1. Fetch User Subscription Info
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, credits_balance, next_credit_grant_at, current_plan_slug, subscription_status')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }

        // 2. Check if Grant is Due
        if (!user.next_credit_grant_at) {
            return NextResponse.json({ success: true, granted: false, message: 'No scheduled grant' });
        }

        const nextGrantDate = new Date(user.next_credit_grant_at);
        const now = new Date();

        if (now < nextGrantDate) {
            return NextResponse.json({ success: true, granted: false, message: 'Not due yet' });
        }

        // 3. Grant Due: Fetch Plan Credits
        if (!user.current_plan_slug || user.subscription_status !== 'active') {
            return NextResponse.json({ success: true, granted: false, message: 'Subscription inactive' });
        }

        const { data: plan, error: planError } = await supabaseAdmin
            .from('plans')
            .select('credits_monthly')
            .eq('slug', user.current_plan_slug)
            .single();

        if (planError || !plan) {
            return NextResponse.json({ success: false, message: 'Plan not found' }, { status: 400 });
        }

        // 4. Update User Credits & Next Grant Date
        const creditsToAdd = plan.credits_monthly;
        const newBalance = (user.credits_balance || 0) + creditsToAdd;

        // Next grant: +1 Month from the *scheduled* date
        const nextNextGrantDate = new Date(nextGrantDate);
        nextNextGrantDate.setMonth(nextNextGrantDate.getMonth() + 1);

        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                credits_balance: newBalance,
                next_credit_grant_at: nextNextGrantDate.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Log the grant
        await supabaseAdmin.from('credit_transactions').insert({
            user_id: userId,
            action_type: 'CREDIT_PURCHASED',
            credits_used: 0,
            credits_remaining: newBalance,
            source: 'subscription_renewal',
            metadata: {
                description: `Monthly grant from ${user.current_plan_slug}`,
                plan: user.current_plan_slug,
                amount: creditsToAdd
            }
        });

        const message = `Đã cộng ${creditsToAdd} credits từ chu kỳ tháng của gói ${user.current_plan_slug}`;

        return NextResponse.json({
            success: true,
            granted: true,
            creditsAdded: creditsToAdd,
            newBalance: newBalance,
            message: message
        });

    } catch (error: any) {
        console.error("Grant API Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
