import {
    generateVNPaySignature,
    formatVNPayDate,
    parseVNPayDate,
    buildQueryString,
} from './vnpay-utils';
import type {
    VNPayConfig,
    VNPayCreatePaymentUrlParams,
    VNPayReturnParams,
    VNPayParsedResponse,
} from '@/lib/types/vnpay';
import { getAppUrl } from '@/lib/utils/urlConfig';

/**
 * VNPay Payment Gateway Client
 * Based on VNPay API v2.1.0
 */
export class VNPayClient {
    private config: Required<Omit<VNPayConfig, 'ipnUrl'>> & Pick<VNPayConfig, 'ipnUrl'>;

    constructor(config: VNPayConfig) {
        this.config = {
            ...config,
            version: config.version || '2.1.0',
            locale: config.locale || 'vn',
        };
    }

    /**
     * Generate VNPay payment URL
     */
    createPaymentUrl(params: VNPayCreatePaymentUrlParams): string {
        const {
            orderId,
            amount,
            orderInfo,
            customerName,
            customerEmail,
            customerPhone,
            orderType = 'other',
            locale = this.config.locale,
            bankCode,
            returnUrl = this.config.returnUrl,
            ipnUrl = this.config.ipnUrl,
            expireDate,
        } = params;

        // Create date (yyyyMMddHHmmss)
        const createDate = formatVNPayDate(new Date());

        // Expire date (default: 15 minutes from now)
        const expireDateFormatted = expireDate
            ? formatVNPayDate(expireDate)
            : formatVNPayDate(new Date(Date.now() + 15 * 60 * 1000));

        // Build VNPay params (order theo alphabe)
        const vnpParams: Record<string, string> = {
            vnp_Version: this.config.version,
            vnp_Command: 'pay',
            vnp_TmnCode: this.config.tmnCode,
            vnp_Locale: locale,
            vnp_CurrCode: 'VND',
            vnp_TxnRef: orderId,
            vnp_OrderInfo: orderInfo,
            vnp_OrderType: orderType,
            vnp_Amount: (amount * 100).toString(), // VNPay requires amount * 100
            vnp_ReturnUrl: returnUrl,
            vnp_IpAddr: '127.0.0.1', // Client IP address (required)
            vnp_CreateDate: createDate,
            vnp_ExpireDate: expireDateFormatted,
        };

        // Add IPN URL if provided
        if (ipnUrl) {
            vnpParams.vnp_IpnUrl = ipnUrl;
        }

        // Add bank code if provided
        if (bankCode) {
            vnpParams.vnp_BankCode = bankCode;
        }

        // NOTE: VNPay sandbox doesn't support vnp_Bill_* parameters
        // These will be added in production if needed

        // Generate secure hash
        const secureHash = generateVNPaySignature(vnpParams, this.config.hashSecret);
        vnpParams.vnp_SecureHash = secureHash;

        // Build URL
        const queryString = buildQueryString(vnpParams);
        return `${this.config.vnpUrl}?${queryString}`;
    }

    /**
     * Parse VNPay return/IPN params
     */
    parseReturnUrl(params: VNPayReturnParams): VNPayParsedResponse {
        const {
            vnp_TxnRef,
            vnp_Amount,
            vnp_OrderInfo,
            vnp_ResponseCode,
            vnp_TransactionStatus,
            vnp_TransactionNo,
            vnp_BankCode,
            vnp_BankTranNo,
            vnp_CardType,
            vnp_PayDate,
            vnp_SecureHash,
        } = params;

        // Verify signature
        const isValidSignature = this.verifySecureHash(params);

        // Parse amount (VNPay returns amount * 100)
        const amount = parseInt(vnp_Amount) / 100;

        // Parse date
        const payDate = parseVNPayDate(vnp_PayDate);

        // Check success
        const isSuccess = vnp_ResponseCode === '00' && vnp_TransactionStatus === '00';

        return {
            orderId: vnp_TxnRef,
            amount,
            orderInfo: vnp_OrderInfo,
            isSuccess,
            responseCode: vnp_ResponseCode,
            transactionStatus: vnp_TransactionStatus,
            transactionNo: vnp_TransactionNo,
            bankCode: vnp_BankCode,
            bankTranNo: vnp_BankTranNo,
            cardType: vnp_CardType,
            payDate,
            isValidSignature,
            secureHash: vnp_SecureHash,
            rawData: params,
        };
    }

    /**
     * Verify secure hash from VNPay response
     */
    verifySecureHash(params: VNPayReturnParams): boolean {
        const { vnp_SecureHash, ...dataToHash } = params;

        if (!vnp_SecureHash) {
            return false;
        }

        const calculatedHash = generateVNPaySignature(
            dataToHash as Record<string, string>,
            this.config.hashSecret
        );
        return calculatedHash === vnp_SecureHash;
    }
}

/**
 * Create VNPay client instance from environment variables
 */
export function createVNPayClient(config?: Partial<VNPayConfig>): VNPayClient {
    const defaultConfig: VNPayConfig = {
        tmnCode: process.env.VNPAY_TMN_CODE || '',
        hashSecret: process.env.VNPAY_HASH_SECRET || '',
        vnpUrl:
            process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        returnUrl:
            process.env.VNPAY_RETURN_URL ||
            `${getAppUrl()}/buy-plan/payment-return`,
        ipnUrl: process.env.VNPAY_IPN_URL,
    };

    return new VNPayClient({ ...defaultConfig, ...config });
}

/**
 * Export singleton instance
 */
export const vnpayClient = createVNPayClient();

