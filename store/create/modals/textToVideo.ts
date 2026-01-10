/**
 * Create Page - Text-to-Video Modal Store
 * 
 * Manages text-to-video modal state and actions
 */

import { create } from 'zustand';
import { toast } from 'sonner';
import { useVideoProjectsStore } from '../../videos/videosPageStore';
import type { TextToVideoConfig } from '../../shared/types';

interface TextToVideoModalState {
  // State
  isTextToVideoModalOpen: boolean;
  activeProjectId?: string;
  activeStep: 'form' | 'production' | 'result';

  // Actions
  openTextToVideoModal: () => void;
  closeTextToVideoModal: () => void;
  setStep: (step: 'form' | 'production' | 'result') => void;
  createTextToVideo: (config: TextToVideoConfig) => Promise<void>;
  reset: () => void;
}

export const useTextToVideoModalStore = create<TextToVideoModalState>((set, get) => ({
  // Initial state
  isTextToVideoModalOpen: false,
  activeStep: 'form',

  openTextToVideoModal: () => set({ isTextToVideoModalOpen: true, activeStep: 'form' }),

  closeTextToVideoModal: () => set({ isTextToVideoModalOpen: false, activeProjectId: undefined }),

  setStep: (step) => set({ activeStep: step }),

  reset: () => set({ activeStep: 'form', activeProjectId: undefined }),

  createTextToVideo: async (config) => {
    try {
      // ✅ STALE STATE FIX: Clear activeProjectId immediately to remove old data
      set({ activeStep: 'production', activeProjectId: undefined });

      // Call videoProjectsStore to create project
      // We expect createTextToVideo to Return the jobId/projectId
      const result = await useVideoProjectsStore.getState().createTextToVideo(config);

      if (result && result.success && result.projectId) {
        set({ activeProjectId: result.projectId });
        toast.success("Bắt đầu quy trình sản xuất AI...");
      } else {
        // If no ID returned, we might be using the legacy way (which we refactored)
        // but we should ensure it returns the ID.
        set({ activeStep: 'form' });
      }
    } catch (err: any) {
      toast.error("Lỗi khi khởi tạo dự án: " + err.message);
      set({ activeStep: 'form' });
    }
  },
}));


