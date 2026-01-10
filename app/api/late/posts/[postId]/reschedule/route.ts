import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getLateClientForAccount } from "@/lib/services/late";
import { getPostById, updatePost } from "@/lib/services/db/posts";
import { getAccountById } from "@/lib/services/db/accounts";
import { findConnectionByUserAndProfile } from "@/lib/services/db/connections";

/**
 * PATCH /api/late/posts/[postId]/reschedule
 * Reschedule a post that was previously scheduled
 * 
 * Updates the schedule time for a post in both late.dev and our database
 * 
 * @param req - NextRequest with postId in params and newScheduleAt in body
 * @returns Updated post information
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { postId } = params;
    const body = await req.json();
    const { newScheduleAt, timezone } = body;

    if (!newScheduleAt) {
      return fail("newScheduleAt is required (ISO 8601 format)", 400);
    }

    // Validate newScheduleAt is a valid ISO date and in the future
    const newScheduleDate = new Date(newScheduleAt);
    if (isNaN(newScheduleDate.getTime())) {
      return fail("newScheduleAt must be a valid ISO 8601 date", 400);
    }

    if (newScheduleDate <= new Date()) {
      return fail("newScheduleAt must be in the future", 400);
    }

    // Get the scheduled post via service layer
    const scheduledPost = await getPostById(postId);
    
    if (!scheduledPost || scheduledPost.user_id !== user.id) {
      return fail("Scheduled post not found or access denied", 404);
    }

    const allowedStatuses = ['scheduled', 'failed'];
    if (!allowedStatuses.includes(scheduledPost.status)) {
      return fail(
        `Cannot reschedule post with status '${scheduledPost.status}'. Only 'scheduled' or 'failed' posts can be rescheduled.`,
        400
      );
    }

    // SECURITY: Validate that the connection (social media account) still exists and belongs to the user
    // This prevents rescheduling posts when the account has been disconnected
    // This is a critical security check to prevent:
    // 1. Rescheduling posts when account has been disconnected
    // 2. User A rescheduling posts that belong to User B's account
    if (!scheduledPost.getlate_profile_id) {
      console.error(`[late/posts/reschedule] SECURITY: Post ${postId} does not have a valid profile ID. User: ${user.id}`);
      return fail(
        "Bài đăng này không có thông tin tài khoản hợp lệ. Vui lòng kết nối lại tài khoản mạng xã hội trước khi lên lịch lại.",
        400
      );
    }

    // Check if connection exists and belongs to the user
    // This is the primary security check - connection must exist and belong to the requesting user
    const connection = await findConnectionByUserAndProfile(
      user.id,
      scheduledPost.getlate_profile_id,
      scheduledPost.platform
    );

    if (!connection) {
      console.error(`[late/posts/reschedule] SECURITY: Connection not found for post ${postId}. User: ${user.id}, Profile: ${scheduledPost.getlate_profile_id}, Platform: ${scheduledPost.platform}`);
      return fail(
        `Tài khoản ${scheduledPost.platform} cho bài đăng này đã bị ngắt kết nối. Vui lòng kết nối lại tài khoản trước khi lên lịch lại.`,
        403
      );
    }

    // Additional security: Verify user ownership of connection
    // Double-check that connection.user_id matches the requesting user
    if (connection.user_id !== user.id) {
      console.error(`[late/posts/reschedule] SECURITY ALERT: User ${user.id} attempted to reschedule post ${postId} owned by user ${connection.user_id}`);
      return fail(
        "Bạn không có quyền lên lịch lại bài đăng này. Vui lòng kiểm tra lại.",
        403
      );
    }

    // Additional security: Verify platform matches
    if (connection.platform?.toLowerCase() !== scheduledPost.platform?.toLowerCase()) {
      console.error(`[late/posts/reschedule] SECURITY: Platform mismatch for post ${postId}. Connection platform: ${connection.platform}, Post platform: ${scheduledPost.platform}. User: ${user.id}`);
      return fail(
        `Thông tin nền tảng không khớp. Bài đăng này dành cho ${scheduledPost.platform} nhưng tài khoản đã kết nối là ${connection.platform}. Vui lòng kiểm tra lại.`,
        403
      );
    }

    // Additional security: Verify getlate_profile_id matches
    // Ensure the post's profile ID matches the connection's profile ID
    if (connection.getlate_profile_id !== scheduledPost.getlate_profile_id) {
      console.error(`[late/posts/reschedule] SECURITY: Profile ID mismatch for post ${postId}. Connection profile: ${connection.getlate_profile_id}, Post profile: ${scheduledPost.getlate_profile_id}. User: ${user.id}`);
      return fail(
        "Thông tin tài khoản không khớp. Vui lòng kết nối lại tài khoản trước khi lên lịch lại.",
        403
      );
    }

    // Check if late_job_id exists
    if (!scheduledPost.late_job_id) {
      return fail("Post does not have a late.dev job ID. Cannot reschedule.", 400);
    }

    // Update schedule in late.dev using UTC to avoid DST discrepancies
    // Get getlate_account for this scheduled post via service layer
    if (!scheduledPost.getlate_account_id) {
      return fail("Post does not have a getlate account ID", 500);
    }
    
    const getlateAccountData = await getAccountById(scheduledPost.getlate_account_id);
    
    if (!getlateAccountData) {
      return fail("Getlate account not found for this post", 500);
    }
    
    // Convert LateAccount to LateAccountWithLimits format for getLateClientForAccount
    const lateClient = getLateClientForAccount({
      ...getlateAccountData,
      limits: getlateAccountData.metadata?.limits || {}
    } as any);
    
    let updatedLatePost: any;
    try {
      updatedLatePost = await lateClient.updatePostSchedule(
        scheduledPost.late_job_id,
        newScheduleAt,
        timezone || 'UTC'
      );
      
      // Verify the post status was updated correctly
      const postStatus = updatedLatePost?.post?.status || updatedLatePost?.status || 'unknown';
      const postData = updatedLatePost?.post || updatedLatePost;
      
      console.log(`[late/posts/reschedule] Rescheduled post ${postId} to ${newScheduleAt} (timezone: ${timezone || 'UTC'})`);
      console.log(`[late/posts/reschedule] Late.dev post status after update: ${postStatus}`);
      
      // Warn if post is still in draft status
      if (postStatus === 'draft' || postStatus === 'Draft') {
        console.warn(`[late/posts/reschedule] WARNING: Post ${postId} is still in draft status after reschedule. This may indicate an issue with the Late.dev API update.`);
      }
      
    } catch (lateError: any) {
      console.error("[late/posts/reschedule] Late.dev update failed:", lateError);
      return fail(
        `Failed to reschedule post in late.dev: ${lateError.message}`,
        500
      );
    }

    // Update scheduled_posts table with new schedule time via service layer
    // Optimize payload to only store essential fields from updated response
    const { optimizeLateDevResponse, cleanPayload } = await import("@/lib/services/late/postService");
    const existingPayload = scheduledPost.payload || {};
    
    // Clean and optimize payload before updating to remove duplicates
    const cleanedPayload = cleanPayload({
      ...existingPayload,
      // Optimized Late.dev response - only essential fields
      late_dev_response: optimizeLateDevResponse(updatedLatePost, scheduledPost.platform),
      rescheduled_at: new Date().toISOString(),
      previous_scheduled_at: scheduledPost.scheduled_at,
      // Clear error fields when rescheduling
      error_message: null,
      error_details: null
    });
    
    const updatedPost = await updatePost(postId, user.id, {
      scheduled_at: newScheduleAt,
      status: 'scheduled',
      payload: cleanedPayload
    });

    if (!updatedPost) {
      console.error("[late/posts/reschedule] Database update failed");
      return fail("Failed to update scheduled post in database", 500);
    }

    return success({
      message: "Post rescheduled successfully",
      post: updatedPost,
      latePost: updatedLatePost,
      previousScheduleAt: scheduledPost.scheduled_at,
      newScheduleAt: newScheduleAt
    });

  } catch (err: any) {
    console.error("[late/posts/reschedule] Error:", err);
    return fail(err.message || "Server error", 500);
  }
}

