/**
 * Credits Store
 * 
 * Manages user credits, plan, and limits
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { handleUnauthorizedOnClient } from '@/lib/utils/authClient';

export interface CreditsState {
  // State
  creditsRemaining: number;
  creditsUsed: number;
  totalCredits: number;
  isLoadingCredits: boolean;
  currentPlan: string;
  profileLimits?: { current: number; limit: number };
  postLimits?: { current: number; limit: number };
  limitsFetched: boolean;
  limitsLastFetched: number | null;
  usageHistoryTrigger: boolean;
  usageHistoryNeedsRefresh: boolean;
  storageUsage: { usedBytes: number; limitBytes: number; limitGB: number; usagePercent: number } | null;

  // Annual Plan data
  billingCycle: string | null;
  creditsPerPeriod: number | null;
  nextCreditGrantAt: string | null;
  unreceivedAnnualCredits: number;
  subscriptionEndsAt: string | null;
  // ✅ NEW: Trigger counter to force Sidebar refresh
  refreshTrigger: number;

  // Actions
  fetchCredits: () => Promise<void>;
  refreshCredits: (force?: boolean) => Promise<void>;
  updateCredits: (creditsRemaining: number) => void;
  setCurrentPlan: (plan: string) => void;
  markUsageHistoryRefreshed: () => void;
}

// Module-level lock to prevent concurrent API calls
let isRefreshingCreditsGlobal = false;

export const useCreditsStore = create<CreditsState>((set, get) => ({
  // Initial state - load from localStorage
  creditsRemaining: loadFromLocalStorage<number>('creditsRemaining', 0),
  creditsUsed: 0,
  totalCredits: 0,
  isLoadingCredits: false,
  currentPlan: loadFromLocalStorage<string>('currentPlan', 'free'),
  profileLimits: loadFromLocalStorage<{ current: number; limit: number }>('profileLimits', { current: 0, limit: 0 }),
  postLimits: loadFromLocalStorage<{ current: number; limit: number }>('postLimits', { current: 0, limit: 0 }),
  limitsFetched: false,
  limitsLastFetched: null,
  usageHistoryTrigger: false,
  usageHistoryNeedsRefresh: false,
  storageUsage: null,
  billingCycle: null,
  creditsPerPeriod: null,
  nextCreditGrantAt: null,
  unreceivedAnnualCredits: 0,
  subscriptionEndsAt: null,
  refreshTrigger: 0, // ✅ NEW: Counter to force Sidebar updates

  // Fetch credits from localStorage (backward compatibility)
  // Credits should come from auth response on login
  fetchCredits: async () => {
    const cachedCredits = loadFromLocalStorage<number>('creditsRemaining', 0);
    const cachedPlan = loadFromLocalStorage<string>('currentPlan', 'free');
    set({ creditsRemaining: cachedCredits, currentPlan: cachedPlan });
  },

  // Refresh credits from API (for post-payment or plan change sync)
  refreshCredits: async (force = false) => {
    // Prevent concurrent calls using module-level lock
    if (isRefreshingCreditsGlobal) {
      console.log('[refreshCredits] Already refreshing, skipping duplicate call');
      return;
    }

    // Tối ưu: Cache 30 giây (giống như connections cache) để giảm số lần gọi API
    const { limitsFetched, limitsLastFetched } = get();
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (increased from 30s)
    if (!force && limitsFetched && limitsLastFetched && (Date.now() - limitsLastFetched) < CACHE_TTL_MS) {
      console.log('[refreshCredits] Recently refreshed (cache still valid), skipping duplicate call');
      return;
    }

    try {
      isRefreshingCreditsGlobal = true;
      set({ isLoadingCredits: true });

      // Get current session from Supabase to include Authorization header
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        console.warn('[refreshCredits] No session available:', sessionError);
        return;
      }

      // Call API with Authorization header

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      const [limitsRes, usageRes, storageRes] = await Promise.all([
        fetch('/api/limits', { headers }),
        fetch('/api/usage', { headers }),
        fetch('/api/usage/storage', { headers }),
      ]);

      if (!limitsRes.ok) {
        console.error(`[refreshCredits] API error: ${limitsRes.status} ${limitsRes.statusText}`);
        if (limitsRes.status === 401) {
          // Session không hợp lệ -> buộc logout và redirect về trang đăng nhập
          handleUnauthorizedOnClient('refreshCredits');
        }
        return;
      }

      const d = await limitsRes.json();
      if (d.success && (d.data?.creditsRemaining !== undefined)) {
        const { updateCredits } = get();
        updateCredits(d.data.creditsRemaining);
        if (d.data?.plan) {
          set({ currentPlan: d.data.plan });
          saveToLocalStorage('currentPlan', d.data.plan);
        }
        // Update limits if present
        if (d.data?.profiles) {
          set({ profileLimits: d.data.profiles });
          saveToLocalStorage('profileLimits', d.data.profiles);
        }
        if (d.data?.posts) {
          set({ postLimits: d.data.posts });
          saveToLocalStorage('postLimits', d.data.posts);
        }
        set({ limitsFetched: true, limitsLastFetched: Date.now() });
      } else {
        console.warn('Failed to refresh credits:', d);
      }

      if (usageRes.ok) {
        const u = await usageRes.json();
        if (u.success && u.data) {
          const totalInfo = u.data.credits.total;
          const { creditsRemaining } = get();

          // Calculate unreceived annual credits if strictly yearly
          const bCycle = u.data.credits.billingCycle;
          const endsAtStr = u.data.credits.subscriptionEndsAt;
          const cPerPeriod = u.data.credits.creditsPerPeriod || 0;
          let unreceived = 0;

          if (bCycle === 'yearly' && endsAtStr) {
            const endsAt = new Date(endsAtStr);
            const now = new Date();
            // Count full months remaining until endsAt
            let monthsLeft = (endsAt.getFullYear() - now.getFullYear()) * 12;
            monthsLeft -= now.getMonth();
            monthsLeft += endsAt.getMonth();
            if (monthsLeft > 0) {
              unreceived = monthsLeft * cPerPeriod;
            }
          }

          set({
            creditsUsed: totalInfo - creditsRemaining,
            totalCredits: totalInfo,
            billingCycle: bCycle,
            creditsPerPeriod: cPerPeriod,
            nextCreditGrantAt: u.data.credits.nextCreditGrantAt,
            unreceivedAnnualCredits: unreceived,
            subscriptionEndsAt: endsAtStr
          });
        }
      }

      if (storageRes.ok) {
        const s = await storageRes.json();
        if (s.success && s.data) {
          set({
            storageUsage: {
              usedBytes: s.data.usedBytes,
              limitBytes: s.data.limitBytes,
              limitGB: s.data.limitGB,
              usagePercent: s.data.usagePercent,
            }
          });
        }
      }





    } catch (error: any) {
      console.error('Error refreshing credits:', error);
    } finally {
      isRefreshingCreditsGlobal = false;
      set({ isLoadingCredits: false });
      // ✅ Increment trigger to force Sidebar re-render
      set((state) => ({ refreshTrigger: state.refreshTrigger + 1 }));
    }
  },

  // Update credits (called after each action that uses credits)
  updateCredits: (creditsRemaining) => {
    set((state) => ({
      creditsRemaining,
      creditsUsed: state.totalCredits - creditsRemaining,
      usageHistoryTrigger: state.creditsRemaining !== creditsRemaining
        ? !state.usageHistoryTrigger
        : state.usageHistoryTrigger,
      usageHistoryNeedsRefresh: state.creditsRemaining !== creditsRemaining
        ? true
        : state.usageHistoryNeedsRefresh,
    }));
    saveToLocalStorage('creditsRemaining', creditsRemaining);
  },

  setCurrentPlan: (plan) => {
    set({ currentPlan: plan });
    saveToLocalStorage('currentPlan', plan);
  },

  markUsageHistoryRefreshed: () => {
    set({ usageHistoryNeedsRefresh: false });
  },
}));
