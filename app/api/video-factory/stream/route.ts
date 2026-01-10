/**
 * GET /api/video-factory/stream?jobId=xxx
 * SSE (Server-Sent Events) proxy endpoint for realtime job updates
 * 
 * Proxies SSE stream from Server B to frontend.
 * Replaces polling with push-based updates for better scalability.
 * 
 * Usage:
 * ```javascript
 * const es = new EventSource('/api/video-factory/stream?jobId=xxx');
 * es.onmessage = (e) => {
 *   const data = JSON.parse(e.data);
 *   updateUI(data);
 * };
 * ```
 */

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// ✅ Force dynamic rendering for API route (SSE requires dynamic)
export const dynamic = 'force-dynamic';

// Prefer env but fall back to local dev port to avoid ECONNREFUSED when env missing
const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * Get user from cookies or Authorization header (for SSE - EventSource doesn't send Authorization header)
 * SSE endpoints need to use cookies for auth since EventSource API doesn't support custom headers
 * 
 * Supabase stores session in localStorage on client, but we need to get it from cookies on server
 * Alternative: Use Authorization header as fallback (for testing/development)
 */
async function getUserFromCookies(req: NextRequest, tokenFromQuery?: string | null) {
  try {
    // ✅ CRITICAL FIX: Priority order: query param > Authorization header > cookies
    // EventSource cannot send Authorization header, so we use query param as workaround
    let token = tokenFromQuery;

    // Fallback 1: Try Authorization header (for testing/development)
    if (!token) {
      const authHeader = req.headers.get("authorization") || "";
      token = authHeader.replace("Bearer ", "").trim();
    }

    // Fallback 2: Try cookies (if Supabase stores session in cookies)
    if (!token) {
      const cookies = req.cookies;
      // Try common Supabase cookie names
      token = cookies.get('sb-access-token')?.value ||
        cookies.get('sb-localhost-auth-token')?.value ||
        cookies.get('sb-uqilrrjknnmnkxjbnwbn-auth-token')?.value ||
        null;
    }

    if (!token) {
      // ✅ FIX: req.cookies is not a Map/Set - use Object.keys() or getAll() instead
      const cookieKeys = req.cookies.getAll ?
        req.cookies.getAll().map(c => c.name) :
        Object.keys(req.cookies);

      console.warn('[SSE Proxy] No auth token found', {
        hasQueryToken: !!tokenFromQuery,
        hasAuthHeader: !!req.headers.get("authorization"),
        cookieKeys,
        hint: 'EventSource cannot send Authorization header. Token must be passed via query param.',
      });
      return null;
    }

    const res = await supabase.auth.getUser(token);
    if (res.error) {
      // ✅ IMPROVEMENT: Log detailed auth error for debugging
      const isExpired = res.error.message?.includes('expired') || res.error.message?.includes('token is expired');
      console.error('[SSE Proxy] Auth error:', res.error.message, {
        errorCode: res.error.status,
        isExpired,
        hint: isExpired
          ? 'Token has expired - client should refresh token and reconnect'
          : 'Check token validity and format',
      });
      return null;
    }

    return res.data?.user || null;
  } catch (error: any) {
    console.error('[SSE Proxy] Failed to get user:', error.message);
    return null;
  }
}

/**
 * ✅ OPTIMIZATION: Rate limiting for SSE connections
 * Track active SSE connections per jobId to prevent duplicate connections
 */
const activeSSEConnections = new Map<string, {
  count: number;
  lastConnectionAt: number;
}>();

/**
 * Check if we should allow new SSE connection for this jobId
 * Prevents rapid reconnection loops
 */
function shouldAllowSSEConnection(jobId: string): boolean {
  const existing = activeSSEConnections.get(jobId);
  if (!existing) {
    return true; // No existing connection
  }

  // If connection was closed less than 5 seconds ago, reject new connection
  // This prevents rapid reconnection loops
  const timeSinceLastConnection = Date.now() - existing.lastConnectionAt;
  if (timeSinceLastConnection < 5000) {
    return false; // Too soon after last connection
  }

  return true; // Allow connection
}

/**
 * Register SSE connection
 */
function registerSSEConnection(jobId: string): void {
  const existing = activeSSEConnections.get(jobId);
  if (existing) {
    existing.count++;
    existing.lastConnectionAt = Date.now();
  } else {
    activeSSEConnections.set(jobId, {
      count: 1,
      lastConnectionAt: Date.now(),
    });
  }
}

/**
 * Unregister SSE connection
 */
function unregisterSSEConnection(jobId: string): void {
  const existing = activeSSEConnections.get(jobId);
  if (!existing) {
    return;
  }

  existing.count--;
  if (existing.count <= 0) {
    activeSSEConnections.delete(jobId);
  }
}

export async function GET(req: NextRequest) {
  try {
    // ✅ CRITICAL FIX: Parse query params once at the beginning
    const { searchParams } = new URL(req.url);
    const tokenFromQuery = searchParams.get('token'); // ✅ CRITICAL FIX: Get token from query param (EventSource workaround)
    const jobId = searchParams.get('jobId');

    // ✅ CRITICAL FIX: EventSource doesn't send Authorization header
    // Use query param for auth (passed from client-side)
    const user = await getUserFromCookies(req, tokenFromQuery);
    if (!user) {
      // ✅ FIX: req.cookies is not a Map/Set - use Object.keys() or getAll() instead
      const cookieKeys = req.cookies.getAll ?
        req.cookies.getAll().map(c => c.name) :
        Object.keys(req.cookies);

      console.warn('[SSE Proxy] Unauthorized - no user from cookies/headers', {
        hasCookies: !!req.cookies,
        cookieKeys,
        hasAuthHeader: !!req.headers.get('authorization'),
      });
      return new Response(
        `event: error\n` +
        `data: ${JSON.stringify({
          error: {
            message: 'Unauthorized - authentication required',
            code: 'UNAUTHORIZED',
            status: 401,
          }
        })}\n\n`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
      return new Response(
        `event: error\n` +
        `data: ${JSON.stringify({ error: 'Server B is not configured' })}\n\n`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    if (!jobId) {
      return new Response(
        `event: error\n` +
        `data: ${JSON.stringify({
          error: {
            message: 'jobId query parameter is required',
            code: 'MISSING_JOB_ID',
          }
        })}\n\n`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // ✅ OPTIMIZATION: Rate limiting - prevent rapid reconnection loops
    if (!shouldAllowSSEConnection(jobId)) {
      console.log('[SSE Proxy] Rate limiting - rejecting connection (too soon after last connection)', {
        jobId,
        hint: 'Client may be reconnecting too rapidly - wait 5 seconds before reconnecting',
      });
      return new Response(
        `event: error\n` +
        `data: ${JSON.stringify({
          error: 'Rate limited - please wait before reconnecting',
          code: 'RATE_LIMITED',
          retryAfter: 5,
        })}\n\n`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Retry-After': '5',
          },
        }
      );
    }

    // Register connection
    registerSSEConnection(jobId);

    // Create SSE stream by proxying to Server B
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Connect to Server B SSE endpoint (video-factory job events)
          const response = await fetch(
            `${SERVER_B_URL}/api/v1/video-factory/jobs/${encodeURIComponent(jobId)}/events`,
            {
              // Disable fetch cache and keep-alive reuse to reduce connection resets in dev
              cache: 'no-store',
              keepalive: false,
              headers: {
                'x-api-key': SERVER_B_API_KEY,
                'x-user-id': user.id,
                Connection: 'close',
              },
            }
          );

          if (!response.ok || !response.body) {
            // ✅ HARDENING: Include status code in error event for FE to handle appropriately
            const errorData = {
              error: {
                message: 'Failed to connect to Server B',
                status: response.status,
                code: response.status === 401 || response.status === 403
                  ? 'UNAUTHORIZED'
                  : response.status === 404 || response.status === 410
                    ? 'NOT_FOUND'
                    : 'CONNECTION_ERROR',
              },
            };
            controller.enqueue(
              new TextEncoder().encode(
                `event: error\n` +
                `data: ${JSON.stringify(errorData)}\n\n`
              )
            );
            controller.close();
            return;
          }

          // Pipe Server B SSE stream to client
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          // ✅ OPTIMIZATION: Handle client disconnect to prevent resource leaks
          let clientDisconnected = false;

          // Listen for client disconnect (abort signal)
          req.signal?.addEventListener('abort', () => {
            console.log('[SSE Proxy] Client disconnected, cleaning up...', { jobId });
            clientDisconnected = true;
            reader.cancel().catch(() => { }); // Ignore cancel errors
            unregisterSSEConnection(jobId); // Unregister on disconnect
          });

          // ✅ CRITICAL FIX: Log initial connection to debug stream issues
          console.log('[SSE Proxy] Starting to pipe Server B stream', {
            jobId,
            responseOk: response.ok,
            hasBody: !!response.body,
            status: response.status,
            statusText: response.statusText,
          });

          try {
            while (true) {
              const { done, value } = await reader.read();

              // ✅ CRITICAL FIX: Log when stream ends to debug why connection closes
              if (done) {
                console.log('[SSE Proxy] Stream ended (done=true)', {
                  jobId,
                  clientDisconnected,
                  valueLength: value?.length,
                });
                break;
              }

              if (clientDisconnected) {
                console.log('[SSE Proxy] Stream ended (client disconnected)', { jobId });
                break;
              }

              // Forward SSE data to client
              if (value && value.length > 0) {
                controller.enqueue(value);
              }
            }
          } catch (streamError: any) {
            // Handle stream errors gracefully
            // ✅ CRITICAL FIX: ECONNRESET is normal when client disconnects - don't log as error
            const isConnReset =
              streamError?.cause?.code === 'ECONNRESET' ||
              streamError?.code === 'ECONNRESET' ||
              streamError?.message?.includes('ECONNRESET') ||
              streamError?.message?.includes('terminated');

            const isAbortError = streamError.name === 'AbortError' || streamError.message?.includes('aborted');

            // Only log as error if it's not a normal disconnect
            if (!clientDisconnected && !isAbortError && !isConnReset) {
              console.error('[SSE Proxy] Stream error', streamError, { jobId });
              controller.enqueue(
                new TextEncoder().encode(
                  `event: error\n` +
                  `data: ${JSON.stringify({
                    error: 'Stream error',
                    message: streamError.message,
                    code: streamError?.code || streamError?.cause?.code,
                  })}\n\n`
                )
              );
            } else if (isConnReset && !clientDisconnected) {
              // Client disconnected - log as info, not error
              console.log('[SSE Proxy] Client disconnected (ECONNRESET)', { jobId });
            }
          } finally {
            // Cleanup
            try {
              reader.releaseLock();
            } catch (e) {
              // Ignore release errors
            }
            unregisterSSEConnection(jobId); // Unregister on cleanup
            if (!clientDisconnected) {
              controller.close();
            }
          }
        } catch (error: any) {
          // Guard: surface ECONNREFUSED clearly so FE can fallback polling gracefully
          const isConnRefused =
            error?.cause?.code === 'ECONNREFUSED' ||
            error?.code === 'ECONNREFUSED' ||
            error?.message?.includes('ECONNREFUSED');

          const isConnReset =
            error?.cause?.code === 'ECONNRESET' ||
            error?.code === 'ECONNRESET' ||
            error?.message?.includes('ECONNRESET') ||
            error?.message?.includes('terminated');

          // ✅ CRITICAL FIX: ECONNRESET is normal when client disconnects - don't log as error
          if (isConnReset) {
            console.log('[SSE Proxy] Client disconnected (ECONNRESET)', { jobId });
            unregisterSSEConnection(jobId);
            controller.close();
            return; // Don't send error event for normal disconnect
          }

          // Log connection errors (ECONNREFUSED, etc.) as errors
          if (isConnRefused) {
            console.error('[SSE Proxy] Server B unreachable (ECONNREFUSED)', {
              jobId,
              serverB: SERVER_B_URL,
              hint: 'Server B is not running. Start API/worker or check SERVER_B_URL environment variable.',
            });
          } else {
            console.error('[SSE Proxy] Connection error', error, {
              jobId,
              serverB: SERVER_B_URL,
              code: error?.code || error?.cause?.code,
            });
          }

          unregisterSSEConnection(jobId); // Unregister on error

          // ✅ CRITICAL FIX: Send error event with proper code so FE can handle gracefully
          controller.enqueue(
            new TextEncoder().encode(
              `event: error\n` +
              `data: ${JSON.stringify({
                error: {
                  message: isConnRefused
                    ? 'Server B is not available. Please start the API server or check configuration.'
                    : error.message || 'Connection error',
                  code: isConnRefused ? 'CONNECTION_REFUSED' : 'CONNECTION_ERROR',
                  serverB: SERVER_B_URL,
                  hint: isConnRefused
                    ? 'Server B unreachable - start API/worker or check SERVER_B_URL environment variable'
                    : undefined,
                }
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform', // ✅ Added no-transform
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (err: any) {
    console.error("GET /api/video-factory/stream error:", err);
    return new Response(
      `event: error\n` +
      `data: ${JSON.stringify({ error: 'Server error' })}\n\n`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }
}
