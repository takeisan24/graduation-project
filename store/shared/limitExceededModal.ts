/**
 * Limit Exceeded Modal Store
 * 
 * Manages the state of the limit exceeded modal (for profile limits, post limits, and credits)
 */

import { create } from 'zustand';
import { loadFromLocalStorage, saveToLocalStorage } from '@/lib/utils/storage';

export type LimitExceededReason = 
  | 'profile_limit_reached'
  | 'post_limit_reached'
  | 'insufficient_credits'
  | 'plan_limit';

export interface LimitExceededModalState {
  // Modal visibility
  isOpen: boolean;
  
  // Reason for showing modal
  reason: LimitExceededReason | null;
  
  // Error message to display (in red)
  errorMessage: string | null;
  
  // User's current usage and limits
  profileUsage?: { current: number; limit: number };
  postUsage?: { current: number; limit: number };
  creditsRemaining?: number;
  currentPlan?: string;
  
  // Selected plan for upgrade
  selectedPlan: string;
  
  // Don't show again today flag
  dontShowToday: boolean;
  
  // Last date when "don't show today" was set (to reset next day)
  dontShowUntilDate: string | null; // ISO date string
  
  // Actions
  openModal: (reason: LimitExceededReason, errorMessage: string, usage?: {
    profileUsage?: { current: number; limit: number };
    postUsage?: { current: number; limit: number };
    creditsRemaining?: number;
    currentPlan?: string;
  }) => void;
  closeModal: () => void;
  setSelectedPlan: (plan: string) => void;
  setDontShowToday: (value: boolean) => void;
  shouldShowModal: (reason: LimitExceededReason) => boolean;
}

const STORAGE_KEY_DONT_SHOW = 'limitExceededModal_dontShowUntil';

export const useLimitExceededModalStore = create<LimitExceededModalState>((set, get) => ({
  // Initial state
  isOpen: false,
  reason: null,
  errorMessage: null,
  profileUsage: undefined,
  postUsage: undefined,
  creditsRemaining: undefined,
  currentPlan: undefined,
  selectedPlan: 'creator',
  dontShowToday: false,
  dontShowUntilDate: loadFromLocalStorage<string | null>(STORAGE_KEY_DONT_SHOW, null),
  
  /**
   * Open the modal with reason and usage info
   */
  openModal: (reason, errorMessage, usage = {}) => {
    // Check if user has set "don't show today" for this reason
    const shouldShow = get().shouldShowModal(reason);
    if (!shouldShow) {
      console.log(`[LimitExceededModal] Skipping modal for ${reason} - user set "don't show today"`);
      return;
    }
    
    set({
      isOpen: true,
      reason,
      errorMessage,
      profileUsage: usage.profileUsage,
      postUsage: usage.postUsage,
      creditsRemaining: usage.creditsRemaining,
      currentPlan: usage.currentPlan || 'free',
      selectedPlan: usage.currentPlan === 'free' ? 'creator' : usage.currentPlan || 'creator',
      dontShowToday: false, // Reset checkbox when opening
    });
  },
  
  /**
   * Close the modal
   */
  closeModal: () => {
    const { dontShowToday, reason, dontShowUntilDate } = get();
    
    // If user checked "don't show today", save the date
    if (dontShowToday && reason) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      saveToLocalStorage(STORAGE_KEY_DONT_SHOW, today);
      set({ dontShowUntilDate: today });
    }
    
    set({
      isOpen: false,
      reason: null,
      errorMessage: null,
      dontShowToday: false,
    });
  },
  
  /**
   * Set selected plan for upgrade
   */
  setSelectedPlan: (plan) => {
    set({ selectedPlan: plan });
  },
  
  /**
   * Set "don't show today" checkbox
   */
  setDontShowToday: (value) => {
    set({ dontShowToday: value });
  },
  
  /**
   * Check if modal should be shown (respects "don't show today" flag)
   */
  shouldShowModal: (reason) => {
    const { dontShowUntilDate } = get();
    
    if (!dontShowUntilDate) {
      return true; // No flag set, show modal
    }
    
    // Check if we're past the "don't show until" date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dontShowDate = new Date(dontShowUntilDate);
    const todayDate = new Date(today);
    
    // If today is after the "don't show until" date, show modal again
    if (todayDate > dontShowDate) {
      // Clear the flag since we're past the date
      saveToLocalStorage(STORAGE_KEY_DONT_SHOW, null);
      set({ dontShowUntilDate: null });
      return true;
    }
    
    // Still within the "don't show" period
    return false;
  },
}));

