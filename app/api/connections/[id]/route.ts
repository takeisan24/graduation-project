/**
 * DELETE /api/connections/[id]
 * Disconnect a social media account
 * 
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { findConnectionById, deleteConnection } from "@/lib/services/db/connections";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const connectionId = params.id;

    // Verify ownership via service layer
    const connection = await findConnectionById(connectionId);
    
    if (!connection || connection.user_id !== user.id) {
      return fail("Connection not found or access denied", 404);
    }

    // Delete via service layer
    const deleted = await deleteConnection(connectionId, user.id);
    
    if (!deleted) {
      return fail("Failed to delete connection", 500);
    }

    return success({ 
      message: `Disconnected ${connection.platform} account: ${connection.profile_name}`,
      platform: connection.platform
    });

  } catch (err: any) {
    console.error("DELETE /api/connections/[id] error:", err);
    return fail(err.message || "Server error", 500);
  }
}