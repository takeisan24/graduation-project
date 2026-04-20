import { useCreatePostsStore } from './posts';
import { useCreateMediaStore } from './media';
import { useCreatePublishStore } from './publish';
import { useFailedPostsStore } from '../failed/failedPageStore';
import { POST_ERRORS } from '@/lib/messages/errors';

type PublishOptions = {
  connectedAccountId?: string;
  isShorts?: boolean;
};

function getPostContext(postId: number) {
  const postsStore = useCreatePostsStore.getState();
  const mediaStore = useCreateMediaStore.getState();

  const post = postsStore.openPosts.find((p) => p.id === postId);
  if (!post) {
    throw new Error(POST_ERRORS.POST_NOT_FOUND_PUBLISH);
  }

  const content = postsStore.postContents[postId] || '';
  const media = mediaStore.getPostMedia(postId);

  return {
    post,
    content,
    media,
    onPostDelete: postsStore.handlePostDelete,
  };
}

export async function publishPostNow(postId: number, options: PublishOptions = {}) {
  const publishStore = useCreatePublishStore.getState();
  const failedStore = useFailedPostsStore.getState();
  const { post, content, media, onPostDelete } = getPostContext(postId);

  await publishStore.handlePublish(
    postId,
    post,
    content,
    media,
    {
      onPostDelete,
      onLoadFailedPosts: failedStore.loadFailedPosts,
    },
    options
  );
}

export async function schedulePostById(postId: number, date: Date, time: string, options: PublishOptions = {}) {
  const publishStore = useCreatePublishStore.getState();
  const failedStore = useFailedPostsStore.getState();
  const { post, content, media, onPostDelete } = getPostContext(postId);

  await publishStore.schedulePost(
    postId,
    post,
    content,
    media,
    date,
    time,
    {
      onPostDelete,
      onLoadFailedPosts: failedStore.loadFailedPosts,
      ...options
    }
  );
}

