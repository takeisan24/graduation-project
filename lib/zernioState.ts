interface PendingConnection {
  userId: string
  platform: string
  returnTo: string
  isPopup: boolean
  existingAccountIds: string[]
  expiresAt: number
}

// In-memory store for pending OAuth connections (single-instance safe for thesis)
const pending = new Map<string, PendingConnection>()

export function createPendingConnection(data: Omit<PendingConnection, "expiresAt">): string {
  const state = crypto.randomUUID()
  pending.set(state, { ...data, expiresAt: Date.now() + 10 * 60 * 1000 })
  return state
}

export function resolvePendingConnection(state: string): PendingConnection | null {
  const entry = pending.get(state)
  pending.delete(state)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry
}
