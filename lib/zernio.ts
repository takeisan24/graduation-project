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
  username: string
  displayName: string
  profileUrl?: string
  avatarUrl?: string
}

export async function listZernioAccounts(): Promise<ZernioAccount[]> {
  const profileId = process.env.ZERNIO_PROFILE_ID || ""
  const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : ""
  const data = await zernioFetch<{ accounts: ZernioAccount[] }>("GET", `/accounts${params}`)
  return data.accounts || []
}

export interface ZernioPost {
  _id: string
  status: string
  platformPostUrl?: string
  scheduledFor?: string
}

export async function createZernioPost(params: {
  accountIds: string[]
  content: string
  publishNow?: boolean
  scheduledFor?: string
  mediaUrls?: string[]
}): Promise<ZernioPost> {
  const body: Record<string, unknown> = {
    accountIds: params.accountIds,
    content: params.content,
    publishNow: params.publishNow ?? false,
  }
  if (params.scheduledFor) body.scheduledFor = params.scheduledFor
  if (params.mediaUrls?.length) {
    body.media = params.mediaUrls.map(url => ({ url }))
  }

  const data = await zernioFetch<{ post: ZernioPost }>("POST", "/posts", body)
  return data.post
}
