/**
 * Service: Video Generation
 * 
 * Handles video generation business logic including:
 * - Credit checking and deduction
 * - Usage tracking
 * - Error handling and rollback
 * - Video storage upload to Supabase
 * - Response formatting
 */

import { NextRequest } from "next/server";
import { aiManager } from "@/lib/ai/providers/manager";
import { getBestModel } from "@/lib/ai/config";
import { trackUsage, deductCredits, rollbackCredits } from "@/lib/usage";
import { MEDIA_ERRORS } from "@/lib/messages/errors";
import { withApiProtection } from "@/lib/middleware/api-protected";
// Lazy import supabase and getUserPlanAndCredits to avoid loading lib/supabase.ts on client-side
// These are only used server-side in API routes

export interface VideoGenerationRequest {
  prompt: string;
  platform?: string;
  modelId?: string;
  negativePrompt?: string;
  aspectRatio?: string;
  resolution?: string;
  userId: string;
}

export interface VideoGenerationResult {
  videoUrl?: string;
  blob?: string; // Base64 string
  mimeType?: string;
  jobId?: string;
  status?: 'processing';
  isProcessing?: boolean;
  prompt: string;
  platform: string;
  model: string;
  creditsRemaining: number;
  message: string;
}

/**
 * Ensure video bucket exists in Supabase Storage
 */
async function ensureVideoBucketExists(bucketName: string): Promise<boolean> {
  try {
    // Lazy import supabase to avoid loading on client-side
    const { supabase } = await import("@/lib/supabase");
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error(`[Video Generation] Error listing buckets:`, listError);
      return false;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === bucketName) || false;
    if (bucketExists) {
      return true;
    }

    // Create bucket if it doesn't exist
    console.log(`[Video Generation] Creating bucket '${bucketName}'...`);
    const { supabase: supabaseForCreate } = await import("@/lib/supabase");
    const { error: createError } = await supabaseForCreate.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: null,
      fileSizeLimit: null
    });

    if (createError) {
      console.error(`[Video Generation] Error creating bucket '${bucketName}':`, createError);
      return false;
    }

    console.log(`[Video Generation] Successfully created bucket '${bucketName}'`);
    return true;
  } catch (error: any) {
    console.error(`[Video Generation] Unexpected error ensuring bucket exists:`, error);
    return false;
  }
}

/**
 * Upload video blob to Supabase Storage
 */
async function uploadVideoToStorage(
  videoBlob: Blob,
  userId: string,
  prompt: string,
  aspectRatio: string,
  resolution: string,
  model: string
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  const bucketName = 'videos';
  
  try {
    // Ensure bucket exists
    const bucketExists = await ensureVideoBucketExists(bucketName);
    if (!bucketExists) {
      return { success: false, error: 'Failed to create videos bucket' };
    }

    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
    const fileName = `video-${Date.now()}-${userId}.mp4`;

    console.log(`[Video Generation] Uploading video to bucket '${bucketName}': ${fileName}, size: ${videoBuffer.length} bytes`);
    
    // Lazy import supabase to avoid loading on client-side
    const { supabase } = await import("@/lib/supabase");
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(`${userId}/${fileName}`, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false
      });

    if (uploadError) {
      console.error(`[Video Generation] Storage upload error:`, {
        error: uploadError,
        message: uploadError.message,
        bucket: bucketName,
        fileName: fileName,
        fileSize: videoBuffer.length,
        userId: userId
      });
      return { success: false, error: uploadError.message };
    }

    if (!uploadData) {
      return { success: false, error: 'Upload data not returned' };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(uploadData.path);

    // Save metadata to DB
    await supabase.from('files').insert({
      user_id: userId,
      key: uploadData.path,
      bucket: 'videos',
      mime: 'video/mp4',
      size: videoBuffer.length,
      metadata: { prompt, aspectRatio, resolution, model }
    });

    console.log(`[Video Generation] Saved video to storage for user ${userId}: ${uploadData.path}`);

    return { success: true, videoUrl: urlData.publicUrl };
  } catch (error: any) {
    console.error("[Video Generation] Exception during storage upload:", error);
    return { success: false, error: error.message || 'Unknown storage error' };
  }
}

/**
 * Generate video with credit management and error handling
 */
export async function generateVideoWithCredits(
  req: NextRequest,
  request: VideoGenerationRequest
): Promise<VideoGenerationResult | { error: string; status: number }> {
  const {
    prompt,
    platform = 'general',
    modelId,
    negativePrompt,
    aspectRatio = '16:9',
    resolution = '1080p',
    userId
  } = request;

  if (!prompt) {
    return { error: "Prompt is required", status: 400 };
  }

  // Default to Gemini if no modelId provided
  const videoModel = modelId || getBestModel('video');

  // Centralized protection: auth + paywall check (skip deduction until success)
  const protection = await withApiProtection(req, 'WITH_VIDEO', {
    returnError: true,
    skipDeduct: true // Only check auth + paywall, deduct after success
  });
  if ('error' in protection) {
    const status = protection.error.status ?? 401;
    let message = "Unauthorized or insufficient credits";
    try {
      const errorBody = await protection.error.json();
      const parsed = typeof errorBody?.error === "string" ? errorBody.error : errorBody?.message;
      if (parsed) {
        message = (() => {
          try {
            const jsonMessage = JSON.parse(parsed);
            return jsonMessage?.message || parsed;
          } catch {
            return parsed;
          }
        })();
      }
    } catch {
      // Ignore parsing errors
    }
    return { error: message, status };
  }

  const { user, paywallResult } = protection;

  // BE Validation: Check plan first (Free plan doesn't have video generation feature)
  // Lazy import getUserPlanAndCredits to avoid loading lib/supabase.ts on client-side
  // This ensures the import only happens when this function is called (server-side only)
  const { getUserPlanAndCredits } = await import("@/lib/services/db/users");
  const userPlanData = await getUserPlanAndCredits(user.id);

  // Lazy import error messages to avoid loading on client-side
  const { PLAN_ERRORS } = await import('@/lib/messages/errors');
  
  if (!userPlanData) {
    console.error("[generateVideoWithCredits] Error fetching user plan: user not found");
    return {
      error: JSON.stringify({
        message: PLAN_ERRORS.UNABLE_TO_CHECK_PLAN,
        upgradeRequired: false
      }),
      status: 500
    };
  }

  const userPlan = userPlanData.plan || 'free';

  // Check if user is on Free plan - video generation is not available for Free plan
  if (userPlan === 'free') {
    return {
      error: JSON.stringify({
        message: PLAN_ERRORS.FREE_PLAN_NO_VIDEO_GENERATION,
        upgradeRequired: true,
        reason: 'plan_limit',
        currentPlan: userPlan
      }),
      status: 403
    };
  }

  // Check if user has enough credits (before generation) - only if plan is not Free
  if (!paywallResult.allowed) {
    return {
      error: JSON.stringify({
        message: paywallResult.reason || "Insufficient credits",
        upgradeRequired: paywallResult.upgradeRequired ?? true,
        creditsRequired: 20, // WITH_VIDEO cost
        creditsRemaining: paywallResult.creditsRemaining ?? 0,
        totalCredits: paywallResult.totalCredits ?? 0
      }),
      status: 403
    };
  }

  // Generate video using AI manager
  let result: { url?: string; jobId?: string; blob?: Blob };
  let creditsDeducted = false;

  try {
    result = await aiManager.generateVideo({
      modelId: videoModel,
      prompt,
      negativePrompt,
      aspectRatio,
      resolution,
      userId: user.id
    });
  } catch (aiError: any) {
    console.error("Video generation error:", aiError);
    const errorMessage = aiError instanceof Error ? aiError.message : "Video generation failed";
    const isSafety = typeof errorMessage === 'string' && errorMessage.startsWith('SAFETY_FILTER:');
    const isProviderApiError = [
      MEDIA_ERRORS.MODEL_OVERLOADED, MEDIA_ERRORS.MODEL_RATE_LIMITED,
      MEDIA_ERRORS.OPENAI_OVERLOADED, MEDIA_ERRORS.OPENAI_RATE_LIMITED,
      MEDIA_ERRORS.FAL_OVERLOADED, MEDIA_ERRORS.FAL_RATE_LIMITED,
    ].includes(errorMessage as any);
    return {
      error: JSON.stringify({
        error: isProviderApiError ? errorMessage : "Video generation failed",
        message: isSafety
          ? errorMessage.replace('SAFETY_FILTER:', '').trim() || 'Nội dung bị chặn bởi bộ lọc an toàn. Vui lòng chỉnh prompt và thử lại.'
          : errorMessage,
        creditsDeducted: false,
        isProviderApiError
      }),
      status: isSafety ? 400 : 500
    };
  }

  // Handle different response formats
  let videoBlob: Blob | null = null;
  let isProcessing = false;

  if (result.blob) {
    // Gemini returns blob directly
    videoBlob = result.blob;
  } else if (result.url) {
    // Fal/OpenAI returns URL - fetch it
    try {
      const response = await fetch(result.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video from URL: ${response.statusText}`);
      }
      videoBlob = await response.blob();
    } catch (fetchError: any) {
      console.error("Failed to fetch video from URL:", fetchError);
      return {
        error: JSON.stringify({
          error: "Failed to fetch video",
          message: fetchError.message || "Failed to fetch video from provider URL",
          creditsDeducted: false
        }),
        status: 500
      };
    }
  } else if (result.jobId) {
    // Async job - return job ID
    isProcessing = true;

    // Deduct credits ONLY after generation is confirmed (jobId returned = success)
    const creditResult = await deductCredits(user.id, 'WITH_VIDEO', {
      model: videoModel,
      platform,
      prompt: prompt.substring(0, 100),
      aspectRatio,
      resolution,
      jobId: result.jobId
    });

    if (!creditResult.success) {
      console.error("Failed to deduct credits after job creation:", creditResult);
      return {
        error: JSON.stringify({
          error: "Failed to deduct credits",
          message: creditResult.reason || "Credit deduction failed",
          creditsDeducted: false
        }),
        status: 500
      };
    }

    creditsDeducted = true;

    // Track usage for async job
    await trackUsage(user.id, 'video_generated');

    return {
      jobId: result.jobId,
      status: 'processing',
      isProcessing: true,
      prompt,
      platform,
      model: videoModel,
      creditsRemaining: creditResult.creditsLeft ?? paywallResult.creditsRemaining ?? 0,
      message: "Video generation started. You'll be notified when it's ready."
    };
  } else {
    return {
      error: JSON.stringify({
        error: "No video data returned",
        message: "No video data returned from AI provider",
        creditsDeducted: false
      }),
      status: 500
    };
  }

  // Upload video to Supabase Storage (if we have blob)
  if (videoBlob) {
    const uploadResult = await uploadVideoToStorage(
      videoBlob,
      user.id,
      prompt,
      aspectRatio,
      resolution,
      videoModel
    );

    if (uploadResult.success && uploadResult.videoUrl) {
      // Deduct credits ONLY after successful generation and storage
      const creditResult = await deductCredits(user.id, 'WITH_VIDEO', {
        model: videoModel,
        platform,
        prompt: prompt.substring(0, 100),
        aspectRatio,
        resolution,
        videoUrl: uploadResult.videoUrl
      });

      if (!creditResult.success) {
        console.error("Failed to deduct credits after video generation:", creditResult);
        return {
          error: JSON.stringify({
            error: "Failed to deduct credits",
            message: creditResult.reason || "Credit deduction failed",
            creditsDeducted: false
          }),
          status: 500
        };
      }

      creditsDeducted = true;

      // Track usage
      await trackUsage(user.id, 'video_generated');

      return {
        videoUrl: uploadResult.videoUrl,
        isProcessing: false,
        prompt,
        platform,
        model: videoModel,
        creditsRemaining: creditResult.creditsLeft ?? paywallResult.creditsRemaining ?? 0,
        message: "Video generated successfully"
      };
    } else {
      // Storage upload failed - fallback to base64 response
      console.warn("[Video Generation] Storage upload failed, falling back to base64 response");
      
      // Convert blob to base64 for JSON response
      try {
        const arrayBuffer = await videoBlob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // Deduct credits ONLY after successful generation (we have blob)
        const creditResult = await deductCredits(user.id, 'WITH_VIDEO', {
          model: videoModel,
          platform,
          prompt: prompt.substring(0, 100),
          aspectRatio,
          resolution
        });

        if (!creditResult.success) {
          console.error("Failed to deduct credits after video generation:", creditResult);
          return {
            error: JSON.stringify({
              error: "Failed to deduct credits",
              message: creditResult.reason || "Credit deduction failed",
              creditsDeducted: false
            }),
            status: 500
          };
        }

        creditsDeducted = true;

        // Track usage
        await trackUsage(user.id, 'video_generated');

        return {
          blob: base64,
          mimeType: 'video/mp4',
          isProcessing: false,
          prompt,
          platform,
          model: videoModel,
          creditsRemaining: creditResult.creditsLeft ?? paywallResult.creditsRemaining ?? 0,
          message: "Video generated successfully"
        };
      } catch (conversionError: any) {
        console.error("Failed to convert blob to base64:", conversionError);
        // Rollback credits if deducted
        if (creditsDeducted) {
          console.warn("[Video Generation] Rolling back credits due to conversion error");
          await rollbackCredits(user.id, 'WITH_VIDEO', {
            reason: 'conversion_error',
            error: conversionError.message,
            model: videoModel,
            platform,
            prompt: prompt.substring(0, 100)
          });
        }
        return {
          error: JSON.stringify({
            error: "Failed to process video",
            message: conversionError.message || "Failed to convert video blob to base64",
            creditsDeducted: creditsDeducted
          }),
          status: 500
        };
      }
    }
  }

  // No video blob available
  return {
    error: JSON.stringify({
      error: "No video data available",
      message: "No video data returned from AI provider",
      creditsDeducted: false
    }),
    status: 500
  };
}

