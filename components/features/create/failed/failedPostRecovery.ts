import type { FailedPost } from "@/store/shared/types"

export type FailedRecoveryCategory =
  | "account_connection"
  | "permission"
  | "account_mapping"
  | "media_requirements"
  | "content_length"
  | "policy"
  | "rate_limit"
  | "temporary_network"
  | "schedule"
  | "duplicate"
  | "unknown"

export interface FailedRecoveryPresentation {
  category: FailedRecoveryCategory
  severity: "high" | "medium" | "low"
  title: string
  summary: string
  guidance: string
  recommendedAction: "edit" | "reconnect" | "retry" | "reschedule" | "review"
}

function isVietnamese(locale?: string) {
  return (locale || "").toLowerCase().startsWith("vi")
}

function getPlatformCharacterLimit(platform: string) {
  const key = (platform || "").toLowerCase()
  const limits: Record<string, number> = {
    x: 280,
    twitter: 280,
    facebook: 2200,
    instagram: 2200,
    linkedin: 3000,
    threads: 500,
    tiktok: 2200,
    youtube: 5000,
    pinterest: 500,
  }
  return limits[key] ?? 2200
}

export function getFailedRecoveryPresentation(post: FailedPost, locale?: string): FailedRecoveryPresentation {
  const vi = isVietnamese(locale)
  const message = `${post.errorMessage || ""} ${post.error || ""}`.toLowerCase()
  const contentLength = (post.content || "").length
  const limit = getPlatformCharacterLimit(post.platform)

  if (
    message.includes("token expired") ||
    message.includes("authentication") ||
    message.includes("unauthorized") ||
    message.includes("reconnect") ||
    message.includes("disconnected") ||
    message.includes("session expired")
  ) {
    return {
      category: "account_connection",
      severity: "high",
      title: vi ? "Tài khoản cần kết nối lại" : "Reconnect required",
      summary: vi
        ? "Phiên đăng nhập hoặc liên kết tài khoản đã hết hiệu lực."
        : "The linked account or auth session is no longer valid.",
      guidance: vi
        ? "Ưu tiên kiểm tra kết nối nền tảng, sau đó mở lại bài để chỉnh sửa hoặc đăng lại."
        : "Check the platform connection first, then reopen the post to edit or republish.",
      recommendedAction: "reconnect",
    }
  }

  if (
    message.includes("permission") ||
    message.includes("access denied") ||
    message.includes("scope")
  ) {
    return {
      category: "permission",
      severity: "high",
      title: vi ? "Thiếu quyền đăng bài" : "Missing publishing permission",
      summary: vi
        ? "Tài khoản hiện tại chưa có đủ quyền cho thao tác publish này."
        : "The connected account does not have enough permission for this publish action.",
      guidance: vi
        ? "Cần kiểm tra lại quyền ứng dụng hoặc chọn tài khoản đăng phù hợp hơn."
        : "Review the app scopes or choose a more suitable connected account.",
      recommendedAction: "reconnect",
    }
  }

  if (
    message.includes("profile id") ||
    message.includes("account mismatch") ||
    message.includes("mismatch") ||
    message.includes("thông tin tài khoản")
  ) {
    return {
      category: "account_mapping",
      severity: "high",
      title: vi ? "Sai tài khoản đích" : "Account mapping mismatch",
      summary: vi
        ? "Bài đăng đang tham chiếu tới hồ sơ đích không còn hợp lệ hoặc không khớp."
        : "This post points to a destination profile that is no longer valid or does not match.",
      guidance: vi
        ? "Hãy kiểm tra lại tài khoản kết nối và mở bài để cập nhật luồng publish."
        : "Review the connected account and reopen the post to update the publish target.",
      recommendedAction: "edit",
    }
  }

  if (
    contentLength > limit ||
    message.includes("character") ||
    message.includes("caption too long") ||
    message.includes("limit")
  ) {
    return {
      category: "content_length",
      severity: "medium",
      title: vi ? "Nội dung vượt giới hạn" : "Content exceeds limit",
      summary: vi
        ? `Bài hiện dài khoảng ${contentLength} ký tự, vượt giới hạn đề xuất cho ${post.platform}.`
        : `This post is about ${contentLength} characters and exceeds the recommended limit for ${post.platform}.`,
      guidance: vi
        ? `Rút gọn nội dung xuống khoảng ${limit} ký tự hoặc chia ý thành phiên bản ngắn hơn.`
        : `Shorten the copy to around ${limit} characters or split the idea into a shorter variant.`,
      recommendedAction: "edit",
    }
  }

  if (
    message.includes("media ratio") ||
    message.includes("aspect ratio") ||
    message.includes("resolution") ||
    message.includes("file type") ||
    message.includes("media") ||
    message.includes("thumbnail")
  ) {
    return {
      category: "media_requirements",
      severity: "medium",
      title: vi ? "Media chưa đúng chuẩn" : "Media requirements not met",
      summary: vi
        ? "Tệp ảnh hoặc video chưa phù hợp với yêu cầu định dạng của nền tảng."
        : "The attached image or video does not match the platform's formatting requirements.",
      guidance: vi
        ? "Mở bài để thay media hoặc chỉnh lại tỷ lệ khung hình, kích thước và định dạng."
        : "Open the post to replace media or adjust aspect ratio, size, and format.",
      recommendedAction: "edit",
    }
  }

  if (
    message.includes("policy") ||
    message.includes("violation") ||
    message.includes("moderation") ||
    message.includes("rejected")
  ) {
    return {
      category: "policy",
      severity: "high",
      title: vi ? "Nội dung bị chặn bởi chính sách" : "Blocked by platform policy",
      summary: vi
        ? "Nội dung hoặc media đang vi phạm quy tắc kiểm duyệt của nền tảng."
        : "The content or media violates the platform's moderation rules.",
      guidance: vi
        ? "Cần chỉnh lại thông điệp, từ ngữ nhạy cảm hoặc media trước khi thử đăng lại."
        : "Revise the copy, sensitive wording, or media before trying again.",
      recommendedAction: "edit",
    }
  }

  if (
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("429")
  ) {
    return {
      category: "rate_limit",
      severity: "medium",
      title: vi ? "Nền tảng đang giới hạn tần suất" : "Rate limit reached",
      summary: vi
        ? "Nền tảng đang tạm hạn chế số lần publish hoặc retry trong khoảng thời gian ngắn."
        : "The platform is temporarily limiting publish or retry attempts.",
      guidance: vi
        ? "Nên chờ thêm một khoảng ngắn rồi lên lịch lại thay vì retry liên tục."
        : "Wait a bit and reschedule instead of retrying repeatedly.",
      recommendedAction: "reschedule",
    }
  }

  if (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("temporarily unavailable")
  ) {
    return {
      category: "temporary_network",
      severity: "low",
      title: vi ? "Lỗi kết nối tạm thời" : "Temporary connectivity issue",
      summary: vi
        ? "Đây có vẻ là lỗi mạng hoặc timeout trong lúc gửi bài."
        : "This appears to be a transient network or timeout issue during dispatch.",
      guidance: vi
        ? "Có thể thử lại hoặc dời lịch đăng sang một mốc khác."
        : "You can retry later or move the post to another schedule slot.",
      recommendedAction: "retry",
    }
  }

  if (
    message.includes("past") ||
    message.includes("schedule") ||
    message.includes("datetime") ||
    message.includes("invalid date")
  ) {
    return {
      category: "schedule",
      severity: "medium",
      title: vi ? "Mốc thời gian chưa hợp lệ" : "Invalid scheduling state",
      summary: vi
        ? "Thời điểm đăng hiện tại không còn phù hợp hoặc không hợp lệ cho luồng publish."
        : "The current publishing time is no longer valid for the dispatch flow.",
      guidance: vi
        ? "Ưu tiên chọn lại thời gian đăng rồi theo dõi trạng thái sau đó."
        : "Choose a new publish time and monitor the status afterward.",
      recommendedAction: "reschedule",
    }
  }

  if (
    message.includes("already") ||
    message.includes("duplicate")
  ) {
    return {
      category: "duplicate",
      severity: "low",
      title: vi ? "Có dấu hiệu đăng trùng" : "Possible duplicate publish",
      summary: vi
        ? "Hệ thống hoặc nền tảng cho rằng nội dung này đã từng được gửi trước đó."
        : "The system or platform believes this content was already submitted earlier.",
      guidance: vi
        ? "Nên kiểm tra lại bài đã đăng thật trước khi retry thêm lần nữa."
        : "Check the live destination before retrying again.",
      recommendedAction: "review",
    }
  }

  return {
    category: "unknown",
    severity: "medium",
    title: vi ? "Cần kiểm tra thủ công" : "Needs manual review",
    summary: vi
      ? "Lỗi hiện tại chưa đủ rõ để tự động xác định nguyên nhân chính."
      : "The current error is not specific enough to identify the root cause automatically.",
    guidance: vi
      ? "Mở chi tiết để xem message gốc, sau đó quyết định chỉnh sửa nội dung hay lên lịch lại."
      : "Open the details to inspect the raw message, then decide whether to edit or reschedule.",
    recommendedAction: "review",
  }
}
