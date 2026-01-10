/**
 * Store Reset Utility
 * 
 * Clears all Zustand stores and localStorage on logout
 * Ensures no residual user data remains after sign out
 */

import { clearLocalStorage } from './storage';
import { createInitialVideoFactoryState } from '@/store/shared/utils'; // ✅ CRITICAL FIX: Import để reset về initial state thay vì null
import { 
  useCreditsStore, 
  useConnectionsStore, 
  useCalendarStore,
  useNavigationStore,
  usePublishedPostsStore,
  useFailedPostsStore,
  useDraftsStore,
  useVideoProjectsStore,
  useCreatePostsStore,
  useCreateMediaStore,
  useCreateChatStore,
  useCreateSourcesStore,
  useCreateLightboxStore,
  useImageGenModalStore,
  useVideoGenModalStore,
  useTextToVideoModalStore,
  useVideoFactoryStore,
  usePublishModalStore,
  useLimitExceededModalStore,
  useApiDashboardPageStore,
  useSettingsPageStore,
} from '@/store';

/**
 * Reset all Zustand stores to initial state
 * Called on logout to ensure clean state
 */
export function resetAllStores() {
  try {
    console.log('[storeReset] Resetting all stores...');
    
    // Reset Credits Store
    useCreditsStore.setState({
      creditsRemaining: 0,
      isLoadingCredits: false,
      currentPlan: 'free',
      profileLimits: { current: 0, limit: 0 },
      postLimits: { current: 0, limit: 0 },
      limitsFetched: false,
      limitsLastFetched: null,
      usageHistoryTrigger: false,
      usageHistoryNeedsRefresh: false,
    });
    
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
    
    // Reset Video Projects Store
    useVideoProjectsStore.setState({
      videoProjects: [],
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
    
    // Reset Text To Video Modal Store
    useTextToVideoModalStore.setState({
      isTextToVideoModalOpen: false,
    });
    
    // Reset Video Factory Store - use resetVideoFactory if available
    const videoFactoryStore = useVideoFactoryStore.getState();
    if (videoFactoryStore.resetVideoFactory) {
      videoFactoryStore.resetVideoFactory();
    } else {
      // ✅ CRITICAL FIX: Reset về initial state thay vì null để tránh lỗi "Cannot read properties of null"
      // Component sẽ thấy object rỗng với clips: [] thay vì null, tránh crash
      useVideoFactoryStore.setState({
        isVideoFactoryOpen: false,
        videoFactoryState: {
          ...createInitialVideoFactoryState(),
          jobId: undefined, // ✅ CRITICAL: undefined để SSE disconnect (compatible với type)
          cutJobId: undefined, // ✅ CRITICAL: Clear cutJobId
        },
      });
    }
    
    // Reset Publish Modal Store
    usePublishModalStore.setState({
      isPublishModalOpen: false,
    });
    
    // Reset Limit Exceeded Modal Store - use closeModal if available
    const limitModalStore = useLimitExceededModalStore.getState();
    if (limitModalStore.closeModal) {
      limitModalStore.closeModal();
    }
    
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
    
    console.log('[storeReset] All stores reset successfully');
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
    console.log('[storeReset] Clearing all user data...');
    
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
    
    console.log('[storeReset] All user data cleared successfully');
  } catch (error) {
    console.error('[storeReset] Error clearing user data:', error);
  }
}

