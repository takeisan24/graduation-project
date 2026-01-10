import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import {
  findInactiveUsers,
  getConnectionsForUsers,
  updateProfileWithDisconnectedPlatforms,
  deleteConnectionsByIds,
  logCleanupJob,
  getInactiveUsersStats,
  hasCleanupRunThisMonth
} from "@/lib/services/admin/cleanupService";

/**
 * POST /api/admin/cleanup-inactive-connections
 * Cleanup social media connections for users who haven't logged in for 30+ days
 * 
 * This endpoint should be called periodically (e.g., via cron job or scheduled task)
 * to free up social media connection slots for active users.
 * 
 * Security: Should be protected with API key or admin authentication
 * 
 * Flow:
 * 1. Find users who haven't logged in for 30+ days (or never logged in and created account 30+ days ago)
 * 2. Delete their connected_accounts entries (social media connections)
 * 3. Update getlate_profiles metadata to track disconnected platforms
 * 4. DO NOT delete user accounts or getlate_profiles (profiles remain in late.dev for reuse)
 * 
 * @param req - NextRequest (optionally with API key in headers for security)
 * @returns JSON response with cleanup statistics
 */
export async function POST(req: NextRequest) {
  try {
    // Check if called from Vercel Cron (has 'x-vercel-cron' header) or manual call with API key
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    const apiKey = req.headers.get("x-api-key");
    const adminApiKey = process.env.ADMIN_API_KEY;

    // Allow if called from Vercel Cron OR with valid API key OR no API key set (for development)
    if (!isVercelCron && adminApiKey && apiKey !== adminApiKey) {
      return fail("Unauthorized. Provide valid x-api-key header or call from Vercel Cron.", 401);
    }

    // Check if this is the first day of the month (for monthly cleanup)
    const now = new Date();
    const isFirstDayOfMonth = now.getDate() === 1;

    // Allow manual override via query param ?force=true (for administrative maintenance)
    const forceRun = req.nextUrl.searchParams.get("force") === "true";

    // If not first day of month and not manual call (no API key or force param), skip
    if (!isFirstDayOfMonth && !apiKey && !forceRun) {
      console.log(`[cleanup-inactive-connections] Skipping cleanup - not first day of month (current day: ${now.getDate()})`);
      return success({
        message: "Cleanup skipped - only runs on the 1st of each month. Use ?force=true or x-api-key header to override.",
        currentDate: now.toISOString(),
        isFirstDayOfMonth: false,
        hint: "Add ?force=true query param or x-api-key header to run manually"
      });
    }

    // Check last cleanup run to prevent duplicate runs on the same day
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const hasRun = await hasCleanupRunThisMonth(currentMonth);

    // Skip duplicate check if manual call (with API key or force param)
    if (hasRun && !apiKey && !forceRun) {
      console.log(`[cleanup-inactive-connections] Cleanup already ran this month (${currentMonth})`);
      return success({
        message: "Cleanup already completed this month. Use ?force=true or x-api-key header to override.",
        currentMonth,
        hint: "Add ?force=true query param or x-api-key header to run again"
      });
    }

    const INACTIVE_DAYS = 30; // Number of days of inactivity before cleanup
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_DAYS);

    console.log(`[cleanup-inactive-connections] Starting monthly cleanup for users inactive since ${cutoffDate.toISOString()} (Month: ${currentMonth})`);

    // Log cleanup job start via service layer
    await logCleanupJob(currentMonth, cutoffDate, INACTIVE_DAYS, 'processing');

    // Step 1: Find inactive users via service layer
    const inactiveUsers = await findInactiveUsers(INACTIVE_DAYS);

    if (inactiveUsers.length === 0) {
      console.log("[cleanup-inactive-connections] No inactive users found");
      return success({
        message: "No inactive users found",
        inactiveUsersCount: 0,
        connectionsDeleted: 0,
        profilesUpdated: 0
      });
    }

    console.log(`[cleanup-inactive-connections] Found ${inactiveUsers.length} inactive user(s)`);

    // Step 2: Get all connections for these users via service layer
    const userIds = inactiveUsers.map(u => u.id);
    const connections = await getConnectionsForUsers(userIds);

    if (connections.length === 0) {
      console.log("[cleanup-inactive-connections] No connections found for inactive users");
      return success({
        message: "No connections found for inactive users",
        inactiveUsersCount: inactiveUsers.length,
        connectionsDeleted: 0,
        profilesUpdated: 0
      });
    }

    console.log(`[cleanup-inactive-connections] Found ${connections.length} connection(s) to delete`);

    // Step 3: Update getlate_profiles metadata before deleting connections
    // Track which platforms were disconnected
    const profileUpdates = new Map<string, Set<string>>(); // profileId -> Set<platform>

    for (const connection of connections) {
      const getlateProfile = connection.getlate_profiles;
      if (getlateProfile?.id && connection.platform) {
        if (!profileUpdates.has(getlateProfile.id)) {
          profileUpdates.set(getlateProfile.id, new Set());
        }
        profileUpdates.get(getlateProfile.id)!.add(connection.platform);
      }
    }

    // Update each profile's metadata via service layer
    let profilesUpdated = 0;
    for (const [profileId, platforms] of profileUpdates.entries()) {
      const success = await updateProfileWithDisconnectedPlatforms(profileId, Array.from(platforms));
      if (success) {
        profilesUpdated++;
      }
    }

    // Step 4: Delete connections from connected_accounts via service layer
    const connectionIds = connections.map(c => c.id);
    const deleted = await deleteConnectionsByIds(connectionIds);

    if (!deleted) {
      return fail("Failed to delete connections", 500);
    }

    console.log(`[cleanup-inactive-connections] Cleanup completed: ${connectionIds.length} connection(s) deleted, ${profilesUpdated} profile(s) updated`);

    const result = {
      inactiveUsersCount: inactiveUsers.length,
      connectionsDeleted: connectionIds.length,
      profilesUpdated,
      cutoffDate: cutoffDate.toISOString(),
      month: currentMonth
    };

    // Update job status to completed via service layer
    await logCleanupJob(currentMonth, cutoffDate, INACTIVE_DAYS, 'completed', result);

    return success({
      message: `Successfully cleaned up ${connectionIds.length} connection(s) for ${inactiveUsers.length} inactive user(s)`,
      ...result,
      isFirstDayOfMonth
    });

  } catch (err: any) {
    console.error("[cleanup-inactive-connections] Error:", err);

    // Update job status to failed via service layer
    try {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      await logCleanupJob(currentMonth, cutoffDate, 30, 'failed', undefined, err.message || "Server error");
    } catch (updateError) {
      console.error("[cleanup-inactive-connections] Failed to update job status:", updateError);
    }

    return fail(err.message || "Server error", 500);
  }
}

/**
 * GET /api/admin/cleanup-inactive-connections
 * Get statistics about inactive users and their connections (without deleting)
 * Useful for monitoring before running cleanup
 */
export async function GET(req: NextRequest) {
  try {
    const INACTIVE_DAYS = 30;

    // Get statistics via service layer
    const stats = await getInactiveUsersStats(INACTIVE_DAYS);

    return success({
      ...stats,
      message: `Found ${stats.inactiveUsersCount} inactive user(s) with ${stats.connectionsCount} connection(s)`
    });

  } catch (err: any) {
    console.error("[cleanup-inactive-connections] GET error:", err);
    return fail(err.message || "Server error", 500);
  }
}

