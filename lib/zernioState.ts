import { createHmac } from "crypto";

interface PendingConnection {
  userId: string;
  platform: string;
  returnTo: string;
  isPopup: boolean;
  existingAccountIds: string[];
  expiresAt: number;
}

/**
 * Trạng thái OAuth tạm thời cho luồng kết nối Zernio.
 *
 * Thay vì lưu trong RAM (Map) — vốn KHÔNG dùng được trên môi trường serverless
 * nhiều instance như Vercel, do request /start và /callback có thể chạy trên hai
 * instance khác nhau — toàn bộ dữ liệu được MÃ HOÁ ngay vào tham số `state`, kèm
 * chữ ký HMAC-SHA256 để chống giả mạo. Nhờ đó luồng không phụ thuộc bộ nhớ tiến trình.
 */
const SECRET =
  process.env.ZERNIO_STATE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "creatorhub-zernio-state-dev-secret";

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createPendingConnection(
  data: Omit<PendingConnection, "expiresAt">
): string {
  const payload: PendingConnection = {
    ...data,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function resolvePendingConnection(state: string): PendingConnection | null {
  try {
    const dot = state.lastIndexOf(".");
    if (dot <= 0) return null;
    const body = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    if (sign(body) !== sig) return null;
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as PendingConnection;
    if (!payload.expiresAt || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
