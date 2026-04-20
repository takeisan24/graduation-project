/**
 * Create Page - Media Management Store
 * 
 * Manages media upload and removal for posts
 */

import { create } from 'zustand';
import { toast } from 'sonner';
import { MEDIA_ERRORS } from '@/lib/messages/errors';
import type { MediaFile } from '../shared/types';

interface CreateMediaState {
  // State
  uploadedMedia: MediaFile[]; // Legacy - giữ lại để tương thích
  postMedia: Record<number, MediaFile[]>; // Media theo postId
  currentMediaIndex: number;

  // Actions
  handleMediaUpload: (files: File[], selectedPostId: number) => void;
  handleMediaRemove: (mediaId: string, selectedPostId: number) => void;
  handleLibraryMediaSelect: (assets: any[], selectedPostId: number) => void;
  setPostMedia: (postId: number, media: MediaFile[]) => void;
  getPostMedia: (postId: number) => MediaFile[];
}

export const useCreateMediaStore = create<CreateMediaState>((set, get) => ({
  // Initial state
  uploadedMedia: [], // Legacy
  postMedia: {},
  currentMediaIndex: 0,

  handleMediaUpload: (files, selectedPostId) => {
    if (!selectedPostId) {
      toast.warning(MEDIA_ERRORS.SELECT_POST_FIRST);
      return;
    }

    const mediaFiles: MediaFile[] = files.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: file.type.startsWith('image/') ? 'image' : 'video',
      preview: URL.createObjectURL(file),
      file,
      postId: selectedPostId
    }));

    // Lưu media theo postId
    set(state => ({
      postMedia: {
        ...state.postMedia,
        [selectedPostId]: [...(state.postMedia[selectedPostId] || []), ...mediaFiles]
      },
      // Legacy - giữ lại uploadedMedia cho tương thích
      uploadedMedia: [...state.uploadedMedia, ...mediaFiles]
    }));
  },

  handleMediaRemove: (mediaId, selectedPostId) => {
    set(state => {
      // Xóa từ postMedia của post hiện tại
      const updatedPostMedia = { ...state.postMedia };
      if (selectedPostId && updatedPostMedia[selectedPostId]) {
        updatedPostMedia[selectedPostId] = updatedPostMedia[selectedPostId].filter(
          media => media.id !== mediaId
        );
      }

      return {
        postMedia: updatedPostMedia,
        // Legacy
        uploadedMedia: state.uploadedMedia.filter(media => media.id !== mediaId)
      };
    });
  },

  handleLibraryMediaSelect: (assets, selectedPostId) => {
    if (!selectedPostId) {
      toast.warning(MEDIA_ERRORS.SELECT_POST_FIRST);
      return;
    }

    const libraryMedia: MediaFile[] = assets.map(asset => ({
      id: `lib-${asset.id}`,
      type: asset.asset_type === 'video' ? 'video' : 'image',
      preview: asset.public_url, // Use public_url as preview for library assets
      assetId: asset.id,
      postId: selectedPostId
    }));

    set(state => ({
      postMedia: {
        ...state.postMedia,
        [selectedPostId]: [...(state.postMedia[selectedPostId] || []), ...libraryMedia]
      }
    }));
  },

  setPostMedia: (postId, media) => {
    set(state => ({
      postMedia: {
        ...state.postMedia,
        [postId]: media
      }
    }));
  },

  getPostMedia: (postId) => {
    return get().postMedia[postId] || [];
  },
}));

