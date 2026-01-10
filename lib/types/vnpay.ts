/**
 * VNPay Payment Gateway Types
 * Documentation: https://sandbox.vnpayment.vn/apis/docs/
 */

// ============================================
// REQUEST TYPES
// ============================================

export interface VNPayPaymentParams {
    // Order info
    orderId: string;
    amount: number; // VNĐ
    orderInfo: string;

    // Customer info (optional)
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;

    // Transaction type
    orderType?: string; // default: 'other'
    locale?: 'vn' | 'en'; // default: 'vn'

    // Bank code (optional - nếu muốn user chọn bank trước)
    bankCode?: string;
}

export interface VNPayCreatePaymentUrlParams extends VNPayPaymentParams {
    // IPN (webhook) URL
    ipnUrl?: string;

    // Return URL after payment
    returnUrl: string;

    // Expiry time (default: 15 phút)
    expireDate?: Date;

    // Client IP Address (Required by VNPay)
    ipAddr?: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface VNPayReturnParams {
    // Transaction info
    vnp_TxnRef: string; // Order ID
    vnp_Amount: string; // Amount * 100
    vnp_OrderInfo: string;

    // Payment result
    vnp_ResponseCode: string; // '00' = success
    vnp_TransactionStatus: string; // '00' = success
    vnp_TransactionNo: string; // VNPay transaction number

    // Bank info
    vnp_BankCode: string;
    vnp_BankTranNo?: string;
    vnp_CardType?: string; // 'ATM', 'QRCODE', etc.

    // Transaction date
    vnp_PayDate: string; // yyyyMMddHHmmss

    // Security
    vnp_SecureHash: string;

    // Other params
    vnp_TmnCode: string;
    [key: string]: string | undefined;
}

export interface VNPayIPNParams extends VNPayReturnParams {
    // Same as return params
}

// ============================================
// PARSED RESPONSE
// ============================================

export interface VNPayParsedResponse {
    orderId: string;
    amount: number; // VNĐ (đã chia 100)
    orderInfo: string;

    // Status
    isSuccess: boolean;
    responseCode: string;
    transactionStatus: string;

    // Transaction details
    transactionNo: string;
    bankCode: string;
    bankTranNo?: string;
    cardType?: string;

    // Date
    payDate: Date;

    // Security
    isValidSignature: boolean;
    secureHash: string;

    // Raw data
    rawData: VNPayReturnParams;
}

// ============================================
// RESPONSE CODES
// ============================================

export const VNPAY_RESPONSE_CODES = {
    SUCCESS: '00',
    SUSPICIOUS_TRANSACTION: '07',
    INVALID_CARD: '09',
    CARD_EXPIRED: '10',
    CARD_LOCKED: '11',
    INSUFFICIENT_BALANCE: '12',
    WRONG_OTP: '13',
    CANCELED: '24',
    INSUFFICIENT_BALANCE_ACCOUNT: '51',
    OVER_DAILY_LIMIT: '65',
    MAINTENANCE: '75',
    WRONG_PASSWORD_TOO_MANY: '79',
    TRANSACTION_NOT_FOUND: '99',
} as const;

export const VNPAY_RESPONSE_MESSAGES: Record<string, string> = {
    '00': 'Giao dịch thành công',
    '07': 'Giao dịch nghi vấn (liên hệ CSKH)',
    '09': 'Thẻ/Tài khoản không đăng ký dịch vụ',
    '10': 'Thẻ/Tài khoản hết hạn',
    '11': 'Thẻ/Tài khoản bị khóa',
    '12': 'Thẻ/Tài khoản không đủ số dư',
    '13': 'Mã OTP không chính xác',
    '24': 'Giao dịch bị hủy',
    '51': 'Tài khoản không đủ số dư',
    '65': 'Vượt quá hạn mức giao dịch',
    '75': 'Ngân hàng đang bảo trì',
    '79': 'Nhập sai mật khẩu quá số lần',
    '99': 'Không tìm thấy giao dịch',
};

// ============================================
// CONFIG
// ============================================

export interface VNPayConfig {
    tmnCode: string; // Terminal Merchant Number
    hashSecret: string; // Secret key for signature
    vnpUrl: string; // VNPay gateway URL
    returnUrl: string; // Default return URL
    ipnUrl?: string; // Default IPN URL
    version?: string; // Default: '2.1.0'
    locale?: 'vn' | 'en'; // Default: 'vn'
}

// ============================================
// ORDER TYPES
// ============================================

export const VNPAY_ORDER_TYPES = {
    OTHER: 'other', // Default
    BILLPAYMENT: 'billpayment', // Thanh toán hóa đơn
    TOPUP: 'topup', // Nạp tiền
    FASHION: 'fashion',
    HOTEL: 'hotel',
    TICKET: 'ticket',
} as const;

export type VNPayOrderType = typeof VNPAY_ORDER_TYPES[keyof typeof VNPAY_ORDER_TYPES];
