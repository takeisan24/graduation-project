/**
 * Server A Proxy: GET /api/video-factory/projects/:id
 * 
 * Proxy to Server B GET /v1/video-factory/projects/:id
 * Returns comprehensive project details including cut job, postprocess jobs, and outputs
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// ✅ CRITICAL FIX: Tắt cache tĩnh của NextJS
export const dynamic = 'force-dynamic'; // Bắt buộc route này luôn dynamic
export const revalidate = 0; // Luôn fetch mới, không cache

const SERVER_B_URL = process.env.SERVER_B_URL || 'http://127.0.0.1:3001';
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY || 'your_shared_secret_here';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Get user from session
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = params;

    // ✅ Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      // ✅ Proxy request to Server B
      // ✅ CRITICAL FIX: Thêm headers chống cache và tắt NextJS fetch cache
      const res = await fetch(`${SERVER_B_URL}/api/v1/video-factory/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': SERVER_B_API_KEY,
          'x-user-id': user.id,
          'Cache-Control': 'no-cache, no-store, must-revalidate', // Bắt buộc Server B trả data mới
          'Pragma': 'no-cache',
        },
        signal: controller.signal,
        cache: 'no-store', // ✅ QUAN TRỌNG: Tắt NextJS fetch cache
      });

      clearTimeout(timeoutId);

      if (controller.signal.aborted) {
        return NextResponse.json(
          { success: false, error: 'Upstream timeout' },
          { status: 504 }
        );
      }

      const json = await res.json();

      // ✅ CRITICAL FIX: Thêm headers chống cache vào response
      return NextResponse.json(json, {
        status: res.status,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (controller.signal.aborted) {
        return NextResponse.json(
          { success: false, error: 'Upstream timeout' },
          { status: 504 }
        );
      }

      throw fetchError;
    }
  } catch (error: any) {
    console.error('[GET /api/video-factory/projects/:id] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

