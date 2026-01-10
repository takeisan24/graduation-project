/**
 * Shared Types
 * 
 * All TypeScript interfaces and types used across multiple stores
 */

import type {
  TextToVideoConfig,
  VideoFactoryState,
  VideoFactoryStep,
  VideoSourceConfig,
  VideoCutConfig,
  PostProductionConfig,
  VideoFactoryClipDTO,
  PostProcessHistoryGroupDTO
} from '@/lib/types/video';
import { CalendarEventType } from '@/lib/types/calendar';
import { Framework } from '@/lib/constants/content-strategy';

/**
 * Post lifecycle status from Late.dev
 */
export type LateLifecycleStatus = 'scheduled' | 'publishing' | 'posted' | 'failed';

/**
 * Wizard step for create page
 */
export type WizardStep = 'idle' | 'addingSource' | 'configuringPosts';

/**
 * Source to generate posts from
 */
export type SourceToGenerate = { type: string; value: string; label: string } | null;

/**
 * Post interface (for create page)
 */
export interface Post {
  id: number;
  type: string;
  content?: string;
  /** Instagram post type: 'regular' (default), 'stories', or 'reels' (auto-detected) */
  instagramPostType?: 'regular' | 'stories' | 'reels';
  /** Facebook post type: 'regular' (default), 'story', 'reel', etc. */
  facebookPostType?: 'regular' | 'story' | 'reel' | string;
  versions?: string[];
  currentVersionIndex?: number;
}

/**
 * Draft post interface
 */
export interface DraftPost {
  id: number;
  platform: string;
  platformIcon?: string;
  content: string;
  time: string;
  status: string;
  media?: string[];
}

/**
 * Published post interface
 */
export interface PublishedPost {
  id: number;
  platform: string;
  content: string;
  time: string;
  status: string;
  url: string;
  profileName?: string;
  profilePic?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
}

/**
 * Failed post interface
 */
export interface FailedPost {
  id: string;
  platform: string;
  content: string;
  date: string;
  time: string;
  error?: string;
  errorMessage?: string | null;
  profileName?: string;
  profilePic?: string;
  url?: string;
  platformIcon?: string;
  scheduledAt?: string | null;
  lateJobId?: string | null;
  getlateAccountId?: string | null;
  /** Danh sách URL media (ảnh/video) gắn với bài đăng thất bại, dùng để reopen trong editor */
  media?: string[];
}

/**
 * Video project interface
 */
export interface VideoProject {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  createdAt: string;
  status: 'processing' | 'completed' | 'failed';
  type?: 'factory' | 'text-to-video' | 'manual';
  textToVideoConfig?: TextToVideoConfig;
  originalFile?: File;
  options?: {
    language: string;
    multiSpeaker: boolean;
    translate: boolean;
  };
  jobId?: string; // ✅ LEGACY: Cut job ID (for backward compatibility)
  projectId?: string; // ✅ PROJECT-CENTRIC: Backend project ID (preferred)
  progress?: number; // 0-100
  progressMessage?: string;
  videoUrl?: string;

  // ✅ NEW: Post-production outputs (Unified with AI Video)
  final_video_url?: string;
  final_video_s3_key?: string;
  final_thumbnail_url?: string;
}

/**
 * Media file interface
 */
export interface MediaFile {
  id: string;
  type: 'image' | 'video';
  preview: string;
  file?: File; // ✅ Optional for library-sourced assets
  postId?: number;
  assetId?: string; // ✅ Optional: ID of the asset in Media Library
}

/**
 * Media Asset from backend library
 */
export interface MediaAsset {
  id: string;
  asset_type: string;
  source_type?: string;
  job_id?: string | null;
  public_url: string;
  thumbnail_url?: string | null;
  duration?: number | null;
  metadata?: any;
  created_at?: string;
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SourceMetadata {
  framework: Framework; // Lưu nguyên object framework để restore
  goalId: string;
  nicheId: string;
  userIdea: string;     // Text content gốc chưa bị mix
  attachment?: {
    type: 'youtube' | 'tiktok' | 'article' | 'file' | 'text';
    url?: string;
    fileName?: string; // Nếu là file
  };
}

/**
 * Saved source interface
 */
export interface SavedSource {
  id: string;
  type: string;
  value: string;
  label: string;
  metadata?: SourceMetadata;
}

/**
 * Connected account interface
 */
export interface ConnectedAccount {
  id: string;
  platform: string | null;
  profile_name?: string | null;
  late_profile_id?: string | null;
  social_media_account_id?: string | null;
  profile_metadata?: Record<string, any> | null;
  [key: string]: any;
}

/**
 * Pending scheduled post (stored in localStorage)
 */
export interface PendingScheduledPost {
  postId: string;
  lateJobId: string | null;
  scheduledAt: string;
  platform: string;
  content: string;
  lastKnownStatus?: LateLifecycleStatus;
}

/**
 * API stats interface (for settings page)
 */
export interface ApiStats {
  apiCalls: number;
  successRate: number;
  rateLimit: {
    used: number;
    total: number;
    resetTime: string;
  };
}

/**
 * API key interface (for settings page)
 */
export interface ApiKey {
  id: string;
  name: string;
  type: 'production' | 'development';
  lastUsed: string;
  isActive: boolean;
}

/**
 * Re-export video types for convenience
 */
export type {
  TextToVideoConfig,
  VideoFactoryState,
  VideoFactoryStep,
  VideoSourceConfig,
  VideoCutConfig,
  PostProductionConfig,
  VideoFactoryClipDTO,
  PostProcessHistoryGroupDTO
};

