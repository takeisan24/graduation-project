import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getFilesByUserId, getFileById, deleteFile } from "@/lib/services/db/files";
import { deleteFileFromStorage } from "@/lib/services/storage/storageService";

/**
 * GET /api/files
 * Get user's uploaded files
 * 
 * Refactored: Uses service layer for database operations
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // Get files via service layer
    const files = await getFilesByUserId(user.id);

    return success({ files });

  } catch (err: any) {
    console.error("GET /api/files error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * DELETE /api/files
 * Delete a specific file
 * Body: { fileId: string }
 * 
 * Refactored: Uses service layer for database operations
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { fileId } = await req.json();
    if (!fileId) return fail("fileId is required", 400);

    // Get file details first via service layer
    const file = await getFileById(fileId, user.id);

    if (!file) {
      return fail("File not found", 404);
    }

    // Delete from Supabase Storage via service layer
    const storageResult = await deleteFileFromStorage(file.bucket, file.key);
    if (!storageResult.success) {
      console.error("Error deleting file from storage:", storageResult.error);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database via service layer
    const deleted = await deleteFile(fileId, user.id);

    if (!deleted) {
      return fail("Failed to delete file from database", 500);
    }

    return success({ message: "File deleted successfully" });

  } catch (err: any) {
    console.error("DELETE /api/files error:", err);
    return fail(err.message || "Server error", 500);
  }
}
