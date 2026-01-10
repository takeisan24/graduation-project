"use client"

import { useState, useEffect, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { GENERIC_ERRORS } from "@/lib/messages/errors";
import { useCreditsStore } from "@/store";
import { useShallow } from "zustand/react/shallow";

export function usePlanModal() {
    const [isPlanModalOpen, setPlanModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string>('free');
    const [creditsToAdd, setCreditsToAdd] = useState<string>('0');
    const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

    const { currentPlan, creditsRemaining, refreshCredits: refreshCreditsFromStore } = useCreditsStore(useShallow((state) => ({
        currentPlan: state.currentPlan,
        creditsRemaining: state.creditsRemaining,
        refreshCredits: state.refreshCredits,
    })));

    const refreshCredits = useCallback((force?: boolean) => refreshCreditsFromStore(force), [refreshCreditsFromStore]);

    const planOptions = [
        { value: 'free', label: 'Free' },
        { value: 'creator', label: 'Creator' },
        { value: 'creator_pro', label: 'Creator Pro' },
        { value: 'agency', label: 'Agency' },
    ];

    useEffect(() => {
        setSelectedPlan(currentPlan || 'free');
    }, [currentPlan]);

    useEffect(() => {
        setCreditsToAdd(String(creditsRemaining ?? 0));
    }, [creditsRemaining]);

    const handlePlanAreaClick = async () => {
        await refreshCredits();
        setSelectedPlan(currentPlan || 'free');
        setCreditsToAdd(String(creditsRemaining ?? 0));
        setPlanModalOpen(true);
    };

    const handlePlanModalClose = () => {
        if (isSubmittingPlan) return;
        setPlanModalOpen(false);
        setCreditsToAdd(String(creditsRemaining ?? 0));
        setSelectedPlan(currentPlan || 'free');
    };

    const handlePlanSubmit = async () => {
        if (isSubmittingPlan) return;
        const numericCredits = Math.max(0, Number(creditsToAdd) || 0);
        try {
            setIsSubmittingPlan(true);
            const { data: { session } } = await supabaseClient.auth.getSession();
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (session?.access_token) {
                headers.Authorization = `Bearer ${session.access_token}`;
            }
            const res = await fetch("/api/debug/update-plan", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    plan: selectedPlan,
                    credits: numericCredits,
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                toast.error(GENERIC_ERRORS.PLAN_UPDATE_FAILED(errorText), { description: errorText });
                return;
            }

            toast.success("Plan and credits updated");
            await refreshCredits(true);
            handlePlanModalClose();
        } catch (error: any) {
            toast.error(GENERIC_ERRORS.UNABLE_TO_UPDATE_PLAN(error?.message || GENERIC_ERRORS.UNKNOWN_ERROR), { description: error?.message || GENERIC_ERRORS.UNKNOWN_ERROR });
        } finally {
            setIsSubmittingPlan(false);
        }
    };

    return {
        isPlanModalOpen,
        setPlanModalOpen,
        selectedPlan,
        setSelectedPlan,
        creditsToAdd,
        setCreditsToAdd,
        isSubmittingPlan,
        handlePlanAreaClick,
        handlePlanModalClose,
        handlePlanSubmit,
        planOptions,
    };
}
