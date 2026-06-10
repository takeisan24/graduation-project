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
import { isZernioConfigured, deleteZernioAccount } from "@/lib/zernio";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authentication
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const connectionId = params.id;

    // Verify ownership via service layer (scope query by user_id)
    const connection = await findConnectionById(connectionId, user.id);
    
    if (!connection || connection.user_id !== user.id) {
      return fail("Connection not found or access denied", 404);
    }

    // Ngắt kết nối THẬT trên Zernio trước (giải phóng slot), nếu là tài khoản Zernio thật.
    // 404 = đã gỡ trên Zernio rồi → bỏ qua. Lỗi khác → log nhưng vẫn xoá khỏi DB app.
    if (connection.getlate_account_id && isZernioConfigured()) {
      try {
        await deleteZernioAccount(connection.getlate_account_id);
      } catch (zErr) {
        const m = zErr instanceof Error ? zErr.message : String(zErr);
        if (!/404/.test(m)) {
          console.warn(`[connections/DELETE] Zernio disconnect failed for ${connection.getlate_account_id}:`, m);
        }
      }
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

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE /api/connections/[id] error:", message);
    return fail(message, 500);
  }
}
