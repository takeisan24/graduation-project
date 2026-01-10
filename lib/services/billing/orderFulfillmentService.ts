import { supabaseAdmin } from '@/lib/supabaseAdmin';
// import { mailService } from '@/lib/services/mail/mailService';
// import PaymentSuccessEmail from '@/components/emails/PaymentSuccessEmail';

export const orderFulfillmentService = {
    async fulfillOrder(orderId: string, paymentData: any) {
        try {
            // 1. Fetch Order Details
            const { data: order, error: orderErr } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderErr || !order) {
                console.error("Fulfillment: Order not found", orderErr);
                throw new Error(`Order not found for ID: ${orderId}`);
            }

            // IDEMPOTENCY CHECK
            if (order.credits_added) {
                console.log(`Fulfillment: Order ${orderId} already fulfilled. Skipping.`);
                return { success: true, message: 'Already fulfilled' };
            }

            // 2. Fetch User & Plan Details
            let { data: user } = await supabaseAdmin
                .from('users')
                .select('credits_balance, subscription_ends_at, plan, name')
                .eq('id', order.user_id)
                .single();

            // Auto-create profile if missing (resilience)
            if (!user) {
                console.warn(`Fulfillment: User profile missing for ${order.user_id}, attempting auto-creation...`);

                const { error: rpcError } = await supabaseAdmin.rpc('ensure_user_profile', {
                    p_user_id: order.user_id,
                    p_email: order.customer_email,
                    p_name: order.customer_name
                });

                if (rpcError) {
                    console.error("Fulfillment: Failed to auto-create user profile", rpcError);
                    console.log("Fulfillment Debug: RPC Error Details:", JSON.stringify(rpcError));
                    // Don't throw immediately, maybe we can proceed? No, we need 'user' object below.
                }

                // Retry fetch
                const { data: newUser } = await supabaseAdmin
                    .from('users')
                    .select('credits_balance, subscription_ends_at, plan, name')
                    .eq('id', order.user_id)
                    .single();

                user = newUser;
            }

            if (!user) {
                console.error("Fulfillment: User not found even after auto-creation attempt");
                throw new Error('User not found');
            }

            const { data: planData, error: planError } = await supabaseAdmin
                .from('plans')
                .select('name, credits_monthly')
                .eq('slug', order.plan_slug)
                .single();

            if (planError || !planData) {
                console.error(`Fulfillment: Plan data not found for slug '${order.plan_slug}'`, planError);
                throw new Error(`Plan data missing for slug: ${order.plan_slug}`);
            }

            // 3. Calculate Permissions (Credits & Time)
            const creditsToAdd = planData.credits_monthly;
            const currentBalance = user.credits_balance || 0;
            const newBalance = currentBalance + creditsToAdd;

            // Time Extension
            const now = new Date();
            const currentExpiry = user.subscription_ends_at ? new Date(user.subscription_ends_at) : null;
            const durationDays = order.billing_cycle === 'yearly' ? 365 : 30;

            let basisDate = now;
            if (currentExpiry && currentExpiry > now) {
                basisDate = currentExpiry;
            }

            const newExpiry = new Date(basisDate);
            newExpiry.setDate(newExpiry.getDate() + durationDays);

            // Next Grant Date for Yearly Plans
            let nextGrantDate: Date | null = null;
            if (order.billing_cycle === 'yearly') {
                nextGrantDate = new Date();
                nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);
            }

            // 4. Update 'users' Table
            const { error: userUpdateError } = await supabaseAdmin
                .from('users')
                .update({
                    plan: order.plan_slug,
                    current_plan_slug: order.plan_slug,
                    current_plan_id: order.plan_id,
                    subscription_status: 'active',
                    subscription_ends_at: newExpiry.toISOString(),
                    credits_balance: newBalance,
                    next_credit_grant_at: nextGrantDate ? nextGrantDate.toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', order.user_id);

            if (userUpdateError) {
                console.error("Fulfillment: Failed to update user", userUpdateError);
                throw new Error('Failed to update user profile');
            }

            // 5. Update 'subscriptions' Table
            await supabaseAdmin
                .from('subscriptions')
                .insert({
                    user_id: order.user_id,
                    plan: order.plan_slug,
                    status: 'active',
                    billing_cycle: order.billing_cycle,
                    current_period_start: now.toISOString(),
                    current_period_end: newExpiry.toISOString(),
                    next_credit_date: nextGrantDate ? nextGrantDate.toISOString().split('T')[0] : null,
                    credits_per_period: creditsToAdd,
                    original_order_id: order.id
                });

            // 6. Mark Order as Completed
            await supabaseAdmin
                .from('orders')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    credits_added: true,
                    credits_added_at: new Date().toISOString(),
                    // Update OnePay specific fields if passed in paymentData, 
                    // though usually the caller handles status updates before calling fulfill.
                    // We assume caller handles raw response saving if it's strictly payment related.
                    // But if we want to be safe, we can trigger logs here too.
                })
                .eq('id', order.id);

            // 7. Send Success Email
            /*
            // TEMPORARILY DISABLED as requested by user for Resend setup
            if (user.email) {
                await mailService.sendEmail({
                    to: user.email,
                    subject: 'Thanh toán thành công - ContentScheduleAI',
                    react: PaymentSuccessEmail({
                        customerName: user.full_name || 'Khách hàng',
                        planName: planData.name || order.plan_slug,
                        amount: order.amount.toLocaleString('vi-VN') + ' VND',
                        orderNumber: order.id.slice(0, 8).toUpperCase()
                    })
                });
            }
            */
            console.log('Email sending skipped (Pending Resend Setup)');

            console.log(`Order ${orderId} fulfilled successfully. Credits added: ${creditsToAdd}`);
            return { success: true, creditsAdded: creditsToAdd, newBalance: newBalance };

        } catch (error: any) {
            console.error("Order Fulfillment Error:", error);
            // Log error to payment_logs
            try {
                await supabaseAdmin.from('payment_logs').insert({
                    order_id: orderId,
                    event_type: 'fulfillment_error',
                    payload: { error: error.message || error.toString(), stack: error.stack },
                    error_message: `Fulfillment Failed: ${error.message}`
                });
            } catch (logErr) {
                console.error("Failed to log fulfillment error", logErr);
            }
            throw error;
        }
    }
};
