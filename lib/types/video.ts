/**
 * Video Types
 * TypeScript interfaces for video-related features
 */

/**
 * Video project status
 */
export type VideoProjectStatus = 'processing' | 'completed' | 'failed' | 'idle'

/**
 * Video workflow step for Video Factory wizard
 */
export type VideoFactoryStep = 'input' | 'config' | 'postprod' | 'summary' | 'processing' | 'postprocess' | 'cut_completed' | 'completed'

/**
 * Video source type
 */
export type VideoSourceType = 'upload' | 'youtube'

/**
 * Video cut method
 */
export type VideoCutMethod = 'auto' | 'manual'

/**
 * Clip duration preference
 */
export type ClipDuration = '<60s' | '60-90s' | '>90s'

/**
 * Content theme filter
 */
export type ContentTheme = 'funny' | 'inspirational' | 'educational' | 'all'

/**
 * Video aspect ratio
 */
export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '4:3'

/**
 * Text-to-Video duration options
 */
export type TextToVideoDuration = 8 | 15 | 30 | 60

/**
 * B-roll density
 */
export type BRollDensity = 'low' | 'medium' | 'high'

/**
 * Video source configuration
 */
export interface VideoSourceConfig {
  type: VideoSourceType
  file?: File
  uploadUrl?: string
  youtubeUrl?: string
  youtubeThumbnail?: string
  youtubeTitle?: string
  videoDuration?: string
  media_asset_id?: string // ✅ FIX: Changed from mediaAssetId to match backend API convention (snake_case for Smart Lookup reuse)
}

/**
 * Auto cut configuration
 */
export interface AutoCutConfig {
  clipCount: number
  clipDuration: ClipDuration
  contentTheme: ContentTheme
}

/**
 * Manual cut selection (transcript-based)
 */
export interface ManualCutSelection {
  startTime: number
  endTime: number
  text: string
}

/**
 * Video cut configuration
 */
export interface VideoCutConfig {
  method: VideoCutMethod
  autoCutConfig?: AutoCutConfig
  manualSelections?: ManualCutSelection[]
}

/**
 * Post-production options
 */
export interface PostProductionConfig {
  autoCaptions: boolean
  autoCaption?: {
    language: string
    style: string
  }
  bRollInsertion: boolean
  bRollDensity?: BRollDensity
  backgroundMusic: boolean
  transitions: boolean
}

/**
 * Video Factory workflow state
 */
export interface VideoFactoryState {
  currentStep: VideoFactoryStep
  sourceConfig?: VideoSourceConfig
  cutConfig?: VideoCutConfig
  postProdConfig?: PostProductionConfig

  // ✅ DECOUPLED: Cut Step State (Isolated)
  cutProgress: number
  cutMessage: string
  cutStatus?: 'processing' | 'completed' | 'failed'
  // generatedClips matches original name but now strictly for Cut Step
  generatedClips?: GeneratedVideoClip[]
  selectedClipKeys?: string[] // ✅ INPUT: Clips selected for post-production
  expectedClipCount?: number // ✅ PRODUCTION FIX: Số lượng clips dự kiến

  // ✅ DECOUPLED: Post-Production Step State (Isolated)
  postProdProgress: number
  postProdMessage: string
  postProdStatus?: 'processing' | 'completed' | 'failed'
  // postProcessHistory matches original name but now strictly for Post-Prod Step
  postProcessHistory?: Array<{
    jobId: string;           // ID của lần chạy hậu kỳ
    createdAt: string;       // Thời gian chạy (ISO timestamp)
    status: 'processing' | 'completed' | 'failed';
    clips: Array<{           // Danh sách clip trong lần chạy này
      id: string;
      title?: string;
      name?: string;
      url?: string;
      thumbnailUrl?: string;
      duration?: number;
      startTime?: number;
      endTime?: number;
      clipStatus?: 'PROCESSING' | 'READY' | 'FAILED' | 'DONE';
      createdAt?: string;
      originalClipKey?: string;
      originalClipId?: string;
    }>;
    config?: PostProductionConfig;  // Config đã dùng
    selectedClipKeys?: string[];    // Clip keys đã chọn
    selectedCutClipIds?: string[];  // Clip UUIDs đã chọn
    errorMessage?: string;          // Error message
    errorCode?: string;             // Error code
    progress?: number;              // ✅ NEW: Progress (0-100)
    progressMessage?: string;       // ✅ NEW: Human-readable progress message
  }>;

  // ✅ TRANSITION: Keep legacy names for backward compatibility (will be removed after component migration)
  processingProgress: number
  processingMessage: string

  projectId?: string // ✅ PROJECT-CENTRIC: Project ID
  jobId?: string
  cutJobId?: string
  postProcessJobId?: string
  finalUrl?: string
  warnings?: string[]
  lastErrorMessage?: string
  // ✅ NEW: Track job creation time for polling
  jobCreatedAt?: number // Timestamp when job was created
  // ✅ NEW: Track when polling data was last updated
  pollingDataTimestamp?: number // Timestamp when polling last updated clips
  // ✅ SPLIT-SCREEN MODAL: Modal visibility flags
  isMainModalVisible?: boolean;  // Panel A - bên trái
  isResultModalVisible?: boolean; // Panel B - bên phải
  // ✅ IDEMPOTENCY: Request ID
  requestId?: string; // UUID sent with API calls
}

/**
 * Generated video clip result
 */
export interface GeneratedVideoClip {
  id: string
  thumbnail: string
  duration: string
  title: string
  startTime: number
  endTime: number
  url?: string
  thumbnailUrl?: string // ✅ NEW: Explicit thumbnailUrl for direct use
  thumbnailKey?: string
  storageKey?: string
  key?: string
  bucket?: string
  index?: number // ✅ PRODUCTION FIX: Clip index (0-based) for slot-based rendering
  status?: 'READY' | 'PROCESSING' | 'FAILED' | 'RETRYING' | 'DONE' // ✅ PRODUCTION FIX: Clip status for UI rendering
  clipStatus?: 'READY' | 'PROCESSING' | 'FAILED' | 'RETRYING' | 'DONE' // ✅ NEW: Explicit clip status to disambiguate from Project Status
  failureReason?: string // ✅ PRODUCTION FIX: Failure reason for FAILED clips
  failureMessage?: string // ✅ PRODUCTION FIX: Human-readable failure message
  retryCount?: number // ✅ PRODUCTION FIX: Number of retries attempted
  selectable?: boolean // ✅ PRODUCTION FIX: Whether clip can be selected for post-processing
  canSelect?: boolean // ✅ PRODUCTION FIX: Alias for selectable (FE compatibility)
  readyForPostprocess?: boolean // ✅ PRODUCTION FIX: Whether clip is ready for post-processing
  isPlaceholder?: boolean // ✅ OPTIMIZATION: Flag to identify optimistic placeholder clips (for instant UI feedback)

  // ✅ NEW FIELDS for Phase 4 & Physical Files
  clipId?: string // ✅ UUID provided by backend (physical file ID)
  parentCutClipId?: string // ✅ For postprocessed clips: ID of the original cut clip
  videoAssetId?: string // ✅ Asset ID for Smart Lookup
  thumbnailAssetId?: string // ✅ Asset ID for Smart Lookup
  videoUrl?: string // ✅ Explicit video URL (alias for url)
}

/**
 * Text-to-Video configuration
 */
export interface TextToVideoConfig {
  prompt: string
  duration: TextToVideoDuration
  aspectRatio: VideoAspectRatio
  resolution?: '720p' | '1080p'
  estimatedCredits: number
  negativePrompt?: string
}

/**
 * Video Project (extended from store)
 */
export interface VideoProject {
  id: string
  title: string
  thumbnail: string
  duration: string
  createdAt: string
  status: VideoProjectStatus
  type: 'factory' | 'text-to-video' | 'manual'

  // Factory-specific
  sourceConfig?: VideoSourceConfig
  cutConfig?: VideoCutConfig
  postProdConfig?: PostProductionConfig
  generatedClips?: GeneratedVideoClip[]

  // Text-to-Video specific
  textToVideoConfig?: TextToVideoConfig

  // Original fields for backward compatibility
  originalFile?: File
  options?: {
    language: string
    multiSpeaker: boolean
    translate: boolean
  }

  // ✅ NEW: Post-production outputs (Unified with AI Video)
  final_video_url?: string
  final_video_s3_key?: string
  final_thumbnail_url?: string
}

/**
 * Mock transcript data structure
 */
export interface TranscriptSegment {
  index: number
  startTime: number
  endTime: number
  text: string
  speaker?: string
}

/**
 * YouTube video info
 */
export interface YouTubeVideoInfo {
  id: string
  title: string
  thumbnail: string
  duration: string
  channelTitle: string
}
/**
 * ✅ API: Standardized Backend Clip DTO
 * Matches the JSON returned by status.handler.ts (and output repositories)
 */
export interface VideoFactoryClipDTO {
  id: string
  jobId?: string
  url?: string
  publicUrl?: string // Legacy or standardized alias from backend
  thumbnailUrl?: string
  thumbnail_url?: string // Legacy snake_case from some endpoints
  duration?: number // Backend always sends number (seconds)
  startTime?: number
  endTime?: number
  // ✅ STATUS: Explicitly aligned with Backend 'status' column
  status: 'PROCESSING' | 'READY' | 'FAILED' | 'DONE'
  createdAt?: string
  storageKey?: string
  videoS3Key?: string // Backend DB column mapping
  clipStatus?: 'PROCESSING' | 'READY' | 'FAILED' | 'DONE'
  status_clip?: 'PROCESSING' | 'READY' | 'FAILED' | 'DONE' // Legacy alias from some backend versions
  title?: string
  index?: number
  // ✅ ASSETS: Physical asset IDs (UUIDs)
  clipId?: string
  parentCutClipId?: string
  parent_cut_clip_id?: string // Legacy snake_case
  // ✅ LEGACY / ALIAS FIELDS (Used validation logic)
  thumbnailKey?: string
  thumbnail_key?: string
  videoKey?: string
  key?: string
  storage_key?: string
  video_s3_key?: string // Legacy snake_case
  bucket?: string
  // ✅ FAILURE INFO
  failureReason?: string
  failureMessage?: string
  failure_reason?: string
  failure_message?: string
  // ✅ TIMESTAMPS
  updatedAt?: string
  updated_at?: string
  // ✅ ASSET GATEWAY
  thumbnailAssetId?: string
  thumbnail_asset_id?: string
  videoAssetId?: string
  video_asset_id?: string
  // ✅ METADATA & EXTRAS
  metadata?: Record<string, any>
  videoUrl?: string // Explicit video URL (alias)
  job_id?: string // Legacy snake_case
  // ✅ EXTRA FALLBACKS
  thumbnail?: string
  start?: number
  start_time?: number
  end?: number
  end_time?: number
}

/**
 * ✅ API: Standardized Postprocess Group DTO
 * Matches the groups returned by GET /postprocessed-clips
 */
export interface PostProcessHistoryGroupDTO {
  groupId: string
  createdAt: string
  status: 'processing' | 'completed' | 'failed'
  postprodConfig?: PostProductionConfig
  selectedClipKeys?: string[]
  selectedCutClipIds?: string[]
  clips: VideoFactoryClipDTO[]
  progress?: number
  progressMessage?: string
}
/**
 * ✅ AI VIDEO PRODUCTION PIPELINE TYPES
 * Supports Text-to-Video, Image-to-Video, and Video-to-Video
 */

export type AiVideoProjectStatus = 'INIT' | 'ANALYZING' | 'PLANNING' | 'GENERATING_CHARACTER' | 'GENERATING_SCENES' | 'STITCHING' | 'DONE' | 'FAILED' | 'PROCESSING';

export interface AiVideoProjectOrchestration {
  genre: string;
  tone: string;
  style: string;
  worldProfile: string;
  forbidden: string[];
}

export interface AiVideoCharacterProfile {
  name: string;
  gender: string;
  age: number;
  visualSpec: string;
  anchorImageUrl?: string;
  anchorImageS3Key?: string;
}

export interface AiVideoSceneSegment {
  sceneId: number;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  duration: number;
  actionPrompt: string;
  cameraAngle: string;
  sourceImageUrl?: string;
  videoUrl?: string;
  videoS3Key?: string;
  thumbnailUrl?: string; // ✅ NEW: Scene specific thumbnail
  videoAssetId?: string;
  attempts: number;
  error?: string;
}

export interface AiVideoProject {
  id: string;
  user_id: string;
  project_name: string;
  project_type: 'text-to-video' | 'image-to-video' | 'video-to-video';

  status: AiVideoProjectStatus;
  progress: number;

  source_type: 'prompt' | 'image' | 'video';
  source_url?: string;
  source_media_asset_id?: string;

  config_data: {
    userInput: {
      description: string;
      negativePrompt?: string;
      duration: number;
      aspectRatio: string;
    };
    estimatedCredits?: number;
    orchestration?: AiVideoProjectOrchestration;
    characterProfile?: AiVideoCharacterProfile;
    scenes?: AiVideoSceneSegment[];
  };

  final_video_url?: string;
  final_video_s3_key?: string;
  final_thumbnail_url?: string;
  final_thumbnail_s3_key?: string; // ✅ NEW: S3 key for secure proxying
  error_details?: any;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
