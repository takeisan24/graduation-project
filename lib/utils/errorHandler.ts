/**
 * Error Handler Utility
 *
 * Handles parsing and displaying backend errors, especially resource-budget and
 * workflow-capacity constraints.
 */

import { toast } from 'sonner';

export interface ParsedError {
  message: string;
  isLimitError: boolean;
  reason?: 'profile_limit_reached' | 'post_limit_reached' | 'insufficient_credits' | 'plan_limit';
  upgradeRequired?: boolean;
  currentLimit?: number;
  limitReached?: boolean;
  creditsRequired?: number;
  creditsRemaining?: number;
  totalCredits?: number;
  currentPlan?: string;
}

/**
 * Parse error from backend response.
 * Supported inputs:
 * - Plain string
 * - JSON stringified object
 * - Error object with message/error field
 */
export function parseError(error: any): ParsedError {
  let errorMessage = '';
  let parsedData: any = null;

  // Helper: cố gắng đào sâu nhiều tầng để lấy thông điệp thân thiện nhất
  const extractHumanMessage = (input: any): string => {
    if (!input) return 'Lỗi không xác định';

    const tryFromString = (raw: string): string => {
      if (!raw) return 'Lỗi không xác định';

      // 1) Thử parse JSON trực tiếp
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          if (typeof obj.message === 'string') return extractHumanMessage(obj.message);
          if (typeof obj.error === 'string') return extractHumanMessage(obj.error);
        }
      } catch {
        // Không phải JSON, tiếp tục regex
      }

      // 2) Regex cho dạng bình thường: "message": "...."
      const m1 = raw.match(/"message"\s*:\s*"([^"]+)"/);
      if (m1 && m1[1]) return m1[1];

      // 3) Regex cho dạng escaped: \"message\" : \"...\"
      const m2 = raw.match(/\\"message\\"\s*:\s*\\"([^"]+)\\"/);
      if (m2 && m2[1]) return m2[1];

      return raw;
    };

    if (typeof input === 'string') {
      return tryFromString(input);
    }

    if (input instanceof Error) {
      return tryFromString(input.message || '');
    }

    if (typeof input === 'object') {
      if (typeof input.message === 'string') return extractHumanMessage(input.message);
      if (typeof input.error === 'string') return extractHumanMessage(input.error);
      try {
        return tryFromString(JSON.stringify(input));
      } catch {
        return 'Lỗi không xác định';
      }
    }

    return 'Lỗi không xác định';
  };

  // Chuẩn hóa error thành message + parsedData thô (nếu có)
  if (typeof error === 'string') {
    errorMessage = error;
    try {
      parsedData = JSON.parse(error);
    } catch {
      parsedData = null;
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
    try {
      parsedData = JSON.parse(error.message);
    } catch {
      parsedData = null;
    }
  } else if (error && typeof error === 'object') {
    errorMessage = error.message || error.error || 'Lỗi không xác định';
    parsedData = error;
  } else {
    errorMessage = 'Lỗi không xác định';
  }

  // Sau khi có errorMessage & parsedData, dùng helper để lấy thông điệp thân thiện nhất
  errorMessage = extractHumanMessage(parsedData || errorMessage);

  // Detect resource-constraint style errors while remaining compatible with
  // the older credits/plan-oriented payload shape.
  const isLimitError = parsedData && (
    parsedData.reason === 'profile_limit_reached' ||
    parsedData.reason === 'post_limit_reached' ||
    parsedData.reason === 'insufficient_credits' ||
    parsedData.reason === 'plan_limit' ||
    parsedData.upgradeRequired === true ||
    parsedData.limitReached === true ||
    (parsedData.creditsRequired !== undefined && parsedData.creditsRemaining !== undefined)
  );

  return {
    message: errorMessage,
    isLimitError,
    reason: parsedData?.reason,
    upgradeRequired: parsedData?.upgradeRequired,
    currentLimit: parsedData?.currentLimit,
    limitReached: parsedData?.limitReached,
    creditsRequired: parsedData?.creditsRequired,
    creditsRemaining: parsedData?.creditsRemaining,
    totalCredits: parsedData?.totalCredits,
  };
}

/**
 * Handle backend errors and surface them consistently to the UI.
 *
 * @param error - Error from backend (can be string, Error object, or response data)
 * @param defaultMessage - Default message if error cannot be parsed
 */
export async function handleErrorWithModal(error: any, defaultMessage: string = 'Đã xảy ra lỗi') {
  const parsed = parseError(error);

  // Determine final error message (use parsed message, fallback to default)
  const finalErrorMessage = parsed.message || defaultMessage;

  // Always show toast with error message
  toast.error(finalErrorMessage);

  // Log resource-constraint errors for debugging.
  if (parsed.isLimitError) {
    console.error('[handleErrorWithModal] Resource constraint error:', {
      reason: parsed.reason,
      creditsRequired: parsed.creditsRequired,
      creditsRemaining: parsed.creditsRemaining,
      message: finalErrorMessage,
    });
  }
}

