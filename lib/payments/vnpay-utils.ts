/**
 * VNPay Utility Functions
 * Separated from client for better tree-shaking
 */

import crypto from 'crypto';

/**
 * Generate HMAC SHA256 signature
 */
export function generateVNPaySignature(
    params: Record<string, string | undefined>,
    hashSecret: string
): string {
    // Remove empty values and vnp_SecureHash
    const filteredParams = Object.keys(params)
        .filter((key) => {
            const value = params[key];
            return value !== undefined && value !== '' && key !== 'vnp_SecureHash';
        })
        .sort()
        .reduce((acc, key) => {
            const value = params[key];
            if (value) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, string>);

    // Create query string manually
    const signData = Object.keys(filteredParams)
        .map((key) => `${key}=${encodeURIComponent(filteredParams[key])}`)
        .join('&');

    // Generate HMAC SHA512 (VNPay uses SHA512, not SHA256!)
    const hmac = crypto.createHmac('sha512', hashSecret);
    const hash = hmac.update(signData, 'utf-8').digest('hex');

    return hash;
}

/**
 * Format date to VNPay format (yyyyMMddHHmmss)
 */
export function formatVNPayDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Parse VNPay date format (yyyyMMddHHmmss) to Date
 */
export function parseVNPayDate(dateStr: string): Date {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hours = parseInt(dateStr.substring(8, 10));
    const minutes = parseInt(dateStr.substring(10, 12));
    const seconds = parseInt(dateStr.substring(12, 14));

    return new Date(year, month, day, hours, minutes, seconds);
}

/**
 * Build query string from params
 */
export function buildQueryString(params: Record<string, string>): string {
    return Object.keys(params)
        .sort() // Sort alphabetically to match VNPay spec
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
}
