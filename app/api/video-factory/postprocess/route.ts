import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";
import { withApiProtection } from "@/lib/middleware/api-protected";
import { deductCredits, rollbackCredits } from "@/lib/usage";
import {
  generatePostprocessSignature,
  checkDuplicatePostprocess,
  hashPostprocessConfig,
} from "@/lib/utils/postprocess-idempotency";

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * POST /api/video-factory/postprocess
 * 
 * Proxy postprocess request to Server B (concat + captions on selected clips)
 * 
 * Paywall & Idempotency:
 * - Holds credits immediately when job starts (deducts upfront)
 * - Detects duplicate requests using signature {userId, cutJobId, selectedClipKeys, configHash}
 * - Refunds credits if Server B returns error or job creation fails
 * 
 * Body: { cut_job_id, selected_clip_keys: string[], auto_captions?, caption_language?, caption_style?, broll?, ... }
 */
export async function POST(req: NextRequest) {
  let creditDeducted = false;
  let creditTransactionId: string | undefined;
  let amount = 0;

  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return fail("Server B is not configured", 500);
    }

    // Parse request body
    const body = await req.json();
    const { project_id, cut_job_id, selected_clip_keys, selected_cut_clip_ids, postprod_config, ...otherConfig } = body;

    // ✅ STANDARDIZATION: Support nested postprod_config (new) and flat keys (legacy)
    // Priority: postprod_config > flat keys (captured in otherConfig)
    const config = { ...otherConfig, ...(postprod_config || {}) };

    // ✅ DEBUG: Log received config
    console.log('[POST /api/video-factory/postprocess] Request received with config:', JSON.stringify(config));

    // ✅ PROJECT-CENTRIC: Accept either project_id (preferred) or cut_job_id (legacy)
    if ((!project_id && !cut_job_id) || !Array.isArray(selected_clip_keys) || selected_clip_keys.length === 0) {
      return fail("project_id (or cut_job_id) and selected_clip_keys are required", 400);
    }

    // ✅ CRITICAL FIX: Validate postprocess config - at least one feature must be enabled
    // Support both snake_case (auto_captions, broll) and camelCase (autoCaptions)
    // to handle naming convention differences between FE and BE
    const hasAutoCaptions = config.auto_captions === true || config.autoCaptions === true;

    // ✅ DEFENSIVE: Support both boolean (broll: true) and object format (broll: {enabled: true})
    // Current FE sends boolean, but support object for future-proofing
    const hasBroll = config.broll === true ||
      (typeof config.broll === 'object' && config.broll !== null && config.broll.enabled === true);

    if (!hasAutoCaptions && !hasBroll) {
      return fail(
        "At least one postprocess feature (auto_captions or broll) must be enabled. " +
        "Please enable captions, b-roll, or both.",
        400
      );
    }

    // Generate signature for duplicate detection
    // Note: hashPostprocessConfig should ideally use the normalized config, but checks flat keys
    const configHash = hashPostprocessConfig(config);
    const signature = generatePostprocessSignature({
      userId: user.id,
      cutJobId: cut_job_id || project_id, // ✅ Use cut_job_id if available, fallback to project_id
      selectedClipKeys: selected_clip_keys,
      configHash,
    });

    // ✅ DYNAMIC COST CALCULATION (Must match FE logic - Jan 2026 Model)
    const clipCount = selected_clip_keys.length;
    const clipDuration = config.clip_duration || config.clipDuration || '<60s';
    const durationMultiplier = clipDuration === '<60s' ? 1.0 : clipDuration === '60-90s' ? 1.5 : 2.0;

    // Per clip costs
    const brollEnabled = hasBroll;
    const captionsEnabled = hasAutoCaptions;

    // Post Prod specific rates - Jan 2026 Model
    const bRollCostPerClip = brollEnabled ? 5 : 0;
    const captionCostPerClip = captionsEnabled ? 5 : 0;

    // ✅ Compute per-clip cost explicitly so we can use it for refunds / retries
    const perClipCost = Math.ceil((bRollCostPerClip + captionCostPerClip) * durationMultiplier);
    amount = perClipCost * clipCount;

    // Check for duplicate request
    const duplicateCheck = await checkDuplicatePostprocess(signature, user.id);
    if (duplicateCheck.exists) {
      console.log(
        `[POST /api/video-factory/postprocess] Duplicate request detected - signature: ${signature}, existing job: ${duplicateCheck.jobId}, status: ${duplicateCheck.status}`
      );
      return fail(
        JSON.stringify({
          message: "A postprocess job with the same configuration is already in progress",
          duplicateJobId: duplicateCheck.jobId,
          status: duplicateCheck.status,
        }),
        409 // Conflict
      );
    }

    // Paywall check + credit hold (deduct immediately)
    // ✅ Use VIDEO_PROCESSING as requested
    const protection = await withApiProtection(req, "VIDEO_PROCESSING", {
      returnError: true,
      skipDeduct: false, // ✅ Upfront deduction
      amount: amount
    });
    if ("error" in protection) {
      const status = protection.error.status ?? 401;
      const body = await protection.error.json().catch(() => undefined);
      return fail(body?.error || body?.message || "Unauthorized or insufficient credits", status);
    }

    // Mark that credits were deducted (for refund on error)
    creditDeducted = true;
    creditTransactionId = protection.creditResult?.creditsLeft?.toString(); // Store for tracking

    // Forward to Server B with signature in metadata
    const serverBody = {
      ...body,
      // ✅ DYNAMIC CALLBACK: Use VIDEO_FACTORY_APP_URL for reliable server-to-server webhooks
      callback_url: `${process.env.VIDEO_FACTORY_APP_URL || 'http://localhost:3000'}/api/webhooks/video`,
      metadata: {
        ...(body.metadata || {}),
        postprocess_signature: signature, // Store signature for duplicate detection
        credit_held: true, // Flag indicating credits were held upfront
        deducted_amount: amount,
        action_type: 'VIDEO_PROCESSING',
        credit_transaction_id: creditTransactionId,
        // ✅ NEW: Per-clip accounting metadata for partial refunds / retries
        per_clip_cost: perClipCost,
        selected_clip_keys,
        // ✅ TRIỆT ĐỂ: Also forward stable cut clip UUIDs (preferred matching in worker)
        selected_cut_clip_ids: Array.isArray(selected_cut_clip_ids) ? selected_cut_clip_ids : undefined,
      },
    };

    const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/postprocess`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SERVER_B_API_KEY,
        "x-user-id": user.id,
      },
      body: JSON.stringify(serverBody),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // ✅ CRITICAL: Refund credits if Server B returns error
      console.error(
        `[POST /api/video-factory/postprocess] Server B error - refunding credits. Status: ${res.status}, Error: ${json?.error || "Unknown"}`
      );
      if (creditDeducted) {
        try {
          const refundResult = await rollbackCredits(user.id, "VIDEO_PROCESSING", {
            reason: "postprocess_job_creation_failed",
            server_b_error: json?.error || "Unknown error",
            project_id: project_id,
            cut_job_id: cut_job_id,
            signature,
          }, amount);
          if (refundResult.success) {
            console.log(
              `[POST /api/video-factory/postprocess] Successfully refunded credits to user ${user.id}`
            );
          } else {
            console.error(
              `[POST /api/video-factory/postprocess] Failed to refund credits: ${refundResult.reason}`
            );
          }
        } catch (refundError: any) {
          console.error(
            `[POST /api/video-factory/postprocess] Error during credit refund:`,
            refundError
          );
        }
      }
      return fail(json?.error || "Server B error", res.status);
    }

    // Success - credits remain deducted (job will complete and consume credits)
    console.log(
      `[POST /api/video-factory/postprocess] Postprocess job created successfully - jobId: ${json?.data?.jobId || json?.jobId}, signature: ${signature}`
    );
    return success(json?.data ?? json, res.status);
  } catch (err: any) {
    console.error("POST /api/video-factory/postprocess error:", err);

    // ✅ CRITICAL: Refund credits if unexpected error occurs
    if (creditDeducted) {
      try {
        const user = await requireAuth(req).catch(() => null);
        if (user) {
          const refundResult = await rollbackCredits(user.id, "VIDEO_PROCESSING", {
            reason: "postprocess_unexpected_error",
            error_message: err.message || "Unknown error",
          }, amount);
          if (refundResult.success) {
            console.log(
              `[POST /api/video-factory/postprocess] Successfully refunded credits after unexpected error`
            );
          }
        }
      } catch (refundError: any) {
        console.error(
          `[POST /api/video-factory/postprocess] Error during credit refund after exception:`,
          refundError
        );
      }
    }

    return fail("Server error", 500);
  }
}

