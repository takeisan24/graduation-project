"use client"

import { useState } from "react";
import { toast } from "sonner";

import { supabaseClient } from "@/lib/supabaseClient";

export interface CreditPackage {
    id: string;
    credits: number;
    price: string;
    numericPrice: number;
    label: string;
}

export function useTopUpModal() {
    const [isTopUpModalOpen, setTopUpModalOpen] = useState(false);
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [currentOrder, setCurrentOrder] = useState<any>(null); // Store current created order

    const creditPackages: CreditPackage[] = [
        { id: '50_credits', credits: 50, price: '250,000 VND', label: 'Thử nghiệm', numericPrice: 250000 },
        { id: '150_credits', credits: 150, price: '600,000 VND', label: 'Phổ biến', numericPrice: 600000 },
        { id: '350_credits', credits: 350, price: '1,200,000 VND', label: 'Tiết kiệm nhất', numericPrice: 1200000 },
    ];

    const handleTopUpClick = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setTopUpModalOpen(true);
    };

    const handleBuyCredits = async (pkg: CreditPackage) => {
        try {
            // 1. Create Order in Supabase
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                toast.error("Vui lòng đăng nhập để thực hiện giao dịch");
                return;
            }

            // Generate unique order number (simple timestamp based for demo, ideally UUID or sequence)
            const orderNumber = `ORD-${Date.now()}`;

            const { data, error } = await supabaseClient
                .from('orders')
                .insert({
                    user_id: user.id,
                    order_number: orderNumber,
                    plan_name: `Gói ${pkg.credits} Credits`,
                    plan_slug: pkg.id,
                    billing_cycle: 'monthly', // Default or N/A for credits
                    credits_amount: pkg.credits,
                    subtotal: pkg.numericPrice,
                    total_amount: pkg.numericPrice,
                    status: 'pending',
                    customer_email: user.email,
                    currency: 'VND'
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Set Current Order and Open Payment Modal
            setCurrentOrder(data);
            setTopUpModalOpen(false);
            setPaymentModalOpen(true); // Open the next step

        } catch (error: any) {
            console.error("Error creating order:", error);
            toast.error("Không thể tạo đơn hàng: " + error.message);
        }
    };

    const handleCloseModal = () => {
        setTopUpModalOpen(false);
    };

    const handleClosePaymentModal = () => {
        setPaymentModalOpen(false);
        setCurrentOrder(null);
    }

    return {
        isTopUpModalOpen,
        setTopUpModalOpen,
        creditPackages,
        handleTopUpClick,
        handleBuyCredits,
        handleCloseModal,
        // Payment Modal Props
        isPaymentModalOpen,
        setPaymentModalOpen,
        currentOrder,
        handleClosePaymentModal
    };
}
