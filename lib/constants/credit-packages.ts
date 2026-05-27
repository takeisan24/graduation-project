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
