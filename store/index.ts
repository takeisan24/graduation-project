/**
 * Root Store Index
 *
 * Root export file for all Zustand stores.
 */

import { initializePendingPostsWatcher, checkPendingPostsWithStores } from './shared/statusCheck';

import { useCreditsStore } from './shared/credits';
import { useConnectionsStore } from './shared/connections';
import { useCalendarStore } from './shared/calendar';
import { usePublishedPostsStore } from './published/publishedPageStore';
import { useFailedPostsStore } from './failed/failedPageStore';
import { useVideoProjectsStore } from './videos/videosPageStore';
import { useDraftsStore } from './drafts/draftsPageStore';
import { useSettingsPageStore } from './settings/settingsPageStore';
import { useApiDashboardPageStore } from './api-dashboard/apiDashboardPageStore';
import { useCalendarPageStore } from './calendar/calendarPageStore';
import { useNavigationStore } from './shared/navigation';
import { useCreatePostsStore } from './create/posts';
import { useCreateMediaStore } from './create/media';
import { useCreatePublishStore } from './create/publish';
import { useCreateChatStore } from './create/chat';
import { useCreateSourcesStore } from './create/sources';
import { useCreateLightboxStore } from './create/lightbox';
import { useImageGenModalStore } from './create/modals/imageGen';
import { useVideoGenModalStore } from './create/modals/videoGen';
import { useTextToVideoModalStore } from './create/modals/textToVideo';
import { useMediaLibraryModalStore } from './create/modals/mediaLibrary';
import { useVideoFactoryStore } from './videos/videoFactory';
import { usePublishModalStore } from './create/modals/publish';
import { useLimitExceededModalStore } from './shared/limitExceededModal';

export type {
  FailedPost,
  VideoProject,
  DraftPost,
  PublishedPost,
  Post,
  MediaFile,
  ChatMessage,
  SavedSource,
  SourceToGenerate,
  WizardStep,
  LateLifecycleStatus,
} from './shared/types';

if (typeof window !== 'undefined') {
  initializePendingPostsWatcher({
    onCheckPending: async () => {
      await checkPendingPostsWithStores();
    },
    onRestoreWatchers: () => {
      // handled inside statusCheck module
    },
  });
}

export {
  useCreditsStore,
  useConnectionsStore,
  useCalendarStore,
  usePublishedPostsStore,
  useFailedPostsStore,
  useVideoProjectsStore,
  useDraftsStore,
  useSettingsPageStore,
  useApiDashboardPageStore,
  useCalendarPageStore,
  useNavigationStore,
  useCreatePostsStore,
  useCreateMediaStore,
  useCreatePublishStore,
  useCreateChatStore,
  useCreateSourcesStore,
  useCreateLightboxStore,
  useImageGenModalStore,
  useVideoGenModalStore,
  useTextToVideoModalStore,
  useMediaLibraryModalStore,
  useVideoFactoryStore,
  usePublishModalStore,
  useLimitExceededModalStore,
};

