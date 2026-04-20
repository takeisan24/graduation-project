import type { ConnectedAccount, DraftPost, FailedPost, PublishedPost } from "@/store/shared/types";

export type PreviewAuthProvider = "email" | "google" | "facebook";

export type PreviewUserProfile = {
  name: string;
  avatarUrl: string;
  email: string;
  linkedProviders: PreviewAuthProvider[];
};

function hoursAgo(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

function minutesAgo(minutes: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

function datePart(iso: string) {
  return iso.split("T")[0] || iso;
}

function timePart(iso: string) {
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match?.[1] || "09:00";
}

export function isCreatePreviewEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function getCreatePreviewCopy(locale: string) {
  const isVi = locale.toLowerCase().startsWith("vi");

  return {
    badge: isVi ? "Dữ liệu demo" : "Demo preview",
    emptyDescription: isVi
      ? "Đang hiển thị dữ liệu mô phỏng để bạn xem nhanh bố cục khi section chưa có dữ liệu thật."
      : "Showing mock data so you can review the layout before real content arrives.",
    readOnly: isVi ? "Chế độ xem trước chỉ đọc" : "Read-only preview",
  };
}

export function getPreviewDraftPosts(): DraftPost[] {
  return [
    {
      id: "draft-demo-1",
      platform: "TikTok",
      content: "Hook 3 giây đầu cho video review công cụ AI dành cho creator, mở bằng câu hỏi trực diện rồi chuyển sang demo workflow.",
      time: hoursAgo(3),
      status: "draft",
      source: "local",
    },
    {
      id: "draft-demo-2",
      platform: "Instagram",
      content: "Carousel 5 slide: pain point, insight, before/after workflow, checklist hành động và CTA lưu bài viết.",
      time: hoursAgo(14),
      status: "draft",
      source: "local",
    },
    {
      id: "draft-demo-3",
      platform: "LinkedIn",
      content: "Bài post dạng thought leadership về cách chuẩn hóa pipeline nội dung cho team nhỏ, nhấn vào metric và tính lặp lại.",
      time: hoursAgo(27),
      status: "draft",
      source: "local",
    },
  ];
}

export function getPreviewPublishedPosts(): PublishedPost[] {
  return [
    {
      id: 9101,
      platform: "YouTube",
      content: "Video short tổng hợp 3 workflow giúp giảm thời gian biến ý tưởng thành lịch đăng thực tế.",
      time: hoursAgo(6),
      status: "posted",
      url: "https://example.com/demo/youtube-short",
    },
    {
      id: 9102,
      platform: "Facebook",
      content: "Case study ngắn về việc tái sử dụng một nguồn nội dung cho nhiều nền tảng nhưng vẫn giữ được ngữ cảnh bản địa.",
      time: hoursAgo(30),
      status: "posted",
      url: "https://example.com/demo/facebook-post",
    },
    {
      id: 9103,
      platform: "Threads",
      content: "Thread tóm tắt khung vận hành content pipeline theo tuần, tập trung vào tốc độ phản hồi và độ ổn định.",
      time: hoursAgo(52),
      status: "posted",
      url: "https://example.com/demo/threads-post",
    },
  ];
}

export function getPreviewFailedPosts(): FailedPost[] {
  const firstFailedAt = hoursAgo(5);
  const secondFailedAt = hoursAgo(19);

  return [
    {
      id: "failed-demo-1",
      platform: "Instagram",
      content: "Reel giới thiệu bộ template chiến lược nội dung nhưng media đang dùng sai tỉ lệ khung hình cho luồng publish.",
      date: datePart(firstFailedAt),
      time: timePart(firstFailedAt),
      scheduledAt: firstFailedAt,
      errorMessage: "Media ratio does not meet platform requirements.",
      lateJobId: "late-job-demo-1",
      media: [],
    },
    {
      id: "failed-demo-2",
      platform: "TikTok",
      content: "Video demo tính năng planner cần reschedule vì token kết nối đã hết hạn trong lúc dispatch.",
      date: datePart(secondFailedAt),
      time: timePart(secondFailedAt),
      scheduledAt: secondFailedAt,
      errorMessage: "Authentication token expired during publish.",
      lateJobId: "late-job-demo-2",
      media: [],
    },
  ];
}

export function getPreviewConnectedAccounts(): ConnectedAccount[] {
  return [
    {
      id: "conn-demo-1",
      platform: "instagram",
      profile_name: "utc.creatorlab",
      profile_metadata: {
        username: "utc.creatorlab",
      },
      created_at: minutesAgo(90),
    },
    {
      id: "conn-demo-2",
      platform: "youtube",
      profile_name: "UTC CreatorHub",
      profile_metadata: {
        username: "UTC CreatorHub",
      },
      created_at: hoursAgo(8),
    },
    {
      id: "conn-demo-3",
      platform: "linkedin",
      profile_name: "creatorhub-team",
      profile_metadata: {
        username: "creatorhub-team",
      },
      created_at: hoursAgo(28),
    },
  ];
}

export function createPreviewConnectedAccount(platformName: string): ConnectedAccount {
  const normalized = platformName.toLowerCase();
  const profiles: Record<string, { profile_name: string; username: string }> = {
    instagram: { profile_name: "utc.creatorlab", username: "utc.creatorlab" },
    youtube: { profile_name: "UTC CreatorHub", username: "UTC CreatorHub" },
    linkedin: { profile_name: "creatorhub-team", username: "creatorhub-team" },
    tiktok: { profile_name: "utc.creatorlab", username: "utc.creatorlab" },
    facebook: { profile_name: "UTC Creator Lab", username: "UTC Creator Lab" },
    twitter: { profile_name: "utc_creatorlab", username: "utc_creatorlab" },
    threads: { profile_name: "utc.creatorlab", username: "utc.creatorlab" },
    pinterest: { profile_name: "utc-creatorlab", username: "utc-creatorlab" },
  };

  const fallback = profiles[normalized] || {
    profile_name: `${platformName} demo`,
    username: `${normalized}.demo`,
  };

  return {
    id: `conn-demo-${normalized}-${Date.now()}`,
    platform: normalized,
    profile_name: fallback.profile_name,
    profile_metadata: {
      username: fallback.username,
    },
    created_at: new Date().toISOString(),
  };
}

export function getPreviewUserProfile(): PreviewUserProfile {
  return {
    name: "UTC Creator",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    email: "creator@utcstudio.demo",
    linkedProviders: ["email", "google"],
  };
}
