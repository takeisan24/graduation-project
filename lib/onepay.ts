import crypto from 'crypto';

export class OnePayService {
    private merchantId: string;
    private accessCode: string;
    private hashKey: string;
    private paymentUrl: string;
    private queryDrUrl: string;

    constructor() {
        this.merchantId = process.env.ONEPAY_MERCHANT_ID || '';
        this.accessCode = process.env.ONEPAY_ACCESS_CODE || '';
        this.hashKey = process.env.ONEPAY_HASH_KEY || '';
        // UI/Redirect URL
        this.paymentUrl = process.env.ONEPAY_PAYMENT_URL || 'https://onepay.vn/paygate/vpcpay.op';
        // API/Server-to-Server URL
        this.queryDrUrl = process.env.ONEPAY_QUERY_DR_URL || 'https://onepay.vn/msp/api/v1/vpc/invoices/queries';
    }

    /**
     * Sort parameters by key (A-Z)
     */
    private sortObject(obj: Record<string, any>): Record<string, string> {
        const sorted: Record<string, string> = {};
        const keys = Object.keys(obj).sort();

        keys.forEach((key) => {
            // Only include keys starting with vpc_ or user_
            if (key.match(/^(vpc_|user_)/)) {
                sorted[key] = obj[key] as string;
            }
        });
        return sorted;
    }

    /**
     * Create Secure Hash (HMAC-SHA256)
     */
    private createSecureHash(params: Record<string, string>): string {
        const sortedParams = this.sortObject(params);
        const signData = Object.keys(sortedParams)
            .map((key) => `${key}=${sortedParams[key]}`)
            .join('&');

        if (!this.hashKey) throw new Error('OnePay Hash Key is missing');

        const hmac = crypto.createHmac('sha256', Buffer.from(this.hashKey, 'hex') as any);
        hmac.update(signData);
        return hmac.digest('hex').toUpperCase();
    }

    /**
     * Build Payment URL
     */
    public buildPaymentUrl(data: {
        amount: number; // in VND
        orderId: string;
        orderInfo: string;
        returnUrl: string;
        ipAddr: string;
        billingCity?: string;
        billingCountry?: string;
        ticketNo?: string;
        locale?: string;
    }): string {
        const params: Record<string, string> = {
            vpc_Version: '2',
            vpc_Command: 'pay',
            vpc_AccessCode: this.accessCode,
            vpc_Merchant: this.merchantId,
            vpc_Locale: data.locale === 'vi' ? 'vn' : (data.locale === 'en' ? 'en' : 'vn'),
            vpc_ReturnURL: data.returnUrl,
            vpc_MerchTxnRef: data.orderId,
            vpc_OrderInfo: data.orderInfo,
            vpc_Amount: (data.amount * 100).toString(), // OnePay uses Amount * 100
            vpc_TicketNo: data.ipAddr, // Often used for IP or Ticket
            vpc_Currency: 'VND', // OnePay Vietnam only supports VND usually
        };

        // Add Secure Hash
        const secureHash = this.createSecureHash(params);
        params['vpc_SecureHash'] = secureHash;

        const query = new URLSearchParams(params).toString();
        return `${this.paymentUrl}?${query}`;
    }

    /**
     * Verify Response Secure Hash
     */
    public verifyReturnUrl(query: Record<string, string | string[]>): boolean {
        const vpc_SecureHash = query['vpc_SecureHash'] as string;
        if (!vpc_SecureHash) return false;

        // Filter vpc_ params, request parameters from response often come mixed
        // We strictly need param keys starting with vpc_ or user_, excluding vpc_SecureHash
        const paramsToHash: Record<string, string> = {};

        Object.keys(query).forEach(key => {
            if (key !== 'vpc_SecureHash' && (key.startsWith('vpc_') || key.startsWith('user_'))) {
                paramsToHash[key] = query[key] as string;
            }
        });

        const calculatedHash = this.createSecureHash(paramsToHash);
        return calculatedHash === vpc_SecureHash;
    }

    /**
     * Query Transaction Status (QueryDR)
     */
    public async queryTransaction(merchTxnRef: string): Promise<any> {
        const user = process.env.ONEPAY_USER || '';
        const password = process.env.ONEPAY_PASSWORD || '';

        if (!user || !password) {
            console.warn("OnePay QueryDR requires ONEPAY_USER and ONEPAY_PASSWORD env vars.");
        }

        const params: Record<string, string> = {
            vpc_Version: '2',
            vpc_Command: 'queryDR',
            vpc_AccessCode: this.accessCode,
            vpc_Merchant: this.merchantId,
            vpc_User: user,
            vpc_Password: password,
            vpc_MerchTxnRef: merchTxnRef,
        };

        // Add Secure Hash
        const secureHash = this.createSecureHash(params);
        params['vpc_SecureHash'] = secureHash;

        // OnePay QueryDR usually requires POST with application/x-www-form-urlencoded
        const body = new URLSearchParams(params).toString();

        try {
            // Use queryDrUrl (API endpoint) instead of paymentUrl (UI endpoint)
            const response = await fetch(this.queryDrUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            });

            const text = await response.text();

            // Response is text parameters
            const resultParams = new URLSearchParams(text);
            return Object.fromEntries(resultParams.entries());
        } catch (error) {
            console.error("QueryDR Error:", error);
            throw error;
        }
    }
}

export const onePayService = new OnePayService();
