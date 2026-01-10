import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getLateClientForAccount } from "@/lib/services/late";
import { getPostById, deletePost } from "@/lib/services/db/posts";
import { getLateAccounts } from "@/lib/services/late";

/**
 * DELETE /api/late/posts/[postId]
 * Delete a scheduled post from both getlate.dev and our database
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 * 
 * @param req - NextRequest with postId in params
 * @returns Success message
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { postId } = params;

    // Get the scheduled post via service layer
    const scheduledPost = await getPostById(postId);
    
    if (!scheduledPost || scheduledPost.user_id !== user.id) {
      return fail("Scheduled post not found or access denied", 404);
    }

    // Check if post is still scheduled (can't delete if already posted)
    if (scheduledPost.status === 'posted') {
      return fail(
        `Cannot delete post with status 'posted'. Post has already been published.`,
        400
      );
    }

    // Check if late_job_id exists
    if (!scheduledPost.late_job_id) {
      console.warn(`[late/posts/delete] Post ${postId} does not have a late.dev job ID. Deleting from database only.`);
      // Still delete from database even if no late_job_id
    } else {
      // Get getlate account for this post
      const accounts = await getLateAccounts();
      const getlateAccount = accounts.find(acc => acc.id === scheduledPost.getlate_account_id);
      
      if (!getlateAccount) {
        console.warn(`[late/posts/delete] Getlate account not found for post ${postId}. Deleting from database only.`);
      } else {
        // Delete from late.dev
        const lateClient = getLateClientForAccount(getlateAccount);
        try {
          await lateClient.deletePost(scheduledPost.late_job_id);
          console.log(`[late/posts/delete] Deleted post ${scheduledPost.late_job_id} from getlate.dev`);
        } catch (lateError: any) {
          console.error("[late/posts/delete] Late.dev delete failed:", lateError);
          // Continue to delete from database even if late.dev delete fails
          // (post might have already been deleted or doesn't exist)
        }
      }
    }

    // Delete from scheduled_posts table via service layer
    const deleted = await deletePost(postId, user.id);
    
    if (!deleted) {
      return fail("Failed to delete scheduled post from database", 500);
    }

    return success({
      message: "Post deleted successfully",
      postId: postId
    });

  } catch (err: any) {
    console.error("[late/posts/delete] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

