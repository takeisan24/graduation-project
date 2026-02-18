// components/create/modals/ModalManager.tsx
"use client";

import { useCreateSourcesStore, usePublishModalStore, useImageGenModalStore, useVideoGenModalStore, useMediaLibraryModalStore, useCreateLightboxStore } from "@/store";
import { useShallow } from 'zustand/react/shallow';

// Import tất cả các modal của bạn
import PublishModal from './PublishModal';
import ImageGenModal from './ImageGenModal';
import VideoGenModal from './VideoGenModal';
import MediaLibrarySelectorModal from './MediaLibrarySelectorModal';
import LightboxModal from './LightboxModal';
export default function ModalManager() {
  // Chỉ lấy các state boolean để quyết định modal nào sẽ hiển thị
  const { isSourceModalOpen, isCreateFromSourceModalOpen } = useCreateSourcesStore(
    useShallow(state => ({
      isSourceModalOpen: state.isSourceModalOpen,
      isCreateFromSourceModalOpen: state.isCreateFromSourceModalOpen,
    }))
  );
  const isPublishModalOpen = usePublishModalStore(state => state.isPublishModalOpen);
  const isImageGenModalOpen = useImageGenModalStore(state => state.isImageGenModalOpen);
  const isVideoGenModalOpen = useVideoGenModalStore(state => state.isVideoGenModalOpen);
  const isMediaLibraryModalOpen = useMediaLibraryModalStore(state => state.isMediaLibraryModalOpen);
  const lightboxUrl = useCreateLightboxStore(state => state.lightboxMedia.url);

  // Logic render có điều kiện
  // Chỉ khi một state `isOpen` là true, modal tương ứng mới được render.
  // Điều này đảm bảo các modal không được render ẩn và gây ra các side effect.
  return (
    <>
      {lightboxUrl && <LightboxModal />}
      {isPublishModalOpen && <PublishModal />}
      {isImageGenModalOpen && <ImageGenModal />}
      {isVideoGenModalOpen && <VideoGenModal />}
      {isMediaLibraryModalOpen && <MediaLibrarySelectorModal />}
    </>
  );
}