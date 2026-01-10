/**
 * Frontend API Proxy: DELETE /api/video-factory/outputs/:id
 * Deletes a video factory output (with S3 cleanup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const SERVER_B_URL = process.env.SERVER_B_URL || process.env.NEXT_PUBLIC_SERVER_B_URL;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ Auth check
    // ✅ Auth check
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: outputId } = params;
    if (!outputId) {
      return NextResponse.json(
        { success: false, error: 'Output ID is required' },
        { status: 400 }
      );
    }

    // ✅ Proxy to Server B
    const serverBResponse = await fetch(`${SERVER_B_URL}/api/v1/video-factory/outputs/${outputId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SERVER_B_API_KEY || '',
        'X-User-Id': user.id || '',
      },
    });

    const json = await serverBResponse.json();

    if (!serverBResponse.ok) {
      return NextResponse.json(
        { success: false, error: json.error || 'Failed to delete output' },
        { status: serverBResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: json.data,
    });
  } catch (error: any) {
    console.error('[API] Failed to delete video factory output', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

