/**
 * POST /api/video-factory/jobs/[id]/reconcile
 * ✅ NEW: Frontend API proxy for triggering reconciliation check
 * - Proxies request to Server B
 * - Allows FE to trigger worker to check incomplete clips
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const SERVER_B_URL = process.env.SERVER_B_URL || 'http://localhost:3001';
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const jobId = params.id;
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // ✅ CRITICAL FIX: Get user from session (same pattern as other routes)
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Server B is not configured' },
        { status: 500 }
      );
    }

    // ✅ CRITICAL FIX: Proxy request to Server B with x-user-id header from session
    const serverBResponse = await fetch(`${SERVER_B_URL}/api/v1/video-factory/jobs/${jobId}/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SERVER_B_API_KEY,
        'x-user-id': user.id, // ✅ FIX: Use userId from session, not from request headers
      },
      body: JSON.stringify({}),
    });

    const serverBData = await serverBResponse.json();

    if (!serverBResponse.ok) {
      console.error('[Reconcile API] Server B reconciliation failed', {
        jobId,
        status: serverBResponse.status,
        error: serverBData,
      });
      return NextResponse.json(
        { success: false, error: serverBData.error || 'Reconciliation failed' },
        { status: serverBResponse.status }
      );
    }

    console.log('[Reconcile API] Reconciliation check completed', {
      jobId,
      reconciled: serverBData.data?.reconciled,
      tasksChecked: serverBData.data?.tasksChecked,
    });

    return NextResponse.json({
      success: true,
      data: serverBData.data,
    });
  } catch (error) {
    console.error('[Reconcile API] Failed to trigger reconciliation', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

