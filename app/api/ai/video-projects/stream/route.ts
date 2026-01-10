import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
// ✅ CRITICAL: Disable timeout for long-running SSE connections (up to 30 mins for video gen)
export const maxDuration = 1800;

const SERVER_B_URL = process.env.SERVER_B_URL;
const SERVER_B_API_KEY = process.env.SERVER_B_API_KEY;

/**
 * GET /api/ai/video-projects/stream?projectId=xxx
 * Proxy SSE stream from JQM (Server B) to frontend
 *
 * ✅ Fixes applied:
 * 1. AbortController tied to req.signal: when FE closes EventSource, JQM fetch is aborted
 *    (prevents JQM keeping stream open indefinitely — resource leak)
 * 2. Write error handling: gracefully exits when client disconnects mid-stream
 * 3. AbortError detection at top-level catch: returns 204 instead of 500
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const token = searchParams.get("token"); // EventSource workaround for auth

    if (!projectId) {
        return new Response("projectId is required", { status: 400 });
    }

    // 1. Authenticate user
    let user;
    if (token) {
        const { data } = await supabase.auth.getUser(token);
        user = data?.user;
    } else {
        const { data } = await supabase.auth.getUser();
        user = data?.user;
    }

    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    if (!SERVER_B_URL || !SERVER_B_API_KEY) {
        return new Response("Server B not configured", { status: 500 });
    }

    // 2. Proxy request to JQM with proper streaming
    try {
        const jqmUrl = `${SERVER_B_URL}/api/v1/ai-video/stream?projectId=${projectId}&userId=${user.id}`;

        console.log(`[SSE Proxy] Connecting to JQM for project ${projectId}`);

        // ✅ FIX: AbortController tied to client disconnect signal
        // When the FE closes the EventSource, req.signal fires → JQM fetch is aborted
        // Without this, JQM keeps streaming indefinitely to a dead connection (resource leak)
        const abortController = new AbortController();
        req.signal.addEventListener('abort', () => {
            console.log(`[SSE Proxy] Client disconnected, aborting JQM stream for project ${projectId}`);
            abortController.abort();
        });

        const jqmResponse = await fetch(jqmUrl, {
            headers: {
                'x-api-key': SERVER_B_API_KEY,
                'x-user-id': user.id,
                'Accept': 'text/event-stream'
            },
            signal: abortController.signal,
        });

        if (!jqmResponse.ok) {
            const errorText = await jqmResponse.text();
            console.error("[SSE Proxy] JQM returned error:", errorText);
            return new Response(errorText || "JQM error", { status: jqmResponse.status });
        }

        if (!jqmResponse.body) {
            console.error("[SSE Proxy] JQM response has no body");
            return new Response("JQM response has no body", { status: 500 });
        }

        // 3. TransformStream: forward JQM chunks directly to client
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Forward JQM stream in the background
        (async () => {
            try {
                const reader = jqmResponse.body!.getReader();
                console.log(`[SSE Proxy] Started streaming for project ${projectId}`);

                while (true) {
                    const { done, value } = await reader.read();

                    if (done) {
                        console.log(`[SSE Proxy] JQM stream ended for project ${projectId}`);
                        break;
                    }

                    // ✅ FIX: Catch write failures when client disconnects mid-stream
                    try {
                        await writer.write(value);
                    } catch (writeErr) {
                        console.log(`[SSE Proxy] Client write failed (disconnected) for project ${projectId}`);
                        break;
                    }
                }
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    // Normal: client disconnected and we aborted the JQM fetch
                    console.log(`[SSE Proxy] JQM fetch aborted (client disconnect) for project ${projectId}`);
                } else {
                    console.error('[SSE Proxy] Stream error:', error);
                    // Notify client of stream failure so it triggers reconnection
                    try {
                        await writer.write(
                            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`)
                        );
                    } catch (_) { /* client already gone */ }
                }
            } finally {
                try { await writer.close(); } catch (_) { /* already closed */ }
            }
        })();

        // 4. Return the readable stream to the frontend
        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-store, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no', // Disable nginx buffering
            },
        });
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            // Client disconnected before JQM responded — not an error
            return new Response(null, { status: 204 });
        }
        console.error("[SSE Proxy] Connection error:", error);
        return new Response("Internal server error", { status: 500 });
    }
}
