/**
 * Create Page - Publish Modal Store
 * 
 * Manages publish modal state (simple state flag)
 */

import { create } from 'zustand';

interface PublishModalState {
  // State
  isPublishModalOpen: boolean;

  // Actions
  setIsPublishModalOpen: (isOpen: boolean) => void;
}

export const usePublishModalStore = create<PublishModalState>((set) => ({
  // Initial state
  isPublishModalOpen: false,

  setIsPublishModalOpen: (isOpen) => set({ isPublishModalOpen: isOpen }),
}));

