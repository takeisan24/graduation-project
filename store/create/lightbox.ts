/**
 * Create Page - Lightbox Store
 * 
 * Manages lightbox for media preview
 */

import { create } from 'zustand';

interface CreateLightboxState {
  // State
  lightboxMedia: { url: string | null; type: 'image' | 'video' | null };

  // Actions
  openLightbox: (url: string, type: 'image' | 'video') => void;
  closeLightbox: () => void;
}

export const useCreateLightboxStore = create<CreateLightboxState>((set) => ({
  // Initial state
  lightboxMedia: { url: null, type: null },

  openLightbox: (url, type) => set({ lightboxMedia: { url, type } }),

  closeLightbox: () => set({ lightboxMedia: { url: null, type: null } }),
}));

