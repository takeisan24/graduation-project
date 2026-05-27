const VIETQR_BASE = "https://img.vietqr.io/image";

interface VietQRParams {
  amount: number;
  orderCode: number;
}

export function getVietQRConfig() {
  const bankBin = process.env.VIETQR_BANK_BIN;
  const accountNo = process.env.VIETQR_ACCOUNT_NO;
  const accountName = process.env.VIETQR_ACCOUNT_NAME;

  if (!bankBin || !accountNo || !accountName) {
    throw new Error(
      "VietQR not configured. Set VIETQR_BANK_BIN, VIETQR_ACCOUNT_NO, VIETQR_ACCOUNT_NAME in .env.local"
    );
  }

  return { bankBin, accountNo, accountName };
}

export function buildVietQRUrl({ amount, orderCode }: VietQRParams): string {
  const { bankBin, accountNo, accountName } = getVietQRConfig();
  const addInfo = `CREATORHUB ${orderCode}`;

  const params = new URLSearchParams({
    amount: String(amount),
    addInfo,
    accountName,
  });

  return `${VIETQR_BASE}/${bankBin}-${accountNo}-compact2.png?${params}`;
}
