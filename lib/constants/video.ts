/**
 * Video Constants
 * Configuration for video features
 */

import { ClipDuration, ContentTheme, BRollDensity, TextToVideoDuration, VideoAspectRatio } from '@/lib/types/video'

/**
 * Clip duration options with display labels
 */
export const CLIP_DURATION_OPTIONS: { value: ClipDuration; label: string; labelVi: string }[] = [
  { value: '<60s', label: 'Under 60s', labelVi: 'Dưới 60 giây' },
  { value: '60-90s', label: '60-90s', labelVi: '60-90 giây' },
  { value: '>90s', label: 'Over 90s', labelVi: 'Trên 90 giây' }
]

/**
 * Content theme filter options
 */
export const CONTENT_THEME_OPTIONS: { value: ContentTheme; label: string; labelVi: string; icon: string }[] = [
  { value: 'all', label: 'All Content', labelVi: 'Tất cả', icon: '🎬' },
  { value: 'funny', label: 'Funny', labelVi: 'Hài hước', icon: '😂' },
  { value: 'inspirational', label: 'Inspirational', labelVi: 'Truyền cảm hứng', icon: '✨' },
  { value: 'educational', label: 'Educational', labelVi: 'Kiến thức', icon: '📚' }
]

/**
 * B-roll density options
 */
export const BROLL_DENSITY_OPTIONS: { value: BRollDensity; label: string; labelVi: string }[] = [
  { value: 'low', label: 'Low', labelVi: 'Ít' },
  { value: 'medium', label: 'Medium', labelVi: 'Vừa' },
  { value: 'high', label: 'High', labelVi: 'Dày đặc' }
]

/**
 * Text-to-Video duration options
 */
export const TEXT_TO_VIDEO_DURATION_OPTIONS: { value: TextToVideoDuration; label: string }[] = [
  { value: 8, label: '8s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' }
]

/**
 * Video aspect ratio options
 */
export const VIDEO_ASPECT_RATIO_OPTIONS: { value: VideoAspectRatio; label: string; labelVi: string }[] = [
  { value: '16:9', label: 'Landscape (16:9)', labelVi: 'Ngang (16:9)' },
  { value: '9:16', label: 'Portrait (9:16)', labelVi: 'Dọc (9:16)' },
  { value: '1:1', label: 'Square (1:1)', labelVi: 'Vuông (1:1)' }
  // { value: '4:5', label: 'Portrait (4:5)', labelVi: 'Dọc (4:5)' },
  // { value: '4:3', label: 'Landscape (4:3)', labelVi: 'Ngang (4:3)' }
]

/**
 * Credit cost per second of video generation
 */
export const CREDITS_PER_SECOND = 2

/**
 * Processing stage messages for animation
 */
export const PROCESSING_MESSAGES = {
  en: [
    'Analyzing video content...',
    'Detecting key moments...',
    'Finding viral scenes...',
    'Extracting highlights...',
    'Generating captions...',
    'Inserting B-rolls...',
    'Applying transitions...',
    'Rendering video...',
    'Finalizing clips...'
  ],
  vi: [
    'Đang phân tích nội dung video...',
    'Đang phát hiện khoảnh khắc quan trọng...',
    'Đang tìm cảnh viral...',
    'Đang trích xuất điểm nổi bật...',
    'Đang tạo phụ đề...',
    'Đang chèn B-roll...',
    'Đang áp dụng hiệu ứng chuyển cảnh...',
    'Đang render video...',
    'Đang hoàn thiện clip...'
  ]
}

/**
 * YouTube URL validation regex
 */
export const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/

/**
 * Supported video file formats
 */
export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm'
]

/**
 * Max video file size (500MB)
 */
export const MAX_VIDEO_FILE_SIZE = 500 * 1024 * 1024

/**
 * Caption style presets
 */
export const CAPTION_STYLES = [
  { value: 'default', label: 'Default', labelVi: 'Mặc định' },
  { value: 'bold', label: 'Bold & Big', labelVi: 'Đậm & To' },
  { value: 'minimal', label: 'Minimal', labelVi: 'Tối giản' },
  { value: 'colorful', label: 'Colorful', labelVi: 'Nhiều màu' }
]

/**
 * Transcript languages
 */
export const TRANSCRIPT_LANGUAGES = [
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'en', label: 'Tiếng Anh', flag: '🇺🇸' },
  { value: 'ja', label: 'Tiếng Nhật', flag: '🇯🇵' },
  { value: 'ko', label: 'Tiếng Hàn', flag: '🇰🇷' },
  { value: 'zh', label: 'Tiếng Trung', flag: '🇨🇳' }
]
