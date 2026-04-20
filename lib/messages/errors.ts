/**
 * Shared Error Messages
 * 
 * Centralized error messages used across the application.
 * This ensures consistency and makes it easy to update messages in one place.
 */

/**
 * Plan-related error messages
 */
export const PLAN_ERRORS = {
  /**
   * Error message when Free plan user tries to use video generation feature
   */
  FREE_PLAN_NO_VIDEO_GENERATION: "Tài khoản Free không có chức năng tạo video, hãy nâng cấp lên plan cao hơn",

  /**
   * Error message when unable to check user plan information
   */
  UNABLE_TO_CHECK_PLAN: "Không thể kiểm tra thông tin plan của bạn. Vui lòng thử lại sau.",
} as const;

/**
 * Credit-related error messages
 */
export const CREDIT_ERRORS = {
  /**
   * Error message when user doesn't have enough credits for video generation
   * @param creditsRequired - Number of credits required
   * @param creditsRemaining - Number of credits remaining
   */
  INSUFFICIENT_CREDITS_VIDEO: (creditsRequired: number, creditsRemaining: number) =>
    `Bạn không đủ credits để tạo video. Cần ${creditsRequired} credits nhưng chỉ còn ${creditsRemaining} credits. Nâng cấp gói plan của bạn để tiếp tục sử dụng tính năng AI.`,

  /**
   * Error message when user doesn't have enough credits for Video Factory cut
   * @param creditsRequired - Number of credits required
   * @param creditsRemaining - Number of credits remaining
   */
  INSUFFICIENT_CREDITS_VIDEO_FACTORY_CUT: (creditsRequired: number, creditsRemaining: number) =>
    `Bạn không đủ credits để cắt video thành các clips. Cần ${creditsRequired} credits nhưng chỉ còn ${creditsRemaining} credits. Cần thêm credit để thực hiện chức năng này.`,

  /**
   * Error message when user doesn't have enough credits for Video Factory postprocess
   * @param creditsRequired - Number of credits required
   * @param creditsRemaining - Number of credits remaining
   */
  INSUFFICIENT_CREDITS_VIDEO_FACTORY_POSTPROCESS: (creditsRequired: number, creditsRemaining: number) =>
    `Bạn không đủ credits để thực hiện hậu kỳ video. Cần ${creditsRequired} credits nhưng chỉ còn ${creditsRemaining} credits. Cần thêm credit để thực hiện chức năng này.`,

  /**
   * Error message when user doesn't have enough credits for image generation
   * @param count - Number of images
   * @param creditsRequired - Number of credits required
   * @param creditsRemaining - Number of credits remaining
   */
  INSUFFICIENT_CREDITS_IMAGE: (count: number, creditsRequired: number, creditsRemaining: number) =>
    `Bạn không đủ credits để tạo ${count} ảnh. Cần ${creditsRequired} credits nhưng chỉ còn ${creditsRemaining} credits. Nâng cấp gói plan của bạn để tiếp tục sử dụng tính năng AI.`,

  /**
   * Error message when user doesn't have enough credits for chat AI
   * @param creditsRequired - Number of credits required per message
   */
  INSUFFICIENT_CREDITS_CHAT: (creditsRequired: number) =>
    `Bạn không còn credits để sử dụng tính năng chat AI. Cần ${creditsRequired} credit cho mỗi tin nhắn (sau 10 tin nhắn miễn phí). Nâng cấp gói plan của bạn để tiếp tục sử dụng.`,

  /**
   * Error message when user doesn't have enough credits for content generation
   * @param totalPosts - Total number of posts to generate
   * @param creditsRequired - Number of credits required
   * @param creditsRemaining - Number of credits remaining
   */
  INSUFFICIENT_CREDITS_CONTENT: (totalPosts: number, creditsRequired: number, creditsRemaining: number) =>
    `Bạn không đủ credits để tạo ${totalPosts} bài viết từ nguồn. Cần ${creditsRequired} credits (${totalPosts} bài × 1 credit/bài) nhưng chỉ còn ${creditsRemaining} credits. Nâng cấp gói plan của bạn để tiếp tục sử dụng tính năng AI.`,

  /**
   * Generic error message for insufficient credits (backend)
   * @param creditAction - Type of credit action (e.g., "WITH_VIDEO", "WITH_IMAGE")
   */
  INSUFFICIENT_CREDITS_GENERIC: (creditAction: string) => {
    if (creditAction === "WITH_VIDEO") {
      return "Không đủ credits để tạo video. Hãy mua thêm hoặc nâng cấp plan.";
    }
    if (creditAction === "WITH_IMAGE") {
      return "Không đủ credits để tạo ảnh. Hãy mua thêm hoặc nâng cấp plan.";
    }
    if (creditAction === "VIDEO_FACTORY_START") {
      return "Không đủ credits để cắt video thành các clips (cần 5 credits).";
    }
    if (creditAction === "VIDEO_FACTORY_POSTPROCESS") {
      return "Không đủ credits để thực hiện hậu kỳ video (cần 10 credits).";
    }
    return "Không đủ credits. Hãy mua thêm hoặc nâng cấp plan.";
  },
} as const;

/**
 * Limit-related error messages
 */
export const LIMIT_ERRORS = {
  /**
   * Error message when user has reached maximum connected social media accounts
   * @param current - Current number of connected accounts
   * @param limit - Maximum allowed accounts
   */
  PROFILE_LIMIT_REACHED: (current: number, limit: number) =>
    `Bạn đã kết nối tối đa tài khoản mxh (${current}/${limit} tài khoản). Ngắt kết nối 1 tài khoản không sử dụng hoặc nâng cấp gói plan của bạn.`,

  /**
   * Error message when user has reached maximum monthly posts
   * @param current - Current number of posts this month
   * @param limit - Maximum allowed posts
   */
  POST_LIMIT_REACHED: (current: number, limit: number) =>
    `Bạn đã đăng tối đa số bài post trong tháng (${current}/${limit} bài). Nâng cấp gói plan của bạn để tiếp tục đăng bài.`,
} as const;

/**
 * Authentication-related error messages
 */
export const AUTH_ERRORS = {
  /**
   * Error message when user needs to login to perform an action
   * @param action - The action that requires login (e.g., "đăng bài", "xóa bài đăng", "lên lịch đăng")
   */
  LOGIN_REQUIRED: (action: string = "thực hiện thao tác này") =>
    `Bạn cần đăng nhập để ${action}.`,

  /**
   * Error message when user needs to login to publish a post
   */
  LOGIN_REQUIRED_PUBLISH: "Bạn cần đăng nhập để đăng bài.",

  /**
   * Error message when user needs to login to schedule a post
   */
  LOGIN_REQUIRED_SCHEDULE: "Bạn cần đăng nhập để lên lịch bài đăng.",

  /**
   * Error message when user needs to login to reschedule a post
   */
  LOGIN_REQUIRED_RESCHEDULE: "Bạn cần đăng nhập để lên lịch lại bài đăng.",

  /**
   * Error message when user needs to login to delete a post
   */
  LOGIN_REQUIRED_DELETE: "Bạn cần đăng nhập để xóa bài đăng.",

  /**
   * Error message when user needs to login to update schedule
   */
  LOGIN_REQUIRED_UPDATE_SCHEDULE: "Bạn cần đăng nhập để cập nhật lịch đăng.",
} as const;

/**
 * Connection-related error messages
 */
export const CONNECTION_ERRORS = {
  /**
   * Error message when platform account is not connected
   * @param platform - Platform name (e.g., "Facebook", "Instagram")
   */
  ACCOUNT_NOT_CONNECTED: (platform: string) =>
    `Chưa kết nối tài khoản ${platform}. Vui lòng kết nối tài khoản trước khi đăng bài.`,
} as const;

/**
 * Post-related error messages
 */
export const POST_ERRORS = {
  /**
   * Error message when trying to publish an empty post
   */
  CANNOT_PUBLISH_EMPTY: "Không thể đăng một bài viết rỗng.",

  /**
   * Error message when trying to schedule an empty post
   */
  CANNOT_SCHEDULE_EMPTY: "Không thể lên lịch một bài viết rỗng.",

  /**
   * Error message when post is not found
   * @param action - The action being performed (e.g., "nhân bản", "thử lại", "xóa")
   */
  POST_NOT_FOUND: (action: string = "thực hiện") =>
    `Không tìm thấy bài đăng để ${action}.`,

  /**
   * Error message when failed post is not found to retry
   */
  FAILED_POST_NOT_FOUND_RETRY: "Không tìm thấy bài viết thất bại để thử lại.",

  /**
   * Error message when post is not found to delete
   */
  POST_NOT_FOUND_DELETE: "Không tìm thấy bài viết để xóa.",

  /**
   * Error message when publishing fails
   * @param errorMessage - Detailed error message
   */
  PUBLISH_FAILED: (errorMessage: string) =>
    `Lỗi khi đăng bài: ${errorMessage}`,

  /**
   * Error message when Facebook post mixes videos and images
   */
  FACEBOOK_MIXED_MEDIA: "Facebook posts cannot mix videos and images. Please use either all images or all videos.",

  /**
   * Error message when failed post doesn't have Late.dev job
   */
  NO_LATE_JOB_ID: "Bài đăng này không có Late.dev job. Vui lòng mở trong trình soạn thảo để đăng lại.",

  /**
   * Error message when post is not found to publish
   */
  POST_NOT_FOUND_PUBLISH: "Không tìm thấy bài đăng để xuất bản.",

  /**
   * Error message when no connected accounts found for scheduling
   */
  NO_CONNECTED_ACCOUNTS: "Không tìm thấy tài khoản đã kết nối. Vui lòng kết nối tài khoản trước khi lên lịch bài đăng.",

  /**
   * Error message when no account found for platform
   * @param platform - Platform name
   */
  NO_ACCOUNT_FOR_PLATFORM: (platform: string) =>
    `Không tìm thấy tài khoản cho nền tảng ${platform}.`,

  /**
   * Error message when post publish/schedule fails with platform and time details
   * @param platform - Platform name
   * @param timeDetail - Detailed time string (e.g., "14:30 ngày 25/12/2024" or "14:30 hôm nay")
   */
  PUBLISH_FAILED_WITH_DETAILS: (platform: string, timeDetail: string) =>
    `Đăng bài thất bại lên ${platform} lúc ${timeDetail}`,
} as const;

/**
 * Calendar-related error messages
 */
export const CALENDAR_ERRORS = {
  /**
   * Error message when trying to add or move event to past date
   */
  PAST_DATE_ERROR: "Không thể thêm hoặc di chuyển sự kiện vào ngày đã qua.",

  /**
   * Error message when trying to add or move event to past time
   */
  PAST_TIME_ERROR: "Không thể thêm hoặc di chuyển sự kiện vào thời gian đã qua.",

  /**
   * Error message when trying to schedule to past time
   */
  PAST_SCHEDULE_ERROR: "Không thể lên lịch vào một thời điểm trong quá khứ.",

  /**
   * Error message when date and time are invalid
   */
  INVALID_DATETIME: "Vui lòng chọn ngày và giờ hợp lệ.",

  /**
   * Error message when drag and drop operation fails
   */
  DROP_FAILED: "Thao tác kéo thả thất bại.",

  /**
   * Error message when unable to delete calendar event
   * @param errorMessage - Detailed error message
   */
  DELETE_FAILED: (errorMessage: string = "Lỗi không xác định") =>
    `Không thể xóa bài đăng: ${errorMessage}`,

  /**
   * Error message when unable to update schedule
   * @param errorMessage - Detailed error message
   */
  UPDATE_SCHEDULE_FAILED: (errorMessage: string = "Lỗi không xác định") =>
    `Không thể cập nhật lịch đăng: ${errorMessage}`,
} as const;

/**
 * Media-related error messages
 */
export const MEDIA_ERRORS = {
  /**
   * Error message when media upload fails
   * @param errorMessage - Detailed error message
   */
  UPLOAD_FAILED: (errorMessage: string = "Lỗi không xác định") =>
    `Không thể upload media: ${errorMessage}`,

  /**
   * Error message when unable to load video from URL
   */
  VIDEO_LOAD_FAILED: "Không thể tải video từ URL.",

  /**
   * Error message when unable to process video data
   */
  VIDEO_PROCESS_FAILED: "Không thể xử lý video data.",

  /**
   * Error message when Gemini 3 Pro image generation fails (no fallback)
   */
  GEMINI_3_PRO_FAILED: "Gemini 3 Pro không thể tạo ảnh lúc này. Vui lòng thử lại sau hoặc điều chỉnh mô tả ảnh.",

  /**
   * Error message when unable to process image from URL
   */
  IMAGE_PROCESS_FAILED: "Không thể xử lý hình ảnh từ URL.",

  /**
   * Error message when API doesn't return any images
   */
  NO_IMAGES_RETURNED: "API đã xử lý thành công nhưng không trả về hình ảnh nào.",

  /**
   * Error message when unable to process image data from API
   */
  IMAGE_DATA_PROCESS_FAILED: "Không thể xử lý dữ liệu hình ảnh nhận được từ API.",

  /**
   * Error message when invalid video file is selected
   */
  INVALID_VIDEO_FILE: "Vui lòng chọn file video hợp lệ (MP4, MOV...).",

  /**
   * Error message when post must be selected before adding media
   */
  SELECT_POST_FIRST: "Vui lòng chọn bài viết trước khi thêm media.",

  /**
   * Error message when Google AI model is temporarily overloaded (500/503)
   */
  MODEL_OVERLOADED: "Hệ thống AI (Google) đang quá tải tạm thời. Vui lòng thử lại sau 1-2 phút. Bạn không bị trừ credit.",

  /**
   * Error message when Google AI model returns rate limit (429)
   */
  MODEL_RATE_LIMITED: "Hệ thống AI (Google) đang bận. Vui lòng thử lại sau ít giây. Bạn không bị trừ credit.",

  /**
   * Error message when OpenAI API is overloaded or rate limited
   */
  OPENAI_OVERLOADED: "Hệ thống AI (OpenAI) đang quá tải tạm thời. Vui lòng thử lại sau 1-2 phút. Bạn không bị trừ credit.",
  OPENAI_RATE_LIMITED: "Hệ thống AI (OpenAI) đang bận do vượt giới hạn request. Vui lòng thử lại sau ít giây. Bạn không bị trừ credit.",

  /**
   * Error message when Fal.ai API is overloaded or rate limited
   */
  FAL_OVERLOADED: "Hệ thống AI (Fal.ai) đang quá tải tạm thời. Vui lòng thử lại sau 1-2 phút. Bạn không bị trừ credit.",
  FAL_RATE_LIMITED: "Hệ thống AI (Fal.ai) đang bận. Vui lòng thử lại sau ít giây. Bạn không bị trừ credit.",
} as const;

/**
 * Source-related error messages
 */
export const SOURCE_ERRORS = {
  /**
   * Error message when adding source fails
   * @param errorMessage - Detailed error message
   */
  ADD_SOURCE_FAILED: (errorMessage: string) =>
    `Thêm nguồn thất bại: ${errorMessage}`,

  /**
   * Error message when generating content from source fails
   * @param errorMessage - Detailed error message
   */
  GENERATE_FROM_SOURCE_FAILED: (errorMessage: string) =>
    `Tạo nội dung thất bại: ${errorMessage}`,

  /**
   * Error message when generating posts from source fails
   * @param errorMessage - Detailed error message
   */
  GENERATE_POSTS_FROM_SOURCE_FAILED: (errorMessage: string) =>
    `Tạo bài viết từ nguồn thất bại: ${errorMessage}`,

  /**
   * Error message when AI response doesn't contain valid JSON block
   */
  AI_RESPONSE_NO_JSON: "Phản hồi của AI không chứa khối JSON hợp lệ.",

  /**
   * Error message when AI response JSON is not an array
   */
  AI_RESPONSE_NOT_ARRAY: "Dữ liệu JSON trả về không phải mảng.",

  /**
   * Error message when URL is required for source
   */
  URL_REQUIRED: "Vui lòng nhập URL.",

  /**
   * Error message when text is required for source
   */
  TEXT_REQUIRED: "Vui lòng nhập văn bản.",

  /**
   * Error message when source data is required
   */
  SOURCE_DATA_REQUIRED: "Vui lòng cung cấp dữ liệu cho nguồn đã chọn.",
} as const;

/**
 * Draft-related error messages
 */
export const DRAFT_ERRORS = {
  /**
   * Error message when trying to save an empty draft
   */
  CANNOT_SAVE_EMPTY: "Không thể lưu bản nháp rỗng.",

  /**
   * Error message when saving draft fails
   * @param errorMessage - Detailed error message
   */
  SAVE_FAILED: (errorMessage: string) =>
    `Lưu bản nháp thất bại: ${errorMessage}`,

  /**
   * Error message when deleting draft fails
   * @param errorMessage - Detailed error message
   */
  DELETE_FAILED: (errorMessage: string) =>
    `Xóa bản nháp thất bại: ${errorMessage}`,

  /**
   * Error message when draft is not found to delete
   */
  DRAFT_NOT_FOUND_DELETE: "Không tìm thấy bản nháp để xóa.",
} as const;

/**
 * Video-related error messages
 */
export const VIDEO_ERRORS = {
  /**
   * Error message when video generation fails
   * @param errorMessage - Detailed error message
   */
  GENERATION_FAILED: (errorMessage: string) =>
    `Tạo video thất bại: ${errorMessage}`,

  /**
   * Error message when video factory cannot complete
   */
  FACTORY_COMPLETE_FAILED: "Không thể hoàn tất Video Factory. Vui lòng thử lại.",

  /**
   * Error message when prompt is required for video generation
   */
  PROMPT_REQUIRED: "Vui lòng nhập mô tả video",

  /**
   * Error message when YouTube URL is required
   */
  YOUTUBE_URL_REQUIRED: "Vui lòng nhập URL YouTube",

  /**
   * Error message when YouTube URL is invalid
   */
  YOUTUBE_URL_INVALID: "URL YouTube không hợp lệ",

  /**
   * Error message when unable to fetch YouTube video info
   */
  YOUTUBE_FETCH_FAILED: "Không thể lấy thông tin video",

  /**
   * Error message when YouTube validation fails
   */
  YOUTUBE_VALIDATION_ERROR: "Lỗi khi kiểm tra video YouTube",

  /**
   * Error message when file is invalid
   */
  INVALID_FILE: "File không hợp lệ",

  /**
   * Error message when YouTube URL must be validated first
   */
  VALIDATE_YOUTUBE_FIRST: "Vui lòng kiểm tra URL YouTube trước",

  /**
   * Error message when video file must be uploaded first
   */
  UPLOAD_FILE_FIRST: "Vui lòng tải lên file video trước",

  /**
   * Error message when at least one segment must be selected
   */
  SELECT_AT_LEAST_ONE_SEGMENT: "Vui lòng chọn ít nhất một đoạn",

  /**
   * Error message when API doesn't return video data
   */
  NO_VIDEO_DATA_RETURNED: "API không trả về video data.",

  /**
   * Error message when API returns empty video file
   */
  EMPTY_VIDEO_FILE: "API đã trả về một file video rỗng.",

  /**
   * Error message when postprocess fails
   * @param errorMessage - Detailed error message from backend
   */
  POSTPROCESS_FAILED: (errorMessage: string) =>
    `Hậu kỳ thất bại: ${errorMessage}. Vui lòng thử lại.`,

  /**
   * Error message when clip cutting fails
   * @param errorMessage - Detailed error message from backend
   */
  CUT_FAILED: (errorMessage: string) =>
    `Cắt clip thất bại: ${errorMessage}. Vui lòng thử lại.`,

  /**
   * Error message when postprocess is incomplete
   * @param completed - Number of clips processed successfully
   * @param total - Total number of clips
   */
  POSTPROCESS_INCOMPLETE: (completed: number, total: number) =>
    `Hậu kỳ không đầy đủ: Chỉ ${completed}/${total} clips được xử lý thành công. Vui lòng thử lại.`,

  /**
   * Error message when B-roll insertion fails for a clip
   * @param clipIndex - Index of the clip (0-based)
   */
  BROLL_INSERTION_FAILED: (clipIndex: number) =>
    `Không thể thêm B-roll vào clip ${clipIndex + 1}. Vui lòng thử lại.`,

  /**
   * Error message when caption burn fails for a clip
   * @param clipIndex - Index of the clip (0-based)
   */
  BURN_CAPTIONS_FAILED: (clipIndex: number) =>
    `Không thể thêm phụ đề vào clip ${clipIndex + 1}. Vui lòng thử lại.`,

  /**
   * Error message when MediaConvert job fails
   * @param jobType - Type of job (e.g., "B-roll", "Captions")
   */
  MEDIACONVERT_JOB_FAILED: (jobType: string) =>
    `Xử lý ${jobType} thất bại. Vui lòng thử lại.`,

  /**
   * Error message when no postprocessed clips found
   */
  NO_POSTPROCESSED_CLIPS: "Không tìm thấy clips đã hậu kỳ. Vui lòng thử lại.",

  /**
   * Error message when postprocess timeout
   */
  POSTPROCESS_TIMEOUT: "Hậu kỳ quá lâu. Vui lòng thử lại hoặc liên hệ hỗ trợ.",
} as const;

/**
 * Generic error messages
 */
export const GENERIC_ERRORS = {
  /**
   * Default error message for unknown errors
   */
  UNKNOWN_ERROR: "Đã xảy ra lỗi",

  /**
   * Error message for unknown error with details
   */
  UNKNOWN_ERROR_WITH_DETAILS: "Đã xảy ra lỗi không xác định.",

  /**
   * Error message when request fails with status code
   * @param statusCode - HTTP status code
   */
  REQUEST_FAILED: (statusCode: number) =>
    `Yêu cầu thất bại với mã lỗi ${statusCode}`,

  /**
   * Error message when delete operation fails
   * @param errorMessage - Detailed error message
   */
  DELETE_FAILED: (_errorMessage: string = "Lỗi không xác định") =>
    `Đã xảy ra lỗi khi xóa bài đăng.`,

  /**
   * Error message when account selection is required
   */
  ACCOUNT_SELECTION_REQUIRED: "Vui lòng chọn tài khoản để đăng bài.",

  /**
   * Error message when video project is not found
   */
  VIDEO_PROJECT_NOT_FOUND: "Không tìm thấy dự án video.",

  /**
   * Error message when video project is not found to delete
   */
  VIDEO_PROJECT_NOT_FOUND_DELETE: "Không tìm thấy dự án video để xóa.",

  /**
   * Error message when plan update fails
   * @param errorText - Detailed error text
   */
  PLAN_UPDATE_FAILED: (errorText?: string) =>
    `Failed to update plan${errorText ? `: ${errorText}` : ''}`,

  /**
   * Error message when unable to update plan
   * @param errorMessage - Detailed error message
   */
  UNABLE_TO_UPDATE_PLAN: (errorMessage?: string) =>
    `Unable to update plan${errorMessage ? `: ${errorMessage}` : ''}`,

  /**
   * Error message when admin API key is required
   */
  ADMIN_API_KEY_REQUIRED: "Please enter Admin API Key",

  /**
   * Error message when admin job fails
   * @param jobName - Name of the admin job
   * @param errorMessage - Detailed error message
   */
  ADMIN_JOB_FAILED: (jobName: string, errorMessage: string) =>
    `${jobName} failed: ${errorMessage}`,

  /**
   * Error message when OAuth redirect URL is missing from backend
   */
  OAUTH_URL_MISSING: "Missing OAuth redirect URL from backend",
} as const;
