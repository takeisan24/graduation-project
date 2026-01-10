import { NextRequest, NextResponse } from "next/server";
import { success, fail } from "@/lib/response";
import { requireAuth } from "@/lib/auth";

// Fallback to local dev port if env missing to avoid ECONNREFUSED
const SERVER_B_URL = process.env.SERVER_B_URL ?? "http://localhost:4000";
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

// ✅ CRITICAL FIX: Tắt cache tĩnh của NextJS
export const dynamic = 'force-dynamic'; // Bắt buộc route này luôn dynamic
export const revalidate = 0; // Luôn fetch mới, không cache

/**
 * GET /api/video-factory/jobs/[id]
 * Proxy tới Server B: GET /api/v1/video-factory/jobs/:id
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return fail("Server B is not configured", 500);
    }

    const jobId = params.id;
    if (!jobId) {
      return fail("Job ID is required", 400);
    }

    // ✅ CRITICAL FIX: Add timeout to prevent hanging requests
    // 
    // VẤN ĐỀ:
    // - Next.js fetch không có timeout mặc định → có thể đợi 5 phút hoặc hơn
    // - Server B endpoint query DB nhiều lần (N queries) → response chậm
    // - Nếu Server B bị hang → Frontend cũng bị hang → User experience tệ
    //
    // GIẢI PHÁP:
    // - Timeout 30s: Fail fast thay vì đợi 5 phút
    // - Endpoint này chỉ đọc job status (không phải long-running operation)
    // - 30s đủ cho DB queries, nếu >30s → Server B có vấn đề → nên fail fast
    // - Frontend có thể retry hoặc hiển thị error message rõ ràng
    //
    // CÓ THỂ ĐIỀU CHỈNH:
    // - Nếu cần timeout dài hơn (ví dụ 60s), thay đổi giá trị 30000 → 60000
    // - Nhưng 30s là hợp lý cho endpoint đọc status (không phải processing)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
    
    try {
      // ✅ CRITICAL FIX: Thêm headers chống cache và tắt NextJS fetch cache
      const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/jobs/${jobId}`, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVER_B_API_KEY,
          "x-user-id": user.id,
          'Cache-Control': 'no-cache, no-store, must-revalidate', // Bắt buộc Server B trả data mới
          'Pragma': 'no-cache',
        },
        signal: controller.signal, // ✅ CRITICAL: Add abort signal for timeout
        cache: 'no-store', // ✅ QUAN TRỌNG: Tắt NextJS fetch cache
      });
      
      clearTimeout(timeoutId); // Clear timeout if request completes

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return fail(json?.error || "Server B error", res.status);
      }

      // ✅ CRITICAL FIX: Thêm headers chống cache vào response
      return NextResponse.json(
        { success: true, data: json?.data ?? json },
        {
          status: res.status,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId); // Clear timeout on error
      
      // ✅ CRITICAL FIX: Handle timeout errors gracefully
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        console.error("GET /api/video-factory/jobs/[id] timeout:", fetchError);
        return fail("Request timeout - Server B took too long to respond", 504);
      }
      
      throw fetchError; // Re-throw other errors
    }
  } catch (err: any) {
    console.error("GET /api/video-factory/jobs/[id] error:", err);
    return fail("Server error", 500);
  }
}

/**
 * DELETE /api/video-factory/jobs/[id]
 * Proxy tới Server B: DELETE /api/v1/video-factory/jobs/:id
 * 
 * Cho phép xóa các job:
 * - completed: Job đã hoàn thành
 * - processing: Job đang xử lý (có thể cancel)
 * - abandoned: Job bị bỏ rơi
 * - queued: Job đang chờ xử lý (có thể xóa để giải phóng queue)
 * 
 * Xóa hẳn trong DB (không chỉ ẩn khỏi UI).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req);
    if (!user) {
      return fail("Unauthorized", 401);
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return fail("Server B is not configured", 500);
    }

    const jobId = params.id;
    if (!jobId) {
      return fail("Job ID is required", 400);
    }

    const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/jobs/${jobId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SERVER_B_API_KEY,
        "x-user-id": user.id,
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return fail(json?.error || "Server B error", res.status);
    }

    return success(json?.data ?? json, res.status);
  } catch (err: any) {
    console.error("DELETE /api/video-factory/jobs/[id] error:", err);
    return fail("Server error", 500);
  }
}


