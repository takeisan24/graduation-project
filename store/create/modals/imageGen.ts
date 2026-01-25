/**
 * Create Page - Image Generation Modal Store
 *
 * Manages image generation modal state and actions.
 * Includes auto-retry on failure and frontend timeout protection.
 */

import { create } from 'zustand';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useCreditsStore } from '../../shared/credits';
import { useLimitExceededModalStore } from '../../shared/limitExceededModal';
import { CREDIT_COSTS } from '@/lib/usage';
import { handleErrorWithModal } from '@/lib/utils/errorHandler';
import { CREDIT_ERRORS, GENERIC_ERRORS, MEDIA_ERRORS } from '@/lib/messages/errors';
import { MODEL_IDS } from '@/lib/ai/providers/index';
import type { MediaFile } from '../../shared/types';

/** Maximum frontend timeout (90s — covers Manager's 3 attempts with backoff) */
const FETCH_TIMEOUT_MS = 90_000;

interface ImageGenModalState {
  // State
  isImageGenModalOpen: boolean;
  isGeneratingMedia: boolean;
  source: 'sidebar' | 'content' | null;
  sidebarImages: MediaFile[];

  // Actions
  setIsImageGenModalOpen: (isOpen: boolean, source?: 'sidebar' | 'content') => void;
  addGeneratedImage: (media: MediaFile) => void;
  clearSidebarImages: () => void;
  generateImage: (
    prompt: string,
    count: number,
    size: string,
    aspectRatio: string,
    selectedPostId: number,
    onAddMedia: (postId: number, media: MediaFile[]) => void,
    source: 'sidebar' | 'content',
    useSearch?: boolean,
    imageSize?: "1K" | "2K" | "4K"
  ) => Promise<void>;
}

/**
 * Call the generate-image API with timeout protection.
 * Returns the parsed response data or throws on failure.
 */
async function callGenerateImageAPI(
  params: {
    prompt: string;
    count: number;
    size: string;
    aspectRatio: string;
    useSearch: boolean;
    imageSize: string;
  },
  accessToken: string | undefined
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/ai/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'authorization': `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        prompt: params.prompt,
        n: params.count,
        size: params.size,
        aspectRatio: params.aspectRatio,
        modelId: MODEL_IDS.GEMINI_3_PRO_IMAGE,
        useSearch: params.useSearch,
        imageSize: params.imageSize,
      }),
      signal: controller.signal,
    });

    const raw = await response.json();
    const data = (raw && typeof raw === 'object' && 'data' in raw) ? (raw as any).data : raw;

    if (!response.ok) {
      // Extract the actual error message (may be nested JSON from backend)
      let errorMessage = data.details || data.error || GENERIC_ERRORS.REQUEST_FAILED(response.status);
      try {
        const parsed = typeof errorMessage === 'string' ? JSON.parse(errorMessage) : errorMessage;
        errorMessage = parsed.message || parsed.error || errorMessage;
      } catch { /* not JSON, use as-is */ }

      // Attach status info for the caller to decide whether to retry
      const err = new Error(errorMessage) as Error & { statusCode?: number; responseData?: any };
      err.statusCode = response.status;
      err.responseData = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}


export const useImageGenModalStore = create<ImageGenModalState>((set, get) => ({
  // Initial state
  isImageGenModalOpen: false,
  isGeneratingMedia: false,
  source: null,
  sidebarImages: [],

  setIsImageGenModalOpen: (isOpen, source = 'content') => set({ isImageGenModalOpen: isOpen, source: isOpen ? source : null }),

  addGeneratedImage: (media) => set((state) => ({
    sidebarImages: [media, ...state.sidebarImages],
  })),

  clearSidebarImages: () => set({ sidebarImages: [] }),

  generateImage: async (prompt, count, size, aspectRatio, selectedPostId, onAddMedia, source, useSearch = false, imageSize = "1K") => {
    if (!prompt.trim()) return;

    const costPerImage = CREDIT_COSTS.WITH_IMAGE;
    const creditsRequired = costPerImage * count;

    // Show loading toast with credit cost info
    const loadingToastId = toast.loading(`Đang tạo ${count} ảnh (${creditsRequired} credits)...`);

    // FE Validation: Check credits before generating
    const creditsStore = useCreditsStore.getState();
    await creditsStore.refreshCredits(true);
    const creditsRemaining = useCreditsStore.getState().creditsRemaining;

    if (creditsRemaining < creditsRequired) {
      const errorMessage = CREDIT_ERRORS.INSUFFICIENT_CREDITS_IMAGE(count, creditsRequired, creditsRemaining);
      useLimitExceededModalStore.getState().openModal('insufficient_credits', errorMessage, {
        profileUsage: useCreditsStore.getState().profileLimits,
        postUsage: useCreditsStore.getState().postLimits,
        creditsRemaining: creditsRemaining,
        currentPlan: useCreditsStore.getState().currentPlan,
      });
      toast.error(errorMessage, { id: loadingToastId });
      return;
    }

    // Modal đã được đóng trong component trước khi gọi function này
    set({ isGeneratingMedia: true });

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;

      const apiParams = { prompt, count, size, aspectRatio, useSearch, imageSize };

      // Single call — retry is handled server-side by Manager (key rotation + backoff).
      // No frontend retry to avoid triple-retry explosion.
      const data = await callGenerateImageAPI(apiParams, accessToken);

      // --- Process successful response ---
      let imagesToProcess: Array<{ base64: string; mimeType: string }> = [];

      if (data?.images && data.images.length > 0) {
        imagesToProcess = data.images;
      } else if (data?.imageUrl) {
        try {
          const imageResponse = await fetch(data.imageUrl);
          const imageBlob = await imageResponse.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
          const base64 = await base64Promise;
          imagesToProcess = [{ base64, mimeType: imageBlob.type || 'image/png' }];
        } catch (urlError) {
          console.error("Failed to convert imageUrl to base64:", urlError);
          throw new Error(MEDIA_ERRORS.IMAGE_PROCESS_FAILED);
        }
      } else if (data?.jobId) {
        toast.success("Yêu cầu tạo ảnh đã được nhận. Ảnh sẽ sẵn sàng sau ít phút.", { id: loadingToastId });
        set({ isGeneratingMedia: false });
        return;
      } else {
        throw new Error("API đã xử lý thành công nhưng không trả về hình ảnh nào.");
      }

      const newMediaFiles: MediaFile[] = imagesToProcess.reduce<MediaFile[]>((acc, image: { base64: string; mimeType: string }, index: number) => {
        try {
          const byteCharacters = atob(image.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: image.mimeType });
          const file = new File([blob], `creatorhub-ai-${Date.now()}-${index}.png`, { type: image.mimeType });
          const preview = URL.createObjectURL(blob);
          acc.push({
            id: `ai-img-${Date.now()}-${index}`,
            type: 'image' as const,
            preview,
            file,
            postId: selectedPostId || 0
          });
        } catch (e) {
          console.error("Lỗi khi xử lý dữ liệu base64 cho một ảnh:", e);
        }
        return acc;
      }, []);

      if (newMediaFiles.length > 0) {
        set((state) => ({
          sidebarImages: [...newMediaFiles, ...state.sidebarImages]
        }));

        if (source === 'content' && selectedPostId && selectedPostId > 0) {
          onAddMedia(selectedPostId, newMediaFiles);
        } else {
          onAddMedia(0, newMediaFiles);
        }

        // Update credits from API response
        if (data?.creditsRemaining !== undefined) {
          useCreditsStore.getState().updateCredits(data.creditsRemaining);
        }

        toast.success(`Đã tạo thành công ${newMediaFiles.length} ảnh!`, { id: loadingToastId });
      } else {
        throw new Error(MEDIA_ERRORS.IMAGE_DATA_PROCESS_FAILED);
      }

    } catch (error: any) {
      console.error("Lỗi trong quá trình tạo ảnh:", error);

      // Handle frontend timeout/abort specifically
      const isAborted = error.name === 'AbortError' || error.name === 'TimeoutError';
      const errorMsg = error instanceof Error ? error.message : String(error);

      let displayMessage = isAborted
        ? 'Tạo ảnh bị timeout. Hệ thống AI đang phản hồi chậm. Bạn không bị trừ credit. Vui lòng thử lại.'
        : errorMsg;
      let isCreditError = false;

      if (!isAborted) {
        try {
          const parsed = JSON.parse(errorMsg);
          displayMessage = parsed.message || parsed.error || parsed.details || errorMsg;
          isCreditError = !!parsed.upgradeRequired || !!parsed.creditsRequired;
        } catch { /* not JSON, use as-is */ }
      }

      const isProviderApiError = displayMessage.includes('quá tải') || displayMessage.includes('đang bận')
        || displayMessage.includes('vượt giới hạn');

      if (isAborted || isProviderApiError) {
        toast.error(displayMessage, { id: loadingToastId, duration: 10000 });
      } else if (isCreditError) {
        await handleErrorWithModal(error, displayMessage);
        toast.dismiss(loadingToastId);
      } else {
        toast.error(`Tạo ảnh thất bại. Bạn không bị trừ credit. Vui lòng thử lại.`, { id: loadingToastId, duration: 8000 });
      }

      // Refresh credits after error to ensure UI shows correct balance
      try {
        await useCreditsStore.getState().refreshCredits(true);
      } catch { /* ignore refresh error */ }
    } finally {
      set({ isGeneratingMedia: false });
    }
  },
}));
