/**
 * useAiVideoProjectSSE Hook
 * 
 * Subscribes to AI Video Production Pipeline events via SSE.
 * Hardened with connection deduplication, token refresh, strict mode support, AND polling fallback.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { AiVideoProject } from '@/lib/types/video';

export interface AiVideoSSEEvent {
    event: 'snapshot' | 'stage' | 'progress' | 'done' | 'failed' | 'error';
    projectId: string;
    status: string;
    progress: number;
    message?: string;
    data?: any; // Contains orchestration, characterProfile, or scenes update
    timestamp: string;
}

// ✅ Track which EventSource instances already have listeners attached
// Prevents duplicate handler registration when reusing the same connection (Strict Mode, reopen)
const listenersAttached = new WeakSet<EventSource>();

/**
 * ✅ CONNECTION MANAGER
 * Track active SSE connections to prevent duplicate connections
 */
const activeConnections = new Map<string, {
    eventSource: EventSource;
    mountCount: number;
    createdAt: number;
}>();

function getActiveConnection(projectId: string): EventSource | null {
    const conn = activeConnections.get(projectId);
    return conn?.eventSource || null;
}

function registerConnection(projectId: string, eventSource: EventSource): void {
    const existing = activeConnections.get(projectId);
    if (existing) {
        existing.mountCount++;
        console.log('[AI SSE Manager] Incremented mount count', { projectId, count: existing.mountCount });
    } else {
        activeConnections.set(projectId, {
            eventSource,
            mountCount: 1,
            createdAt: Date.now(),
        });
        console.log('[AI SSE Manager] Registered new connection', { projectId });
    }
}

function unregisterConnection(projectId: string): boolean {
    const existing = activeConnections.get(projectId);
    if (!existing) return false;

    existing.mountCount--;
    if (existing.mountCount <= 0) {
        console.log('[AI SSE Manager] Closing connection (last mount)', { projectId });
        existing.eventSource.close();
        activeConnections.delete(projectId);
        return true;
    }
    return false;
}

export function useAiVideoProjectSSE(projectId: string | null | undefined) {
    const [isConnected, setIsConnected] = useState(false);
    const [project, setProject] = useState<AiVideoProject | null>(null);
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const projectRef = useRef<AiVideoProject | null>(null);

    // Reconnection & Polling State
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    // ✅ FIX: isMountedRef tracks component mount status
    // Only set to false in the FINAL cleanup (component unmount), not on projectId change
    const isMountedRef = useRef(true);

    // Keep refs in sync with current values
    const projectIdRef = useRef(projectId);
    useEffect(() => { projectIdRef.current = projectId; }, [projectId]);

    // ✅ STATE RESET: Clear previous project data immediately when projectId changes
    useEffect(() => {
        setProject(null);
        setError(null);
        setIsConnected(false);
        projectRef.current = null;
    }, [projectId]);

    const handleEvent = useCallback((event: AiVideoSSEEvent & {
        final_video_url?: string;
        finalVideoUrl?: string;
        final_thumbnail_url?: string;
        finalThumbnailUrl?: string;
        config_data?: any;
        configData?: any;
    }) => {
        if (!isMountedRef.current) return;

        if (event.event === 'error' || event.status === 'FAILED') {
            const msg = event.message || (event as any).errorMessage || "Unknown error from server";
            console.warn('[AI SSE] Failure event received:', msg);
            // Don't return! Let the setProject below update the status to FAILED
            // and save the error message for the UI.
        }

        setProject(prev => {
            let next: AiVideoProject | null = prev;

            if (event.event === 'snapshot') {
                const { event: _e, timestamp: _t, ...projectData } = event as any;
                if (projectData.id) {
                    next = projectData as AiVideoProject;
                }
            } else if (!prev) {
                if (event.projectId) {
                    // ✅ Fallback: Use top-level config_data if event.data is missing
                    const configData = event.data?.config_data || event.data?.configData
                        || (event as any).config_data || (event as any).configData || {};
                    next = {
                        id: event.projectId,
                        status: event.status as any,
                        progress: event.progress,
                        config_data: configData,
                        ...event.data
                    } as any;
                }
            } else {
                // ✅ V6.5 High Watermark: Never show lower progress than already reached
                const incomingProgress = event.progress !== undefined ? event.progress : prev.progress;
                const effectiveProgress = Math.max(prev.progress || 0, incomingProgress);

                next = {
                    ...prev,
                    status: (event.status as any) || (event.event === 'error' ? 'FAILED' : prev.status),
                    progress: effectiveProgress,
                };

                // ✅ Map error message if present
                if (event.message || (event as any).errorMessage) {
                    (next as any).error_details = {
                        message: event.message || (event as any).errorMessage,
                        timestamp: new Date().toISOString()
                    };
                }

                // ✅ FIX: Map top-level final_video_url from done event
                const finalUrl = event.final_video_url || (event as any).finalVideoUrl;
                const finalThumb = event.final_thumbnail_url || (event as any).finalThumbnailUrl;
                if (finalUrl) next.final_video_url = finalUrl;
                if (finalThumb) next.final_thumbnail_url = finalThumb;

                // ✅ FIX: Merge config_data from event.data OR top-level (some stage events send it top-level)
                const incomingConfig = event.data?.config_data || event.data?.configData
                    || (event as any).config_data || (event as any).configData;
                if (incomingConfig) {
                    next.config_data = {
                        ...(prev.config_data || {}),
                        ...incomingConfig
                    };
                }

                if (event.data) {
                    const { config_data, configData, ...otherData } = event.data;
                    Object.assign(next, otherData);
                }
            }

            projectRef.current = next;
            return next;
        });

        // When project reaches terminal state, handle SSE lifecycle:
        // - DONE: Close EventSource immediately — JQM closes its end 1s after 'done' event,
        //         which would trigger onerror → reconnect loop. Close first to stop that.
        // - FAILED: Keep EventSource open — user may retry, JQM will send RESUME events on same connection
        if (event.event === 'done') {
            console.log('[AI SSE] Project DONE — closing EventSource proactively');
            const es = eventSourceRef.current;
            if (es) {
                es.close();
                unregisterConnection(event.projectId);
                eventSourceRef.current = null;
            }
            setIsConnected(false);
            // Stop polling — project is complete
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        } else if (event.status === 'FAILED') {
            // Keep SSE open, but stop polling (retry will restart it)
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        }
    }, []);

    // ✅ POLLING FALLBACK FETCH
    const fetchProjectStatus = useCallback(async () => {
        const id = projectIdRef.current;
        if (!id) return;

        try {
            const { data, error } = await supabaseClient
                .from('ai_video_projects')
                .select('*')
                .eq('id', id)
                .single();

            if (data && !error && isMountedRef.current) {
                // Map DB result to project structure
                const p = data as unknown as AiVideoProject;

                // ✅ V6.5 High Watermark: Maintain visual progress consistency
                const currentProgress = projectRef.current?.progress || 0;
                const effectiveProgress = Math.max(currentProgress, p.progress || 0);
                p.progress = effectiveProgress;

                // ✅ CRITICAL FIX: Always create a new object reference to force React re-render
                // This ensures the modal updates even if the progress value is the same
                setProject({ ...p });
                projectRef.current = p;

                console.log('[Polling] Fetched project status:', {
                    projectId: p.id,
                    status: p.status,
                    progress: p.progress,
                });

                // Stop polling if done
                if (p.status === 'DONE' || p.status === 'FAILED') {
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }
                }
            }
        } catch (err) {
            console.warn('[Polling] Failed to fetch project:', err);
        }
    }, []);

    const startPolling = useCallback(() => {
        // ✅ FIX: Guard by clearing first so restart after cleanup always works
        if (pollingIntervalRef.current) return;

        console.log('[AI SSE] Starting polling fallback (20s interval)...');
        // Fetch immediately, then every 20s
        fetchProjectStatus();

        pollingIntervalRef.current = setInterval(() => {
            if (document.hidden) return;
            fetchProjectStatus();
        }, 20000);
    }, [fetchProjectStatus]);

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            console.log('[AI SSE] Stopping polling fallback (SSE Connected)');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    const connect = useCallback(async () => {
        const currentProjectId = projectIdRef.current;
        if (!currentProjectId) return;

        // ✅ HELPER: Attach named SSE event listeners to an EventSource
        // ⚠️ CRITICAL: JQM sends ALL events as NAMED events — browser onmessage ONLY fires for unnamed events
        // ✅ FIX: Guard via WeakSet to prevent accumulation when reuse path is hit multiple times
        const attachEventListeners = (es: EventSource) => {
            if (listenersAttached.has(es)) {
                console.log('[AI SSE] Listeners already attached to this EventSource, skipping');
                return;
            }
            listenersAttached.add(es);

            const eventTypes = ['snapshot', 'stage', 'progress', 'done', 'failed', 'error'];
            eventTypes.forEach(type => {
                es.addEventListener(type, (e: any) => {
                    try { handleEvent(JSON.parse(e.data)); } catch (err) {
                        console.error(`[AI SSE] Failed to parse event type: ${type}`, err);
                    }
                });
            });
        };

        // ✅ REUSE EXISTING CONNECTION
        const existingConnection = getActiveConnection(currentProjectId);
        if (existingConnection && existingConnection.readyState === EventSource.OPEN) {
            console.log('[AI SSE] Reusing existing connection', { projectId: currentProjectId });
            eventSourceRef.current = existingConnection;
            registerConnection(currentProjectId, existingConnection);
            setIsConnected(true);
            stopPolling();

            // ✅ FIX: Always fetch latest data when reusing — otherwise UI shows stale state
            fetchProjectStatus();

            // ✅ FIX: Attach ALL named event listeners (onmessage only catches unnamed events)
            attachEventListeners(existingConnection);
            return;
        }

        try {
            // ✅ TOKEN REFRESH LOGIC
            let { data: { session } } = await supabaseClient.auth.getSession();

            if (session) {
                const now = Math.floor(Date.now() / 1000);
                const expiresAt = session.expires_at || 0;
                if (expiresAt - now < 300) { // 5 mins buffer
                    console.log('[AI SSE] Refreshing token before connect...');
                    const { data } = await supabaseClient.auth.refreshSession();
                    if (data.session) session = data.session;
                }
            }

            const token = session?.access_token;
            if (!token) throw new Error("Unauthorized - No access token");

            // ✅ INITIAL DB FETCH + start polling immediately as fallback
            // Polling ensures UI always updates even if SSE proxy fails silently
            await fetchProjectStatus();
            startPolling(); // ✅ Always start polling — SSE onopen will stop it if successful

            const url = `/api/ai/video-projects/stream?projectId=${currentProjectId}&token=${encodeURIComponent(token)}`;
            console.log('[AI SSE] Connecting...', { projectId: currentProjectId });

            const es = new EventSource(url);
            eventSourceRef.current = es;
            registerConnection(currentProjectId, es);

            es.onopen = () => {
                if (!isMountedRef.current) return;
                console.log('[AI SSE] Connected', { projectId: currentProjectId });
                setIsConnected(true);
                setError(null);
                reconnectAttemptsRef.current = 0;
                stopPolling(); // ✅ Stop polling only when SSE is confirmed working

                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                    reconnectTimeoutRef.current = null;
                }
            };

            es.onerror = (e) => {
                if (!isMountedRef.current) return;
                console.error('[AI SSE] Connection error', e);
                setIsConnected(false);

                const currentStatus = projectRef.current?.status;

                // ✅ FIX: Don't reconnect if project is in terminal state
                // - DONE: We closed ES proactively in handleEvent, onerror is just confirmation
                // - FAILED: Keep polling, but don't loop reconnect (user must manually retry)
                if (currentStatus === 'DONE' || currentStatus === 'FAILED') {
                    console.log(`[AI SSE] onerror in terminal state (${currentStatus}) — not reconnecting`);
                    es.close();
                    return;
                }

                // Transient error during production — start polling fallback
                startPolling();

                es.close();

                // ✅ EXPONENTIAL BACKOFF RECONNECT (only during active production)
                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    const delay = 3000 * Math.pow(2, reconnectAttemptsRef.current);
                    reconnectAttemptsRef.current++;
                    console.log(`[AI SSE] Reconnecting in ${delay}ms... (Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (isMountedRef.current && projectIdRef.current === currentProjectId) {
                            connect();
                        }
                    }, delay);
                } else {
                    setError("Connection failed. Continuing with polling.");
                }
            };

            // ✅ onmessage: fallback for any unnamed events (unlikely but safe)
            es.onmessage = (e) => {
                try { handleEvent(JSON.parse(e.data)); } catch (err) { }
            };

            // ✅ FIX: Use shared helper to attach all named listeners
            attachEventListeners(es);

        } catch (err: any) {
            if (isMountedRef.current) {
                setError(err.message || "Failed to connect");
                setIsConnected(false);
                startPolling(); // Fallback to polling
            }
        }

    }, [handleEvent, startPolling, stopPolling, fetchProjectStatus]);

    // ✅ Keep connect in a ref so lifecycle effect can call it without deps warning
    const connectRef = useRef(connect);
    useEffect(() => { connectRef.current = connect; }, [connect]);

    // ✅ LIFECYCLE: Connect SSE when projectId appears, full cleanup when it becomes null
    useEffect(() => {
        if (!projectId) {
            // projectId cleared (modal closed) — stop everything immediately
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            setIsConnected(false);
            reconnectAttemptsRef.current = 0;
            return;
        }

        // projectId is set (modal opened) — connect
        connectRef.current();

        return () => {
            // Cleanup for this particular projectId (runs before next projectId or on unmount)
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            unregisterConnection(projectId);
            eventSourceRef.current = null;
            reconnectAttemptsRef.current = 0;
        };
    }, [projectId]); // Only projectId — connect is stable via connectRef

    // ✅ Unmount: mark as unmounted to stop all async callbacks
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // ✅ NEW: Supabase Realtime subscription (3rd layer of updates)
    // This complements SSE + Polling and is more reliable than SSE proxy
    useEffect(() => {
        if (!projectId) return;

        console.log('[Supabase Realtime] Subscribing to project updates', { projectId });

        const channel = supabaseClient
            .channel(`ai-video-project:${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ai_video_projects',
                    filter: `id=eq.${projectId}`,
                },
                (payload) => {
                    if (!isMountedRef.current) return;

                    console.log('[Supabase Realtime] Project updated', {
                        projectId,
                        status: payload.new.status,
                        progress: payload.new.progress,
                    });

                    const updatedProject = payload.new as unknown as AiVideoProject;

                    // ✅ V6.5 High Watermark: Protect visual progress
                    const currentProgress = projectRef.current?.progress || 0;
                    updatedProject.progress = Math.max(currentProgress, updatedProject.progress || 0);

                    // ✅ Force re-render with new object reference
                    setProject({ ...updatedProject });
                    projectRef.current = updatedProject;

                    // Stop polling only if DONE (FAILED user may retry, polling resumes via retry flow)
                    if (updatedProject.status === 'DONE') {
                        if (pollingIntervalRef.current) {
                            clearInterval(pollingIntervalRef.current);
                            pollingIntervalRef.current = null;
                        }
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Supabase Realtime] Subscription active', { projectId });
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('[Supabase Realtime] Subscription error', { projectId });
                } else if (status === 'TIMED_OUT') {
                    console.warn('[Supabase Realtime] Subscription timeout', { projectId });
                }
            });

        return () => {
            console.log('[Supabase Realtime] Unsubscribing from project', { projectId });
            supabaseClient.removeChannel(channel);
        };
    }, [projectId]);


    // ✅ PUBLIC API: reconnect() — used after retry to establish fresh SSE connection
    // Differs from connect(): always tears down existing connection first, resets backoff counter
    const reconnect = useCallback(async () => {
        const currentProjectId = projectIdRef.current;
        if (!currentProjectId) return;

        console.log('[AI SSE] Reconnecting for retry...', { projectId: currentProjectId });

        // 1. Tear down existing connection (could be FAILED state with open SSE)
        const es = eventSourceRef.current;
        if (es) {
            es.close();
            eventSourceRef.current = null;
        }
        unregisterConnection(currentProjectId);

        // 2. Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        // 3. Reset backoff counter (retry is a fresh start)
        reconnectAttemptsRef.current = 0;
        setIsConnected(false);

        // 4. Restart polling (retry may take time before JQM emits first event)
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }

        // 5. Fresh connect
        await connect();
    }, [connect]);

    return { isConnected, project, error, connect, reconnect, activeProjectId: projectId };
}
