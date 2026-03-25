/**
 * Store Reset Utility
 * 
 * Clears all Zustand stores and localStorage on logout
 * Ensures no residual user data remains after sign out
 */

import { clearLocalStorage } from './storage';
import {
  useConnectionsStore,
  useCalendarStore,
  useNavigationStore,
  usePublishedPostsStore,
  useFailedPostsStore,
  useDraftsStore,
  useCreatePostsStore,
  useCreateMediaStore,
  useCreateChatStore,
  useCreateSourcesStore,
  useCreateLightboxStore,
  useImageGenModalStore,
  useVideoGenModalStore,
  usePublishModalStore,
  useApiDashboardPageStore,
  useSettingsPageStore,
} from '@/store';

/**
 * Reset all Zustand stores to initial state
 * Called on logout to ensure clean state
 */
export function resetAllStores() {
  try {
    // Reset Connections Store
    useConnectionsStore.setState({
      connectedAccounts: [],
      connectedAccountsLoading: false,
      connectedAccountsError: null,
    });
    
    // Reset Calendar Store - use handleClearCalendarEvents if available
    const calendarStore = useCalendarStore.getState();
    if (calendarStore.handleClearCalendarEvents) {
      calendarStore.handleClearCalendarEvents();
    } else {
      // Fallback: reset state directly
      useCalendarStore.setState({ calendarEvents: {} });
    }
    
    // Reset Navigation Store
    useNavigationStore.setState({
      activeSection: 'create',
      wizardStep: 'idle',
      isSidebarOpen: false,
      language: 'vi',
    });
    
    // Reset Published Posts Store
    usePublishedPostsStore.setState({
      publishedPosts: [],
      hasLoadedPublishedPosts: false,
      isLoadingPublishedPosts: false,
      publishedPostsOffset: 0,
      publishedPostsHasMore: true,
      isLoadingMorePublishedPosts: false,
    });
    
    // Reset Failed Posts Store
    useFailedPostsStore.setState({
      failedPosts: [],
      hasLoadedFailedPosts: false,
      isLoadingFailedPosts: false,
      failedPostsOffset: 0,
      failedPostsHasMore: true,
      isLoadingMoreFailedPosts: false,
    });
    
    // Reset Drafts Store
    useDraftsStore.setState({
      draftPosts: [],
      isSavingDraft: false,
    });
    
    // Reset Create Posts Store
    useCreatePostsStore.setState({
      openPosts: [],
      selectedPostId: 0,
      postContents: {},
      postToEventMap: {},
    });
    
    // Reset Create Media Store
    useCreateMediaStore.setState({
      uploadedMedia: [],
      postMedia: {},
      currentMediaIndex: 0,
    });
    
    // Reset Create Chat Store - use clearChat if available
    const createChatStore = useCreateChatStore.getState();
    if (createChatStore.clearChat) {
      createChatStore.clearChat();
    } else {
      // Fallback: reset state directly
      useCreateChatStore.setState({
        chatMessages: [],
        isTyping: false,
      });
    }
    
    // Reset Create Sources Store
    useCreateSourcesStore.setState({
      savedSources: [],
      isSourceModalOpen: false,
      isCreateFromSourceModalOpen: false,
      sourceToGenerate: null,
    });
    
    // Reset Create Lightbox Store
    const createLightboxStore = useCreateLightboxStore.getState();
    if (createLightboxStore.closeLightbox) {
      createLightboxStore.closeLightbox();
    } else {
      useCreateLightboxStore.setState({
        lightboxMedia: { url: null, type: null },
      });
    }
    
    // Reset Image Gen Modal Store
    useImageGenModalStore.setState({
      isImageGenModalOpen: false,
      isGeneratingMedia: false,
    });
    
    // Reset Video Gen Modal Store
    useVideoGenModalStore.setState({
      isVideoGenModalOpen: false,
      isGeneratingMedia: false,
    });
    
    // Reset Publish Modal Store
    usePublishModalStore.setState({
      isPublishModalOpen: false,
    });
    
    // Reset API Dashboard Store
    useApiDashboardPageStore.setState({
      apiStats: {
        apiCalls: 0,
        successRate: 0,
        rateLimit: { used: 0, total: 0, resetTime: "0h 0m" }
      },
      apiKeys: [],
    });
    
    // Reset Settings Page Store
    useSettingsPageStore.setState({
      connectedAccounts: [],
    });
    
  } catch (error) {
    console.error('[storeReset] Error resetting stores:', error);
  }
}

/**
 * Clear all user data: stores + localStorage
 * Called on logout
 */
export function clearAllUserData() {
  try {
    // Reset all Zustand stores first
    resetAllStores();
    
    // Clear localStorage
    clearLocalStorage();
    
    // Clear any pending intervals/timeouts
    if (typeof window !== 'undefined') {
      // Clear pending scheduled posts watcher interval
      const pendingIntervalId = (window as any).__pendingScheduledPostsIntervalId;
      if (pendingIntervalId) {
        clearInterval(pendingIntervalId);
        (window as any).__pendingScheduledPostsIntervalId = null;
      }
      
      // Clear any other global intervals/timeouts
      // Note: We can't clear all intervals, but we clear the ones we know about
    }
    
  } catch (error) {
    console.error('[storeReset] Error clearing user data:', error);
  }
}

