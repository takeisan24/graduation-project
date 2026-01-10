/**
 * Postprocess Idempotency & Paywall Utilities
 * 
 * Implements signature-based duplicate detection and credit hold/refund logic
 * for postprocess jobs to prevent double-charging and ensure idempotency.
 */

import { supabase } from "@/lib/supabase";
import crypto from "crypto";

/**
 * Generate a unique signature for a postprocess request
 * Used to detect duplicate submissions
 */
export function generatePostprocessSignature(params: {
  userId: string;
  cutJobId: string;
  selectedClipKeys: string[];
  configHash: string; // Hash of postprocess config (auto_captions, caption_style, broll, etc.)
}): string {
  // Sort clip keys to ensure consistent signature regardless of order
  const sortedKeys = [...params.selectedClipKeys].sort();

  // Create deterministic signature
  const signatureData = [
    params.userId,
    params.cutJobId,
    sortedKeys.join(","),
    params.configHash,
  ].join("|");

  return crypto.createHash("sha256").update(signatureData).digest("hex");
}

/**
 * Check if a postprocess request with the same signature already exists
 * Returns the existing job ID if found, null otherwise
 */
export async function checkDuplicatePostprocess(
  signature: string,
  userId: string
): Promise<{ exists: boolean; jobId?: string; status?: string }> {
  try {
    // Check for existing postprocess jobs with matching signature in input_data
    // Server B stores body.metadata inside input_data
    const { data: existingJobs, error } = await supabase
      .from("processing_jobs")
      .select("id, status, input_data")
      .eq("user_id", userId)
      .eq("step", "postprocess")
      .in("status", ["queued", "running", "waiting"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[checkDuplicatePostprocess] Error querying jobs:", error);
      return { exists: false };
    }

    // Check if any job has matching signature
    for (const job of existingJobs || []) {
      const inputData = (job.input_data || {}) as Record<string, any>;
      const metadata = (inputData.metadata || {}) as Record<string, any>;

      if (metadata.postprocess_signature === signature) {
        return {
          exists: true,
          jobId: job.id,
          status: job.status,
        };
      }
    }

    return { exists: false };
  } catch (err: any) {
    console.error("[checkDuplicatePostprocess] Error:", err);
    return { exists: false };
  }
}

/**
 * Calculate hash of postprocess configuration
 * Used to generate consistent signature for duplicate detection
 */
export function hashPostprocessConfig(config: {
  auto_captions?: boolean;
  caption_language?: string;
  caption_style?: string;
  broll?: boolean;
  broll_config?: any;
  [key: string]: any;
}): string {
  // Normalize config (remove undefined/null, sort keys)
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }

  const sortedKeys = Object.keys(normalized).sort();
  const configString = sortedKeys
    .map((key) => `${key}:${JSON.stringify(normalized[key])}`)
    .join("|");

  return crypto.createHash("sha256").update(configString).digest("hex");
}
