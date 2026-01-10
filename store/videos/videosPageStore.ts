/**
 * Videos Page - Video Projects Store
 * 
 * Manages video projects: upload, edit, delete
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage, getVideoProjectsKey, removeFromLocalStorage, getCurrentUserId } from '@/lib/utils/storage';
import { toast } from 'sonner';
import type { VideoProject } from '../shared/types';
import { useCreditsStore } from '../shared/credits';
import type { TextToVideoConfig } from '../shared/types';
import { useVideoFactoryStore } from './videoFactory';
import { VIDEO_ERRORS, GENERIC_ERRORS } from '@/lib/messages/errors';
import { supabaseClient } from '@/lib/supabaseClient';
import { handleUnauthorizedOnClient } from '@/lib/utils/authClient';

// Estimated processing time (ms) per requested video duration (s)
const ESTIMATED_GENERATION_MS: Record<number, number> = {
  8: 120_000,   // ~2 minutes for 8s
  15: 225_000,
  30: 450_000,
  60: 900_000,
};

interface VideoProjectsState {
  // State
  videoProjects: VideoProject[];

  // Actions
  handleVideoUpload: (file: File, options: { language: string; multiSpeaker: boolean; translate: boolean; }) => void;
  handleVideoEdit: (projectId: string) => void;
  handleVideoDelete: (projectId: string) => void;
  createTextToVideo: (config: TextToVideoConfig) => Promise<{ success: boolean; projectId?: string; error?: string }>;
  retryTextToVideo: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  refreshVideoProjects: () => Promise<void>;


}

export const useVideoProjectsStore = create<VideoProjectsState>((set, get) => ({
  // Initial state - load from localStorage with auto-migration
  // ✅ CRITICAL FIX: De-duplicate projects by id to avoid duplicate React keys (vf-<jobId>)
  // ✅ MIGRATION: Auto-migrate old 'videoProjects' data to '{userId}_videoProjects' on first load
  videoProjects: (() => {
    // ✅ MIGRATION STEP 1: Try to load from user-specific key first
    const userKey = getVideoProjectsKey();
    let loaded = loadFromLocalStorage<VideoProject[]>(userKey, []) as VideoProject[];

    // ✅ MIGRATION STEP 2: If no data in user-specific key, check old base key
    if (!Array.isArray(loaded) || loaded.length === 0) {
      const oldData = loadFromLocalStorage<VideoProject[]>('videoProjects', []) as VideoProject[];

      // ✅ MIGRATION STEP 3: If old data exists, migrate it
      if (Array.isArray(oldData) && oldData.length > 0) {
        console.log('[videosPageStore] Migrating videoProjects to user-specific key', {
          oldKey: 'videoProjects',
          newKey: userKey,
          projectCount: oldData.length,
          hint: 'One-time migration for existing users',
        });

        // Save to new user-specific key
        saveToLocalStorage(userKey, oldData);

        // Remove old key to prevent future confusion
        removeFromLocalStorage('videoProjects');

        // Use migrated data
        loaded = oldData;

        console.log('[videosPageStore] Migration complete', {
          newKey: userKey,
          migratedCount: oldData.length,
        });
      }
    }

    if (!Array.isArray(loaded)) return [];

    const seenIds = new Set<string>();
    const deduped: VideoProject[] = [];

    for (const proj of loaded) {
      if (!proj || !proj.id) continue;
      if (seenIds.has(proj.id)) {
        // Skip duplicated id (can happen after refactors) to avoid React key collisions
        continue;
      }
      seenIds.add(proj.id);
      deduped.push(proj);
    }

    return deduped;
  })(),

  handleVideoUpload: (file, options) => {
    const newProject: VideoProject = {
      id: `vid-${Date.now()}`,
      title: file.name,
      thumbnail: '',
      duration: '0:00',
      createdAt: new Date().toISOString(),
      status: 'processing' as const,
      options: options
    };

    set(state => {
      const updatedProjects = [...state.videoProjects, newProject];
      const projectsToSave = updatedProjects.map(({ originalFile, ...rest }) => rest);
      saveToLocalStorage(getVideoProjectsKey(), projectsToSave);
      return { videoProjects: updatedProjects };
    });

    toast.info(`Bắt đầu xử lý video: "${file.name}"...`);

    // Giả lập quá trình xử lý video...
    setTimeout(() => {
      set(state => {
        const updatedProjects = state.videoProjects.map(p =>
          p.id === newProject.id ? { ...p, status: 'completed' as const, duration: '0:32' } : p
        );
        const projectsToSave = updatedProjects.map(({ originalFile, ...rest }) => rest);
        saveToLocalStorage(getVideoProjectsKey(), projectsToSave);
        return { videoProjects: updatedProjects };
      });
      toast.success(`Đã xử lý xong video: "${newProject.title}"!`);
    }, 7000);
  },

  createTextToVideo: async (config: TextToVideoConfig) => {
    const loadingToastId = toast.loading('Đang khởi tạo dự án sản xuất video AI...');

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      const res = await fetch('/api/ai/video-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          description: config.prompt,
          negativePrompt: config.negativePrompt,
          aspectRatio: config.aspectRatio,
          duration: config.duration,
          resolution: config.resolution,
          estimatedCredits: config.estimatedCredits // ✅ NEW: Send FE-calculated credits to BE
        }),

      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        if (res.status === 401) {
          await handleUnauthorizedOnClient('createTextToVideo');
        }
        throw new Error(json?.error || 'Khởi tạo dự án thất bại');
      }

      const project = json.data?.project || json.data;
      const creditsRemaining = json.data?.creditsRemaining;

      // ✅ INSTANT UPDATE: Use updateCredits() for synchronous UI update (like Image Gen)
      if (creditsRemaining !== undefined) {
        useCreditsStore.getState().updateCredits(creditsRemaining);
      } else {
        // Fallback to async refresh if API doesn't return creditsRemaining
        await useCreditsStore.getState().refreshCredits(true);
      }

      // Update local state by refreshing from DB or adding optimistically
      await get().refreshVideoProjects();

      toast.success('Đã bắt đầu quy trình sản xuất video AI!', { id: loadingToastId });

      return { success: true, projectId: project.id };
    } catch (error) {
      console.error('[createTextToVideo] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể khởi tạo dự án.';
      toast.error(VIDEO_ERRORS.GENERATION_FAILED(errorMessage), { id: loadingToastId });
      return { success: false, error: errorMessage };
    }
  },

  retryTextToVideo: async (projectId: string) => {
    const loadingToastId = toast.loading('Đang khởi động lại quy trình sản xuất video...');

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Unauthorized');
      }

      const res = await fetch('/api/ai/video-projects/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Khởi động lại thất bại');
      }

      // ✅ CRITICAL FIX: Refresh credits immediately after retry deduction
      await useCreditsStore.getState().refreshCredits(true);

      // Update local state immediately
      await get().refreshVideoProjects();

      // ✅ Optimization: Refresh again after a short delay to catch the first SSE/Web update
      // This ensures the UI moves out of 'FAILED' state quickly
      setTimeout(() => get().refreshVideoProjects(), 1500);

      toast.success('Đã tiếp tục quy trình sản xuất video AI!', { id: loadingToastId });

      return { success: true };
    } catch (error) {
      console.error('[retryTextToVideo] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể khởi động lại dự án.';
      toast.error(errorMessage, { id: loadingToastId });
      return { success: false, error: errorMessage };
    }
  },

  refreshVideoProjects: async () => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      const res = await fetch('/api/ai/video-projects', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const aiProjects = json.data.map((p: any) => ({
          id: p.id,
          title: p.project_name || 'AI Video Project',
          thumbnail: p.final_video_url || '/text-to-video-placeholder.png',
          duration: `${p.config_data?.userInput?.duration || 0}s`,
          createdAt: p.created_at,
          status: p.status === 'DONE' ? 'completed' : p.status === 'FAILED' ? 'failed' : 'processing',
          type: 'text-to-video',
          progress: p.progress,
          videoUrl: p.final_video_url,
          // Store raw project for modal dashboard
          aiProject: p
        }));

        set(state => {
          // Merge with local projects (e.g. uploads that might not be in ai_video_projects table yet)
          // For now, let's treat ai_video_projects as the source of truth for AI projects
          const otherProjects = state.videoProjects.filter(p => p.type !== 'text-to-video');
          const updatedProjects = [...otherProjects, ...aiProjects].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          saveToLocalStorage(getVideoProjectsKey(), updatedProjects.map(({ originalFile, ...rest }: any) => rest));
          return { videoProjects: updatedProjects };
        });
      }
    } catch (error) {
      console.error('[refreshVideoProjects] Error:', error);
    }
  },


  handleVideoEdit: async (projectId) => {
    const project = get().videoProjects.find(p => p.id === projectId);
    if (!project) {
      toast.error(GENERIC_ERRORS.VIDEO_PROJECT_NOT_FOUND);
      return;
    }

    // ✅ PROJECT-CENTRIC: Nếu project là Video Factory type, mở Video Factory với projectId (preferred) hoặc jobId (legacy)
    if (project.type === 'factory') {
      const videoFactoryStore = useVideoFactoryStore.getState();

      // ✅ PROJECT-CENTRIC: Prefer projectId over jobId
      if (project.projectId) {
        // ✅ NEW: Use project endpoint to get comprehensive project details
        await videoFactoryStore.openVideoFactoryWithJob(project.projectId, true);
      } else if ((project as any).jobId) {
        // ✅ LEGACY: Fallback to jobId (backward compatibility)
        const jobId = (project as any).jobId;
        await videoFactoryStore.openVideoFactoryWithJob(jobId, false);
      } else {
        toast.error('Không tìm thấy project ID hoặc job ID cho Video Factory project này.');
        return;
      }
      return;
    }

    // ✅ AI Video Production Pipeline handling
    if (project.type === 'text-to-video') {
      const ttvStore = (await import('../create/modals/textToVideo')).useTextToVideoModalStore.getState();

      // Update TTV store with active project and move to correct step
      const isDone = project.status === 'completed';
      // ttvStore.reset(); // Removed to prevent UI flickering/reset perception

      // Set the active project and step (if already done, go to result)
      // Note: activeProjectId in TTV store uses the project.id from DB
      (await import('../create/modals/textToVideo')).useTextToVideoModalStore.setState({
        isTextToVideoModalOpen: true,
        activeProjectId: project.id,
        activeStep: isDone ? 'result' : 'production'
      });
      return;
    }

    // ✅ Fallback: Các project type khác (manual, etc.)
    console.log("Mở trình chỉnh sửa cho dự án:", project);
    toast.info(`Mở trình chỉnh sửa cho video "${project.title}".`);

    // Ví dụ: router.push(`/editor/video/${projectId}`);
  },

  handleVideoDelete: async (projectId) => {
    const projectToDelete = get().videoProjects.find(p => p.id === projectId);
    if (!projectToDelete) {
      toast.error(GENERIC_ERRORS.VIDEO_PROJECT_NOT_FOUND_DELETE);
      return;
    }

    const promise = (async () => {
      if (projectToDelete.type === 'text-to-video') {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session?.access_token;
        if (token) {
          await fetch(`/api/ai/video-projects?id=${projectId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }

      set(state => {
        const updatedProjects = state.videoProjects.filter(p => p.id !== projectId);
        saveToLocalStorage(getVideoProjectsKey(), updatedProjects.map(({ originalFile, ...rest }: any) => rest));
        return { videoProjects: updatedProjects };
      });
    })();

    toast.promise(promise, {
      loading: 'Đang xóa dự án...',
      success: `Đã xóa dự án "${projectToDelete.title}".`,
      error: 'Xóa dự án thất bại.',
    });
  },

}));

