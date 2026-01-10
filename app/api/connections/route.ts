/**
 * GET /api/connections
 * Get user's connected social media accounts
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { withPaywallCheck } from "@/lib/paywall";
import { findConnectionsByUserId } from "@/lib/services/db/connections";

export async function GET(req: NextRequest) {
  try {
    // Authentication
    const user = await requireAuth(req); 
    if (!user) return fail("Unauthorized", 401);
    
    // Get connections via service layer
    const connections = await findConnectionsByUserId(user.id);
    
    // Sort by created_at descending (service returns unsorted)
    const sortedConnections = connections.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return success(sortedConnections);
    
  } catch (err: any) {
    console.error("GET /api/connections error:", err);
    return fail(err.message || "Server error", 500);
  }
}

/**
 * POST /api/connections
 * Add a new social media account connection
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */
export async function POST(req: NextRequest) {
  try {
    // Check paywall for profile limit
    const paywallCheck = await withPaywallCheck(req, 'profiles');
    if ('error' in paywallCheck) {
      return fail(paywallCheck.error.message, paywallCheck.error.status);
    }
    
    const { user, paywallResult } = paywallCheck;
    
    if (!paywallResult.allowed) {
      return fail(JSON.stringify({
        message: paywallResult.reason,
        upgradeRequired: paywallResult.upgradeRequired,
        currentLimit: paywallResult.currentLimit,
        limitReached: paywallResult.limitReached
      }), 403);
    }

    const body = await req.json();
    const { platform, access_token, refresh_token, profile_name, profile_id, expires_at } = body;
    
    if (!platform || !access_token || !profile_id) {
      return fail("Missing required fields: platform, access_token, profile_id", 400);
    }
    
    // Check if account already exists via service layer
    const { findConnectionByUserPlatformAndProfileId, createConnectionLegacy } = await import("@/lib/services/db/connections");
    const existingAccount = await findConnectionByUserPlatformAndProfileId(
      user.id,
      platform,
      profile_id
    );
      
    if (existingAccount) {
      return fail("Account already connected", 409);
    }
    
    // Create connection via service layer
    const connection = await createConnectionLegacy({
      user_id: user.id,
      platform,
      access_token,
      refresh_token,
      profile_name,
      profile_id,
      expires_at
    });
      
    if (!connection) {
      return fail("Failed to create connection", 500);
    }
    
    return success(connection, 201);
    
  } catch (err: any) {
    console.error("POST /api/connections error:", err);
    return fail(err.message || "Server error", 500);
  }
}
