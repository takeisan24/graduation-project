import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { createSignedUrl } from "@/lib/services/db/files";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/files/signed-url
 * Create a signed URL for a file in storage
 * 
 * Query params:
 * - path: File path in storage (required)
 * 
 * Refactored: Uses service layer for storage operations
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req); 
    if (!user) return fail("Unauthorized", 401);
    
    const path = req.nextUrl.searchParams.get("path");
    if (!path) return fail("path required", 400);
    
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
    
    // Create signed URL via service layer
    const signedUrl = await createSignedUrl(bucket, path, 60 * 60);
    
    if (!signedUrl) {
      return fail("Failed to create signed URL", 500);
    }
    
    return success({ url: signedUrl });
  } catch (err: any) {
    console.error("GET /api/files/signed-url error:", err);
    return fail(err.message || "Server error", 500);
  }
}
