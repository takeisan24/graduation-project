const ZERNIO_BASE_URL = "https://zernio.com/api/v1"

// Zernio uses "twitter" for X/Twitter platform
const ZERNIO_PLATFORM_MAP: Record<string, string> = {
  x: "twitter",
}

export function toZernioPlatform(platform: string): string {
  const lower = platform.toLowerCase()
  return ZERNIO_PLATFORM_MAP[lower] || lower
}

export function isZernioConfigured(): boolean {
  return !!(process.env.ZERNIO_API_KEY && process.env.ZERNIO_PROFILE_ID)
}

async function zernioFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new Error("ZERNIO_API_KEY not configured")

  const res = await fetch(`${ZERNIO_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Zernio ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

export async function getZernioConnectUrl(platform: string, redirectUrl: string): Promise<string> {
  const profileId = process.env.ZERNIO_PROFILE_ID
  if (!profileId) throw new Error("ZERNIO_PROFILE_ID not configured")

  const zernioPlatform = toZernioPlatform(platform)
  const params = new URLSearchParams({ profileId, redirect_url: redirectUrl })
  const data = await zernioFetch<{ authUrl: string }>("GET", `/connect/${zernioPlatform}?${params}`)
  if (!data.authUrl) throw new Error("Zernio did not return authUrl")
  return data.authUrl
}

export interface ZernioAccount {
  _id: string
  platform: string
  username?: string
  displayName?: string
  profileUrl?: string
  avatarUrl?: string
  // Zernio trả ảnh đại diện / username trong metadata.profileData (đã xác minh qua GET /accounts thật)
  profilePicture?: string | null
  metadata?: {
    profileData?: {
      username?: string
      displayName?: string
      profilePicture?: string | null
      profileUrl?: string
    }
  } | null
}

/** Lấy username thật của account Zernio (ưu tiên metadata.profileData.username). */
export function getZernioAccountUsername(acc: ZernioAccount): string {
  return (
    acc.metadata?.profileData?.username ||
    acc.username ||
    acc.metadata?.profileData?.displayName ||
    acc.displayName ||
    "unknown"
  )
}

/** Lấy avatar thật của account Zernio. */
export function getZernioAccountAvatar(acc: ZernioAccount): string | null {
  return (
    acc.metadata?.profileData?.profilePicture ||
    acc.profilePicture ||
    acc.avatarUrl ||
    null
  )
}

export async function listZernioAccounts(): Promise<ZernioAccount[]> {
  const profileId = process.env.ZERNIO_PROFILE_ID || ""
  const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : ""
  const data = await zernioFetch<{ accounts: ZernioAccount[] }>("GET", `/accounts${params}`)
  return data.accounts || []
}

/**
 * Ngắt kết nối (xoá) 1 tài khoản khỏi Zernio — giải phóng slot trên gói.
 * DELETE /accounts/{accountId}. Ném lỗi nếu Zernio trả 4xx/5xx (vd 404 = đã gỡ).
 */
export async function deleteZernioAccount(accountId: string): Promise<void> {
  await zernioFetch<{ message?: string }>("DELETE", `/accounts/${encodeURIComponent(accountId)}`)
}

/**
 * Xoá 1 bài đăng (draft/scheduled) khỏi Zernio — đồng bộ với dashboard.
 * DELETE /posts/{postId}. Lưu ý: bài ĐÃ published Zernio KHÔNG cho xoá (trả 400);
 * caller nên bắt lỗi và bỏ qua (vẫn xoá khỏi DB hệ thống).
 */
export async function deleteZernioPost(postId: string): Promise<void> {
  await zernioFetch<{ message?: string }>("DELETE", `/posts/${encodeURIComponent(postId)}`)
}

/** Một platform-target bên trong một Zernio post. */
export interface ZernioPostPlatform {
  platform: string
  status?: string // published | failed
  platformPostId?: string | null
  platformPostUrl?: string | null
  errorMessage?: string | null
  accountId?: unknown
}

/** Một Zernio post (trả về từ POST /posts và GET /posts/{id}). */
export interface ZernioPost {
  _id: string
  status: string // draft | scheduled | publishing | published | failed | partial
  content?: string
  scheduledFor?: string
  publishedAt?: string | null
  platforms?: ZernioPostPlatform[]
}

/** Suy ra loại media từ đuôi URL (Zernio yêu cầu type: image|video). */
function inferMediaType(url: string): "image" | "video" {
  return /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(url) ? "video" : "image"
}

/**
 * Tạo/đăng bài qua Zernio. Body theo đúng contract:
 *   { content, platforms:[{platform, accountId}], publishNow, scheduledFor?, mediaItems:[{type,url}]? }
 */
export async function createZernioPost(params: {
  targets: Array<{ platform: string; accountId: string }>
  content: string
  publishNow?: boolean
  scheduledFor?: string
  mediaUrls?: string[]
}): Promise<ZernioPost> {
  const body: Record<string, unknown> = {
    content: params.content,
    publishNow: params.publishNow ?? false,
    platforms: params.targets.map(t => ({
      platform: toZernioPlatform(t.platform),
      accountId: t.accountId,
    })),
  }
  if (params.scheduledFor) body.scheduledFor = params.scheduledFor
  if (params.mediaUrls?.length) {
    body.mediaItems = params.mediaUrls.map(url => ({ type: inferMediaType(url), url }))
  }

  const data = await zernioFetch<{ post: ZernioPost }>("POST", "/posts", body)
  return data.post
}

/**
 * Cập nhật 1 post trên Zernio (PUT /posts/{id}) — dùng để ĐỔI LỊCH (scheduledFor) hoặc sửa nội dung.
 * Áp dụng cho bài draft/scheduled/failed/partial/cancelled (bài published không đổi được lịch).
 */
export async function updateZernioPost(
  postId: string,
  body: { scheduledFor?: string; content?: string; timezone?: string; publishNow?: boolean }
): Promise<ZernioPost> {
  const payload: Record<string, unknown> = {}
  if (body.scheduledFor !== undefined) payload.scheduledFor = body.scheduledFor
  if (body.content !== undefined) payload.content = body.content
  if (body.timezone !== undefined) payload.timezone = body.timezone
  if (body.publishNow !== undefined) payload.publishNow = body.publishNow
  const data = await zernioFetch<{ post?: ZernioPost } & ZernioPost>("PUT", `/posts/${encodeURIComponent(postId)}`, payload)
  return (data.post || data) as ZernioPost
}

/** Thử đăng lại 1 bài đã FAILED qua Zernio (POST /posts/{id}/retry). Trả về post sau retry. */
export async function retryZernioPost(postId: string): Promise<ZernioPost> {
  const data = await zernioFetch<{ post?: ZernioPost } & ZernioPost>("POST", `/posts/${encodeURIComponent(postId)}/retry`)
  return (data.post || data) as ZernioPost
}

/** Các nền tảng Zernio HỖ TRỢ gỡ bài đã đăng (unpublish). Không gồm Instagram/TikTok/Snapchat. */
export const UNPUBLISH_SUPPORTED_PLATFORMS = new Set([
  "threads", "facebook", "twitter", "linkedin", "youtube", "pinterest", "reddit", "bluesky", "googlebusiness", "telegram",
])

/** Nền tảng (theo tên nội bộ app) có gỡ bài được không. */
export function canUnpublishPlatform(platform: string): boolean {
  return UNPUBLISH_SUPPORTED_PLATFORMS.has(toZernioPlatform(platform))
}

/**
 * Gỡ 1 bài ĐÃ ĐĂNG khỏi nền tảng thật (POST /posts/{id}/unpublish).
 * Zernio giữ bản ghi nhưng đổi status='cancelled'. Không hỗ trợ Instagram/TikTok.
 */
export async function unpublishZernioPost(postId: string, platform: string): Promise<void> {
  await zernioFetch<{ success?: boolean; message?: string }>(
    "POST",
    `/posts/${encodeURIComponent(postId)}/unpublish`,
    { platform: toZernioPlatform(platform) }
  )
}

/** Lấy 1 post từ Zernio (để poll trạng thái + URL thật). */
export async function getZernioPost(postId: string): Promise<ZernioPost> {
  const data = await zernioFetch<{ post?: ZernioPost } & ZernioPost>("GET", `/posts/${postId}`)
  // Một số response bọc trong { post }, số khác trả thẳng — xử lý cả hai.
  return (data.post || data) as ZernioPost
}

export type ZernioTerminalStatus = "posted" | "failed" | "pending"

export interface ZernioResult {
  status: ZernioTerminalStatus
  platformPostUrl: string | null
  errorMessage: string | null
  raw: ZernioPost
}

/** Đọc kết quả 1 post Zernio → trạng thái nội bộ + URL thật (KHÔNG bịa). */
export function extractZernioResult(post: ZernioPost): ZernioResult {
  const platform = post.platforms?.[0]
  const url = platform?.platformPostUrl || null
  const err = platform?.errorMessage || null

  const s = (post.status || "").toLowerCase()
  if (s === "published") return { status: "posted", platformPostUrl: url, errorMessage: null, raw: post }
  if (s === "failed") return { status: "failed", platformPostUrl: null, errorMessage: err || "Zernio publish failed", raw: post }
  if (s === "partial") {
    // Một số nền tảng thành công, số khác lỗi — coi là posted nếu có URL, kèm cảnh báo.
    return { status: url ? "posted" : "failed", platformPostUrl: url, errorMessage: err, raw: post }
  }
  // draft | scheduled | publishing → chưa terminal
  return { status: "pending", platformPostUrl: url, errorMessage: null, raw: post }
}

/**
 * Poll GET /posts/{id} đến khi terminal (published/failed) hoặc hết số lần thử.
 * Dùng cho đăng-ngay: publish của Zernio là bất đồng bộ nên URL thật chỉ có sau khi đăng xong.
 */
export async function pollZernioUntilTerminal(
  postId: string,
  opts: { attempts?: number; delayMs?: number } = {}
): Promise<ZernioResult> {
  const attempts = opts.attempts ?? 8
  const delayMs = opts.delayMs ?? 2000
  let last: ZernioResult | null = null

  for (let i = 0; i < attempts; i++) {
    try {
      const post = await getZernioPost(postId)
      last = extractZernioResult(post)
      // failed → trả ngay (không có URL để chờ).
      if (last.status === "failed") return last
      // posted ĐÃ có URL → xong. posted nhưng CHƯA có URL (Instagram/TikTok trả URL bất đồng bộ)
      // → poll thêm để chờ URL thật xuất hiện, thay vì trả về sớm với URL null.
      if (last.status === "posted" && last.platformPostUrl) return last
    } catch (err) {
      // Lỗi mạng tạm thời — thử lại
      console.warn(`[zernio] poll attempt ${i + 1}/${attempts} failed:`, err instanceof Error ? err.message : err)
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs))
  }

  // Hết số lần thử: trả kết quả gần nhất (có thể là posted-không-URL — UI sẽ ẩn nút mở link).
  return last ?? { status: "pending", platformPostUrl: null, errorMessage: null, raw: { _id: postId, status: "pending" } }
}
