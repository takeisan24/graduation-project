/**
 * Create Page - Video Generation Modal Store
 * 
 * Manages video generation modal state and actions
 */

import { create } from 'zustand';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { handleErrorWithModal } from '@/lib/utils/errorHandler';
import { GENERIC_ERRORS, MEDIA_ERRORS, VIDEO_ERRORS } from '@/lib/messages/errors';
import type { MediaFile } from '../../shared/types';

interface VideoGenModalState {
  // State
  isVideoGenModalOpen: boolean;
  isGeneratingMedia: boolean;

  // Actions
  setIsVideoGenModalOpen: (isOpen: boolean) => void;
  generateVideo: (
    prompt: string,
    negativePrompt: string,
    aspectRatio: string,
    resolution: string,
    selectedPostId: number,
    onAddMedia: (postId: number, media: MediaFile[]) => void
  ) => Promise<void>;
}

export const useVideoGenModalStore = create<VideoGenModalState>((set, get) => ({
  // Initial state
  isVideoGenModalOpen: false,
  isGeneratingMedia: false,

  setIsVideoGenModalOpen: (isOpen) => set({ isVideoGenModalOpen: isOpen }),

  generateVideo: async (prompt, negativePrompt, aspectRatio, resolution, selectedPostId, onAddMedia) => {
    if (!prompt.trim() || !selectedPostId) return;

    // Show loading toast immediately
    const loadingToastId = toast.loading("Đang gửi yêu cầu tạo video đến AI...");

    // Modal đã được đóng trong component trước khi gọi function này
    set({ isGeneratingMedia: true });

    
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch('/api/ai/generate-video', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(accessToken ? { 'authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ prompt, negativePrompt, aspectRatio, resolution }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: GENERIC_ERRORS.REQUEST_FAILED(response.status) }));
        // Extract actual error message (may be nested JSON)
        let errorMessage = errorData.details || errorData.error || GENERIC_ERRORS.REQUEST_FAILED(response.status);
        try {
          const parsed = typeof errorMessage === 'string' ? JSON.parse(errorMessage) : errorMessage;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch { /* not JSON */ }

        // For AI provider errors (Google/OpenAI/Fal), throw directly (catch block will show specific toast)
        const isProviderApiError = typeof errorMessage === 'string' && (
          errorMessage.includes('quá tải') || errorMessage.includes('đang bận') ||
          errorMessage.includes('vượt giới hạn')
        );
        if (isProviderApiError) {
          throw new Error(errorMessage);
        }

        await handleErrorWithModal(errorData, errorMessage);
        throw new Error(errorMessage);
      }

      toast.loading("AI đang tạo video. Việc này có thể mất vài phút...", { id: loadingToastId });

      // Check if response is JSON (new API format) or Blob (old format)
      const contentType = response.headers.get('content-type');
      let videoBlob: Blob;
      let apiData: any = null;
      
      if (contentType?.includes('application/json')) {
        // New API format: JSON with videoUrl/blob/jobId wrapped in { success, data }
        const raw = await response.json();
        apiData = (raw && typeof raw === 'object' && 'data' in raw) ? (raw as any).data : raw;
        
        if (apiData?.jobId) {
          // Async job - show notification
          toast.success(`Video đang được tạo. Bạn sẽ được thông báo khi hoàn thành.`, { id: loadingToastId });
          set({ isGeneratingMedia: false });
          return;
        }
        
        if (apiData?.videoUrl) {
          // Video URL from storage - fetch it
          const videoResponse = await fetch(apiData.videoUrl);
          if (!videoResponse.ok) {
            throw new Error(MEDIA_ERRORS.VIDEO_LOAD_FAILED);
          }
          videoBlob = await videoResponse.blob();
        } else if (apiData?.blob) {
          // Base64 blob - convert to Blob
          try {
            const base64Data = apiData.blob;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            videoBlob = new Blob([byteArray], { type: apiData.mimeType || 'video/mp4' });
          } catch (base64Error) {
            console.error("Failed to convert base64 to blob:", base64Error);
            throw new Error(MEDIA_ERRORS.VIDEO_PROCESS_FAILED);
          }
        } else {
          throw new Error(VIDEO_ERRORS.NO_VIDEO_DATA_RETURNED);
        }
      } else {
        // Old format: Direct blob response
        videoBlob = await response.blob();
      }
      
      if (!videoBlob || videoBlob.size === 0) {
        throw new Error(VIDEO_ERRORS.EMPTY_VIDEO_FILE);
      }

      const file = new File([videoBlob], `veo3-video-${Date.now()}.mp4`, { type: 'video/mp4' });
      const preview = URL.createObjectURL(videoBlob);
      
      const newMediaFile: MediaFile = {
        id: `veo3-video-${Date.now()}`,
        type: 'video',
        preview,
        file,
        postId: selectedPostId
      };

      // Add media to post via callback
      onAddMedia(selectedPostId, [newMediaFile]);
      
      toast.success(`Video đã được tạo và thêm vào bài viết!`, { id: loadingToastId, duration: 5000 });

    } catch (error: any) {
      console.error("Lỗi khi tạo video:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Show specific toast for AI provider errors (Google/OpenAI/Fal)
      const isProviderApiError = errorMsg.includes('quá tải') || errorMsg.includes('đang bận')
        || errorMsg.includes('vượt giới hạn');

      if (isProviderApiError) {
        // Show the provider-specific error message directly (already localized from backend)
        toast.error(errorMsg, { id: loadingToastId, duration: 8000 });
      } else {
        await handleErrorWithModal(error, errorMsg);
        if (loadingToastId) {
          toast.dismiss(loadingToastId);
        }
      }
    } finally {
      set({ isGeneratingMedia: false });
    }
  },
}));

