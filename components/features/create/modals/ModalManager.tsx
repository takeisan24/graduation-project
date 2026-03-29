"use client";

import dynamic from "next/dynamic";
import { useCreateSourcesStore, usePublishModalStore, useImageGenModalStore, useVideoGenModalStore, useMediaLibraryModalStore, useCreateLightboxStore } from "@/store";
import { useShallow } from 'zustand/react/shallow';

// Lazy load modals — only loaded when opened
const PublishModal = dynamic(() => import('./PublishModal'));
const ImageGenModal = dynamic(() => import('./ImageGenModal'));
const VideoGenModal = dynamic(() => import('./VideoGenModal'));
const MediaLibrarySelectorModal = dynamic(() => import('./MediaLibrarySelectorModal'));
const LightboxModal = dynamic(() => import('./LightboxModal'));

export default function ModalManager() {
  const isPublishModalOpen = usePublishModalStore(state => state.isPublishModalOpen);
  const isImageGenModalOpen = useImageGenModalStore(state => state.isImageGenModalOpen);
  const isVideoGenModalOpen = useVideoGenModalStore(state => state.isVideoGenModalOpen);
  const isMediaLibraryModalOpen = useMediaLibraryModalStore(state => state.isMediaLibraryModalOpen);
  const lightboxUrl = useCreateLightboxStore(state => state.lightboxMedia.url);

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
