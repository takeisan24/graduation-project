/**
 * Service: Video Generation
 *
 * Sinh video bằng Google Gemini Veo (veo-3.0). Xử lý:
 * - Auth + paywall (kiểm tra credits trước, trừ sau khi sinh thành công)
 * - Gọi lớp điều phối aiManager.generateVideo (đã có key rotation + polling)
 * - Trừ 20 credits + ghi nhận usage
 * - Chuẩn hóa định dạng phản hồi cho client (videoUrl | blob base64 | jobId)
 */

import { NextRequest } from "next/server";
import { aiManager } from "@/lib/ai/providers/manager";
import { getBestModel } from "@/lib/ai/config";
import { trackUsage, deductCredits, CREDIT_COSTS } from "@/lib/usage";
import { withApiProtection } from "@/lib/middleware/api-protected";

export interface VideoGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  resolution?: string;
  modelId?: string;
}

export interface VideoGenerationResult {
  videoUrl?: string;
  blob?: string;
  mimeType?: string;
  jobId?: string;
  status?: 'processing';
  prompt: string;
  model: string;
  creditsRemaining: number;
  message: string;
}

/**
 * Sinh video kèm quản lý credits + xử lý lỗi.
 */
export async function generateVideoWithCredits(
  req: NextRequest,
  request: VideoGenerationRequest
): Promise<VideoGenerationResult | { error: string; status: number }> {
  const {
    prompt,
    negativePrompt,
    aspectRatio = '16:9',
    resolution = '1080p',
    modelId,
  } = request;

  if (!prompt) {
    return { error: "Prompt is required", status: 400 };
  }

  const videoModel = modelId || getBestModel('video');

  // Auth + paywall (chưa trừ credit cho đến khi sinh xong)
  const protection = await withApiProtection(req, 'WITH_VIDEO', {
    returnError: true,
    skipDeduct: true,
  });
  if ('error' in protection) {
    return { error: "Unauthorized", status: protection.error.status ?? 401 };
  }

  const { user, paywallResult } = protection;

  if (!paywallResult.allowed) {
    return {
      error: JSON.stringify({
        message: paywallResult.reason || "Insufficient credits",
        upgradeRequired: paywallResult.upgradeRequired ?? true,
        creditsRequired: CREDIT_COSTS.WITH_VIDEO,
        creditsRemaining: paywallResult.creditsRemaining ?? 0,
        totalCredits: paywallResult.totalCredits ?? 0,
      }),
      status: 403,
    };
  }

  try {
    const result = await aiManager.generateVideo({
      modelId: videoModel,
      prompt,
      negativePrompt,
      aspectRatio,
      resolution,
      userId: user.id,
    });

    const hasJob = !!result.jobId;
    const hasUrl = !!result.url;
    const hasBlob = !!result.blob;

    if (!hasJob && !hasUrl && !hasBlob) {
      throw new Error("No video data returned");
    }

    // Nếu chỉ mới nhận jobId (tác vụ async, video CHƯA tạo xong) thì KHÔNG trừ credits;
    // chỉ trừ khi đã có video thật (url hoặc blob).
    if (hasJob && !hasUrl && !hasBlob) {
      return {
        prompt,
        model: videoModel,
        creditsRemaining: paywallResult.creditsRemaining ?? 0,
        jobId: result.jobId,
        status: 'processing',
        message: "Video đang được tạo, sẽ thông báo khi hoàn thành.",
      };
    }

    // Đã có video thật → trừ credits (chỉ sau khi sinh thành công)
    const creditResult = await deductCredits(
      user.id,
      'WITH_VIDEO',
      {
        model: videoModel,
        prompt: prompt.substring(0, 100),
        aspectRatio,
        resolution,
      },
      undefined,
      CREDIT_COSTS.WITH_VIDEO,
      1
    );

    if (!creditResult.success) {
      console.error("Failed to deduct credits after video generation:", creditResult);
    } else {
      await trackUsage(user.id, 'video_generated');
    }

    const creditsRemaining = creditResult.creditsLeft ?? paywallResult.creditsRemaining ?? 0;
    const base = {
      prompt,
      model: videoModel,
      creditsRemaining,
    };

    if (hasJob) {
      return {
        ...base,
        jobId: result.jobId,
        status: 'processing',
        message: "Video đang được tạo, sẽ thông báo khi hoàn thành.",
      };
    }

    if (hasUrl) {
      return { ...base, videoUrl: result.url, message: "Video generated successfully" };
    }

    // Trường hợp trả Blob: chuyển sang base64 để client dựng lại
    const buffer = Buffer.from(await (result.blob as Blob).arrayBuffer());
    return {
      ...base,
      blob: buffer.toString('base64'),
      mimeType: 'video/mp4',
      message: "Video generated successfully",
    };
  } catch (error: unknown) {
    console.error("Video generation process failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Video generation failed";
    return {
      error: JSON.stringify({
        error: "Video generation failed",
        message: errorMessage,
        creditsDeducted: false,
      }),
      status: 500,
    };
  }
}
