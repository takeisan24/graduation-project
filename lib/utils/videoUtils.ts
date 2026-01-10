/**
 * Video Utilities
 * Helper functions for video processing
 */

import { YOUTUBE_URL_REGEX, CREDITS_PER_SECOND } from '@/lib/constants/video'
import { YouTubeVideoInfo, TranscriptSegment } from '@/lib/types/video'

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_URL_REGEX)
  return match ? match[4] : null
}

/**
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url)
}

/**
 * Fetch YouTube video info (no API key) via noembed.
 * Falls back to a lightweight mock if failed.
 */
export async function fetchYouTubeInfo(url: string): Promise<YouTubeVideoInfo | null> {
  const videoId = extractYouTubeId(url)
  if (!videoId) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`Noembed status ${res.status}`)
    const data = await res.json()

    // Try to derive duration (seconds) if available
    let durationStr = ''
    const rawDuration = (data as any).duration
    if (typeof rawDuration === 'number' && rawDuration > 0) {
      durationStr = formatVideoDuration(rawDuration)
    } else if (typeof rawDuration === 'string') {
      const sec = parseInt(rawDuration, 10)
      if (!Number.isNaN(sec) && sec > 0) {
        durationStr = formatVideoDuration(sec)
      }
    }

    return {
      id: videoId,
      title: data.title || 'YouTube Video',
      thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: durationStr,
      channelTitle: data.author_name || 'YouTube Channel',
    }
  } catch (err) {
    // Fallback mock (last resort)
    return {
      id: videoId,
      title: 'YouTube Video',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: '',
      channelTitle: 'YouTube Channel',
    }
  }
}

/**
 * Generate mock transcript data
 */
export function generateMockTranscript(language: 'vi' | 'en' = 'vi'): TranscriptSegment[] {
  const viText = [
    'Xin chào các bạn, hôm nay chúng ta sẽ cùng tìm hiểu về cách tạo nội dung viral trên mạng xã hội.',
    'Đầu tiên, bạn cần phải hiểu rõ đối tượng khán giả của mình là ai.',
    'Tiếp theo, hãy tập trung vào việc tạo ra hook thu hút trong 3 giây đầu tiên.',
    'Nội dung của bạn cần phải mang lại giá trị thực sự cho người xem.',
    'Đừng quên sử dụng trending sounds và hashtags phù hợp.',
    'Tương tác với khán giả thông qua bình luận và câu hỏi.',
    'Phân tích dữ liệu để hiểu rõ hơn về những gì người xem thích.',
    'Đăng bài đều đặn để duy trì sự hiện diện của bạn.',
    'Hợp tác với những người sáng tạo khác để mở rộng tầm ảnh hưởng.',
    'Cuối cùng, hãy kiên nhẫn và không ngừng cải thiện nội dung của mình.'
  ]

  const enText = [
    'Hello everyone, today we will explore how to create viral content on social media.',
    'First, you need to clearly understand who your target audience is.',
    'Next, focus on creating an engaging hook in the first 3 seconds.',
    'Your content needs to provide real value to viewers.',
    'Don\'t forget to use trending sounds and appropriate hashtags.',
    'Engage with your audience through comments and questions.',
    'Analyze data to better understand what viewers like.',
    'Post consistently to maintain your presence.',
    'Collaborate with other creators to expand your reach.',
    'Finally, be patient and continuously improve your content.'
  ]

  const text = language === 'vi' ? viText : enText

  return text.map((t, i) => ({
    index: i,
    startTime: i * 15,
    endTime: (i + 1) * 15,
    text: t,
    speaker: i % 3 === 0 ? 'Speaker 1' : 'Speaker 2'
  }))
}

/**
 * Calculate estimated credits for text-to-video
 * New Pricing Model (Jan 2026):
 * - 8s -> 16 credits
 * - 15s (actual 16s) -> 30 credits
 * - 30s (actual 32s) -> 60 credits
 * - 60s (actual 64s) -> 120 credits
 */
export function calculateVideoCredits(durationSeconds: number): number {
  switch (durationSeconds) {
    case 8: return 16;
    case 15: return 30;
    case 30: return 60;
    case 60: return 120;
    default: return durationSeconds * 2; // Fallback
  }
}


/**
 * Split Video Factory credits into cut credits and post-production credits
 * 
 * Công thức này PHẢI khớp 100% với BE (JQM/src/core/cost/cost-estimator.ts)
 * để đảm bảo FE check credit trước khi request và BE validate lại đều dùng cùng logic.
 * 
 * @returns Object với cutCredits (chi phí cắt clips) và postProdCredits (chi phí hậu kỳ: b-roll + captions)
 */
export function splitVideoFactoryCredits(params: {
  clipCount: number;
  clipDuration: '<60s' | '60-90s' | '>90s';
  bRollInsertion: boolean;
  bRollDensity?: 'low' | 'medium' | 'high';
  autoCaptions: boolean;
}): {
  cutCredits: number;
  postProdCredits: number;
  totalCredits: number;
} {
  const { clipCount, clipDuration, bRollInsertion, bRollDensity, autoCaptions } = params;

  if (!clipCount || clipCount <= 0) {
    return { cutCredits: 0, postProdCredits: 0, totalCredits: 0 };
  }

  // ✅ RESTORED DYNAMIC PRICING MODEL - PHẢI KHỚP VỚI BE
  // Phase 1 (Cut): Scales per clip (Job creation + Cut processing)
  // Phase 2 (Postprocess): Scaling per clip (B-roll + Captions cost)

  // Multipliers based on clip duration
  const durationMultiplier = clipDuration === '<60s' ? 1.0 : clipDuration === '60-90s' ? 1.5 : 2.0;
  const cutCredits = Math.ceil(clipCount * 5 * durationMultiplier);

  // ✅ PHASE 2: Post-production credits (Per clip scaling)
  let postProdCredits = 0;

  // Cost per feature per clip
  const BROLL_COST_PER_CLIP = 5;
  const CAPTION_COST_PER_CLIP = 5;

  let creditPerClip = 0;
  if (bRollInsertion) creditPerClip += BROLL_COST_PER_CLIP;
  if (autoCaptions) creditPerClip += CAPTION_COST_PER_CLIP;

  postProdCredits = Math.ceil(creditPerClip * clipCount * durationMultiplier);

  const totalCredits = cutCredits + postProdCredits;

  return {
    cutCredits,
    postProdCredits,
    totalCredits,
  };
}

/**
 * Calculate estimated credits for Video Factory (total)
 * 
 * Wrapper function để giữ backward compatibility.
 * Sử dụng splitVideoFactoryCredits() và trả về totalCredits.
 * 
 * Công thức này PHẢI khớp 100% với BE (JQM/src/core/cost/cost-estimator.ts estimateVideoFactory)
 * để đảm bảo FE check credit trước khi request và BE validate lại đều dùng cùng logic.
 */
export function calculateVideoFactoryCredits(params: {
  clipCount: number;
  clipDuration: '<60s' | '60-90s' | '>90s';
  bRollInsertion: boolean;
  bRollDensity?: 'low' | 'medium' | 'high';
  autoCaptions: boolean;
}): number {
  return splitVideoFactoryCredits(params).totalCredits;
}

/**
 * Format video duration from seconds
 */
export function formatVideoDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Validate video file
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 3 * 1024 * 1024 * 1024; // 3GB
  const VALID_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm']

  if (!VALID_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file format. Please upload MP4, MOV, AVI, MKV, or WebM.' }
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds 3GB limit.' }
  }

  return { valid: true }
}

/**
 * Generate video thumbnail from file
 */
export function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(2, video.duration / 2) // 2 seconds or middle
    }

    video.onseeked = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
      URL.revokeObjectURL(video.src)
    }

    video.onerror = () => {
      reject(new Error('Failed to generate thumbnail'))
      URL.revokeObjectURL(video.src)
    }

    video.src = URL.createObjectURL(file)
    video.load()
  })
}

/**
 * Get video duration (seconds) from file (client-side)
 */
export function getVideoDurationFromFile(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(video.src);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Simulate video processing progress
 */
export function simulateProcessing(
  onProgress: (progress: number, message: string) => void,
  messages: string[],
  duration: number = 10000
): Promise<void> {
  return new Promise((resolve) => {
    const steps = messages.length
    const stepDuration = duration / steps
    let currentStep = 0

    const interval = setInterval(() => {
      if (currentStep >= steps) {
        clearInterval(interval)
        onProgress(100, messages[messages.length - 1])
        setTimeout(resolve, 500)
        return
      }

      const progress = Math.min(((currentStep + 1) / steps) * 100, 99)
      onProgress(progress, messages[currentStep])
      currentStep++
    }, stepDuration)
  })
}
