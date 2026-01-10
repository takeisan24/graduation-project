
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Protect with API Key or Cron Header
        const isVercelCron = req.headers.get("x-vercel-cron") === "1";
        const apiKey = req.headers.get("x-api-key");
        const adminApiKey = process.env.ADMIN_API_KEY;

        if (!isVercelCron && adminApiKey && apiKey !== adminApiKey) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const userId = req.headers.get('x-user-id') || req.nextUrl.searchParams.get('userId');

        // Logic 1: Find EXPIRED users (Non-Free) -> Downgrade to Free
        // Condition: subscription_ends_at < NOW and plan != 'free'
        // Note: checking is usually done via Cron.

        const now = new Date();
        const nowISO = now.toISOString();

        // Query for expired users
        // If userId is provided, filter by it.
        let queryDowngrade = supabaseAdmin
            .from('users')
            .select('id, plan, subscription_ends_at')
            .neq('plan', 'free')
            .lt('subscription_ends_at', nowISO);

        if (userId) {
            queryDowngrade = queryDowngrade.eq('id', userId);
        }

        const { data: expiredUsers, error: errorExpired } = await queryDowngrade;

        if (errorExpired) throw errorExpired;

        const resultsDowngrade = [];
        if (expiredUsers && expiredUsers.length > 0) {
            for (const user of expiredUsers) {
                // Set next grant date for free plan (1 month from now)
                const nextGrantDate = new Date();
                nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);

                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({
                        plan: 'free',
                        current_plan_slug: 'free',
                        subscription_status: 'active', // Free is always active? Or null? Let's say active.
                        subscription_ends_at: null, // Free plan has no expiry
                        next_credit_grant_at: nextGrantDate.toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                if (!updateError) {
                    resultsDowngrade.push(user.id);
                    // Log?
                }
            }
        }

        // Logic 2: Free Plan Monthly Refill (Top up to 10)
        // Condition: plan == 'free' AND next_credit_grant_at < NOW
        let queryRefill = supabaseAdmin
            .from('users')
            .select('id, credits_balance, next_credit_grant_at')
            .eq('plan', 'free')
            .lt('next_credit_grant_at', nowISO);

        if (userId) {
            queryRefill = queryRefill.eq('id', userId);
        }

        const { data: refillUsers, error: errorRefill } = await queryRefill;

        if (errorRefill) throw errorRefill;

        const resultsRefill = [];
        if (refillUsers && refillUsers.length > 0) {
            for (const user of refillUsers) {
                const currentBalance = user.credits_balance || 0;
                let newBalance = currentBalance;
                let creditsAdded = 0;

                // Policy: Refill to 10 if < 10
                if (currentBalance < 10) {
                    newBalance = 10;
                    creditsAdded = 10 - currentBalance;
                }

                // Next grant: +1 Month from SCHEDULED date (to keep cycle) or NOW?
                // For free plan, preventing drift isn't critical, but let's try to keep cycle.
                // If the scheduled date is too far in past, reset to NOW.
                let nextGrantDate = new Date(user.next_credit_grant_at);
                if (nextGrantDate.getTime() < now.getTime() - (30 * 24 * 60 * 60 * 1000)) {
                    // If overdue by more than 30 days, just reset from NOW
                    nextGrantDate = new Date();
                }
                nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);

                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({
                        credits_balance: newBalance,
                        next_credit_grant_at: nextGrantDate.toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                if (!updateError) {
                    resultsRefill.push({ id: user.id, added: creditsAdded });

                    if (creditsAdded > 0) {
                        await supabaseAdmin.from('credit_transactions').insert({
                            user_id: user.id,
                            action_type: 'CREDIT_PURCHASED', // or REFUND/GRANT
                            credits_used: 0,
                            credits_remaining: newBalance,
                            source: 'system_refill',
                            metadata: {
                                description: `Free plan monthly refill`,
                                plan: 'free',
                                amount: creditsAdded
                            }
                        });
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            downgraded_count: resultsDowngrade.length,
            downgraded_ids: resultsDowngrade,
            refilled_count: resultsRefill.length,
            refilled_details: resultsRefill
        });

    } catch (error: any) {
        console.error("Check Expired API Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
