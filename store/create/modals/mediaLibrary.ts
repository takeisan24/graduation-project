import { create } from 'zustand';

interface MediaLibraryModalState {
    isMediaLibraryModalOpen: boolean;
    setIsMediaLibraryModalOpen: (open: boolean) => void;
}

export const useMediaLibraryModalStore = create<MediaLibraryModalState>((set) => ({
    isMediaLibraryModalOpen: false,
    setIsMediaLibraryModalOpen: (open) => set({ isMediaLibraryModalOpen: open }),
}));
