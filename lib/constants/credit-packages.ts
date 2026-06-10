export const CREDIT_PACKAGES = [
  { id: "starter", credits: 50, priceVND: 29000, label: "50 Credits" },
  { id: "basic", credits: 100, priceVND: 49000, label: "100 Credits" },
  { id: "popular", credits: 250, priceVND: 99000, label: "250 Credits" },
  { id: "pro", credits: 600, priceVND: 199000, label: "600 Credits" },
] as const;

export type CreditPackageId = (typeof CREDIT_PACKAGES)[number]["id"];

export function findPackageById(id: string) {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null;
}

// ── Mô hình "trả theo dùng": mua số credit tự do theo đơn giá cố định ──
export const CREDIT_UNIT_PRICE_VND = 490; // đơn giá mỗi credit
export const CREDIT_PRESETS = [50, 100, 250, 500] as const;
export const MIN_CREDITS = 10;
export const MAX_CREDITS = 10000;

/** Tổng tiền (VND) cho số credit muốn mua. */
export function computeCreditAmount(credits: number): number {
  return Math.round(credits) * CREDIT_UNIT_PRICE_VND;
}
