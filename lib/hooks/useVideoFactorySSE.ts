/**
 * useVideoFactorySSE Hook
 * 
 * React hook for subscribing to video factory job updates via SSE (Server-Sent Events).
 * Replaces polling with push-based realtime updates.
 * 
 * Usage:
 * ```tsx
 * const { isConnected, error } = useVideoFactorySSE(jobId, {
 *   onStepUpdate: (data) => console.log('Step updated:', data),
 *   onProgress: (data) => console.log('Progress:', data.progress),
 *   onJobUpdate: (data) => console.log('Job status:', data.status),
 * });
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';

/**
 * ✅ OPTIMIZATION: Track active SSE connections to prevent duplicate connections
 * Note: EventSource cannot be shared directly, but we can track and prevent duplicates
 * 
 * CRITICAL: Prevents React StrictMode double-mount from creating duplicate connections
 */
const activeConnections = new Map<string, {
  eventSource: EventSource;
  mountCount: number;
  createdAt: number;
}>();

/**
 * Check if connection already exists for jobId
 */
function hasActiveConnection(jobId: string): boolean {
  return activeConnections.has(jobId);
}

/**
 * Get active connection for jobId (if exists)
 */
function getActiveConnection(jobId: string): EventSource | null {
  const conn = activeConnections.get(jobId);
  return conn?.eventSource || null;
}

/**
 * Register active connection
 * 
 * ✅ OPTIMIZATION: Track mount count to handle React StrictMode double-mount
 */
function registerConnection(jobId: string, eventSource: EventSource): void {
  const existing = activeConnections.get(jobId);
  if (existing) {
    // Already registered - increment mount count (React StrictMode double-mount)
    existing.mountCount++;
    console.log('[SSE Manager] Incremented mount count for existing connection', {
      jobId,
      mountCount: existing.mountCount,
      total: activeConnections.size,
    });
  } else {
    // New connection
    activeConnections.set(jobId, {
      eventSource,
      mountCount: 1,
      createdAt: Date.now(),
    });
    console.log('[SSE Manager] Registered new connection', {
      jobId,
      total: activeConnections.size,
    });
  }
}

/**
 * Unregister active connection
 * 
 * ✅ OPTIMIZATION: Decrement mount count, only close when count reaches 0
 */
function unregisterConnection(jobId: string): boolean {
  const existing = activeConnections.get(jobId);
  if (!existing) {
    return false;
  }
  
  existing.mountCount--;
  
  if (existing.mountCount <= 0) {
    // Last mount unmounted - close connection and remove
    console.log('[SSE Manager] Closing connection (last mount unmounted)', {
      jobId,
      total: activeConnections.size,
    });
    existing.eventSource.close();
    activeConnections.delete(jobId);
    return true; // Connection was closed
  } else {
    // Still has active mounts - keep connection open
    console.log('[SSE Manager] Decremented mount count (connection still active)', {
      jobId,
      mountCount: existing.mountCount,
      total: activeConnections.size,
    });
    return false; // Connection still active
  }
}

export interface VideoFactorySSEEvent {
  event: 'snapshot' | 'step' | 'job' | 'progress' | 'error';
  version: string;
  jobId: string;
  step?: string;
  status?: string;
  progress?: number;
  progressMessage?: string;
  attempt?: number;
  error?: any;
  output?: any;
  /** Step postprocess: BE gửi clips hậu kỳ trong postprocess.clips (phân biệt với cut output.clips) */
  postprocess?: { clips?: any[] };
  timestamp: number;
  steps?: Record<string, {
    status: string;
    attempt: number;
    progress?: number;
    error?: any;
    // ✅ CRITICAL FIX: Include step output in snapshot steps
    output?: any;
  }>;
}

export interface UseVideoFactorySSEOptions {
  // Called when a step-level update is received (e.g. cut/postprocess)
  onStepUpdate?: (data: VideoFactorySSEEvent) => void;
  // Called when a job progress update is received
  onProgress?: (data: VideoFactorySSEEvent) => void;
  // Called when a job-level update is received (completed/failed/etc.)
  onJobUpdate?: (data: VideoFactorySSEEvent) => void;
  // Called once on initial connection/reconnect with full snapshot
  onSnapshot?: (data: VideoFactorySSEEvent) => void;
  // Called when SSE connection encounters an error
  onError?: (error: Error) => void;
  // Enable/disable SSE
  enabled?: boolean;
  /**
   * ✅ NEW: Force refresh callback when we detect that cut step or job has completed.
   * - Used by FE to immediately fetch canonical job details (project.outputClips)
   *   instead of relying solely on SSE payload, which may be truncated/minimal.
   * - Signature: (jobId: string) => void
   */
  onForceRefresh?: (jobId: string) => void;
}

export function useVideoFactorySSE(
  jobId: string | null | undefined,
  options: UseVideoFactorySSEOptions = {}
) {
  const {
    onStepUpdate,
    onProgress,
    onJobUpdate,
    onSnapshot,
    onError,
    enabled = true,
    onForceRefresh,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 10000; // ✅ OPTIMIZATION: Increased to 10 seconds to prevent rapid reconnection loops and respect rate limiting
  const pollingFallbackRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveErrorCountRef = useRef(0);
  const maxConsecutiveErrors = 3; // Switch to polling after 3 consecutive errors
  // ✅ NEW: Track rate limited state to prevent reconnection during rate limit period
  const rateLimitedUntilRef = useRef<number | null>(null);
  // ✅ FIX: Track last poll time to allow sparse polling when SSE connected
  const lastPollTimeRef = useRef<number>(0);
  // ✅ CRITICAL FIX #1 (Hidden Issue): Track last SSE message timestamp for stuck state detection
  // This helps distinguish between "stuck connection" (no messages) vs "long running step" (messages still coming)
  const lastMessageAtRef = useRef<number>(Date.now());

  // Use refs for callbacks to avoid recreating connect function
  const callbacksRef = useRef({
    onStepUpdate,
    onProgress,
    onJobUpdate,
    onSnapshot,
    onError,
    onForceRefresh,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onStepUpdate,
      onProgress,
      onJobUpdate,
      onSnapshot,
      onError,
      onForceRefresh,
    };
  }, [onStepUpdate, onProgress, onJobUpdate, onSnapshot, onError, onForceRefresh]);

  // Store current jobId and enabled in refs to avoid reconnect loops
  const jobIdRef = useRef(jobId);
  const enabledRef = useRef(enabled);
  
  useEffect(() => {
    jobIdRef.current = jobId;
    enabledRef.current = enabled;
  }, [jobId, enabled]);

  // ✅ SSE → Poll-only fallback: disable SSE and start polling
  const activatePollingFallback = useCallback((reason: string) => {
    // ✅ CRITICAL FIX: Don't activate polling if SSE is already connected
    // Check connection state via eventSource ref (more reliable than state)
    const isSSEConnected = eventSourceRef.current?.readyState === EventSource.OPEN;
    if (isSSEConnected) {
      console.log('[SSE] SSE is connected, not activating polling fallback', { reason });
      return;
    }
    
    pollingFallbackRef.current = true;
    setIsPollingFallback(true);
    enabledRef.current = false; // stop further SSE reconnects
    setIsConnected(false);
    const fallbackError = new Error(`SSE disabled, switching to polling-only. Reason: ${reason}`);
    setError(fallbackError);
    callbacksRef.current.onError?.(fallbackError);

    // cleanup current connection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      const currentJobIdForCleanup = jobIdRef.current;
      if (currentJobIdForCleanup) {
        unregisterConnection(currentJobIdForCleanup);
      }
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // ✅ CRITICAL FIX: Start polling when SSE fails (only if SSE is not connected)
    // Note: isSSEConnected is already defined above, reuse it
    const currentJobId = jobIdRef.current;
    if (currentJobId && !pollingIntervalRef.current && !isSSEConnected) {
      console.log('[SSE] Starting polling fallback', { jobId: currentJobId, reason });
      startPollingFallback(currentJobId);
    }
  }, []);

  // ✅ CRITICAL FIX: Polling fallback mechanism
  const startPollingFallback = useCallback(async (jobId: string) => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Poll immediately on first call
    await pollJobStatus(jobId);

    // ✅ CRITICAL FIX: Hybrid Polling - Polling chạy song song với SSE
    // Set up polling interval (every 15 seconds) - KHÔNG dừng khi SSE connected
    pollingIntervalRef.current = setInterval(async () => {
      const currentJobId = jobIdRef.current;
      
      // ✅ OPTIMIZED HYBRID MODE: Allow sparse polling when SSE connected (safety net)
      // Instead of completely disabling polling, poll every 30s when SSE is active
      // This ensures we don't miss final status if SSE event is dropped
      const isSSEConnected = eventSourceRef.current?.readyState === EventSource.OPEN;
      if (isSSEConnected) {
        const now = Date.now();
        const timeSinceLastPoll = now - lastPollTimeRef.current;
        const sparsePollingInterval = 30000; // 30 seconds (safety net polling)
        
        if (timeSinceLastPoll < sparsePollingInterval) {
          // Skip this poll - too soon since last one
          console.log('[Polling] SSE connected - skipping poll (too soon)', { 
            jobId: currentJobId,
            timeSinceLastPoll,
            nextPollIn: sparsePollingInterval - timeSinceLastPoll,
            hint: 'Sparse polling active (30s interval) as safety net while SSE connected',
          });
          return;
        }
        
        // Continue with sparse poll (safety net)
        console.log('[Polling] SSE connected - running safety net poll', { 
          jobId: currentJobId,
          hint: 'Sparse polling every 30s as safety net (SSE may miss final events)',
        });
      }
      
      if (currentJobId && pollingFallbackRef.current) {
        // ✅ OPTIMIZATION: Don't poll if tab is hidden (browser tab not active)
        if (typeof document !== 'undefined' && document.hidden) {
          console.log('[Polling] Tab is hidden, skipping poll', { jobId: currentJobId });
          return;
        }
        await pollJobStatus(currentJobId);
      } else {
        // Stop polling if jobId changed or polling disabled
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }, 15000); // ✅ FIX: Poll every 15 seconds - hybrid polling with SSE
  }, []);

  // ✅ CRITICAL FIX: Poll job status from API
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        console.error('[Polling] No session token available');
        return;
      }

      const response = await fetch(
        `/api/video-factory/status?jobId=${encodeURIComponent(jobId)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Polling failed: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();

      // ✅ DEBUG: Thấy rõ response thô từ API khi đang fallback polling
      console.log('[VideoFactory][Polling] Raw status response', {
        jobId,
        raw: json,
      });
      
      // ✅ CRITICAL FIX: Parse response structure correctly (same as videoFactory.ts)
      // Server A proxy returns: { success: true, data: { isFinal, nextPollAfterSec, status, ... } }
      // Server B returns: { data: { isFinal, nextPollAfterSec, status, ... } }
      const data = json.data || json;
      const job = (data as any).job || data;
      
      // ✅ CRITICAL FIX: Parse job response and call callbacks (similar to SSE events)
      // Map job response to SSE event format for consistency
      const event: VideoFactorySSEEvent = {
        event: 'snapshot',
        version: 'v1',
        jobId: job.id,
        status: job.status,
        progress: job.progress || 0,
        progressMessage: job.progress_message || '',
        steps: job.steps ? Object.fromEntries(
          Object.entries(job.steps).map(([step, stepState]: [string, any]) => [
            step,
            {
              status: stepState.status,
              attempt: stepState.attempt,
              progress: stepState.progress,
              error: stepState.error,
              output: stepState.output, // ✅ CRITICAL: Include output for clips
            },
          ])
        ) : {},
        timestamp: Date.now(),
      };

      // ✅ DEBUG: Log event đã chuẩn hoá giống SSE để so sánh với flow SSE
      console.log('[VideoFactory][Polling] Normalized snapshot event', {
        jobId,
        status: event.status,
        progress: event.progress,
        steps: Object.keys(event.steps || {}),
        cutStep: event.steps?.cut,
      });

      // Reset error count on successful poll
      consecutiveErrorCountRef.current = 0;
      
      // ✅ FIX: Update last poll time for sparse polling logic
      lastPollTimeRef.current = Date.now();

      // Call callbacks (similar to SSE snapshot event)
      callbacksRef.current.onSnapshot?.(event);

      // ✅ CRITICAL FIX: If job is final, stop polling
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled' || job.status === 'abandoned') {
        console.log('[Polling] Job is final, stopping polling', { jobId, status: job.status });
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        pollingFallbackRef.current = false;
        setIsPollingFallback(false);
      }
    } catch (pollError) {
      consecutiveErrorCountRef.current++;
      console.error('[Polling] Failed to poll job status', pollError, {
        jobId,
        consecutiveErrors: consecutiveErrorCountRef.current,
      });

      // If polling fails too many times, give up
      if (consecutiveErrorCountRef.current >= maxConsecutiveErrors) {
        console.error('[Polling] Too many consecutive errors, stopping polling', {
          jobId,
          consecutiveErrors: consecutiveErrorCountRef.current,
        });
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        const err = new Error('Polling failed after multiple attempts');
        setError(err);
        callbacksRef.current.onError?.(err);
      }
    }
  }, []);

  const connect = useCallback(async () => {
    const currentJobId = jobIdRef.current;
    const currentEnabled = enabledRef.current;
    
    if (!currentJobId || !currentEnabled) return;
    
    // ✅ NEW: Don't connect if still rate limited
    if (rateLimitedUntilRef.current && Date.now() < rateLimitedUntilRef.current) {
      const remainingMs = rateLimitedUntilRef.current - Date.now();
      console.log('[SSE] Skipping connection - still rate limited', {
        jobId: currentJobId,
        remainingMs,
        rateLimitedUntil: new Date(rateLimitedUntilRef.current).toISOString(),
        hint: 'Will wait for rate limit period to expire',
      });
      return;
    }

    // ✅ CRITICAL FIX: Don't close existing connection if it's for the same jobId and still open
    // This prevents closing a working connection when useEffect re-runs
    if (eventSourceRef.current) {
      const currentJobIdForRef = jobIdRef.current;
      const currentUrl = eventSourceRef.current.url;
      const expectedJobId = encodeURIComponent(currentJobId);
      
      // If connection is for the same jobId and still open, reuse it instead of closing
      if (currentJobIdForRef === currentJobId && 
          currentUrl.includes(`jobId=${expectedJobId}`) &&
          eventSourceRef.current.readyState === EventSource.OPEN) {
        console.log('[SSE] Reusing existing connection for same jobId', {
          jobId: currentJobId,
          readyState: eventSourceRef.current.readyState,
        });
        registerConnection(currentJobId, eventSourceRef.current); // Increment mount count
        setIsConnected(true);
        return; // Don't create new connection
      }
      
      // Different jobId or closed connection - close old one
      if (currentJobIdForRef) {
        const wasClosed = unregisterConnection(currentJobIdForRef);
        if (wasClosed) {
          // Connection was closed (last mount) - clear ref
          eventSourceRef.current = null;
        } else {
          // Connection still active (other mounts exist) - keep ref but don't close
          console.log('[SSE] Connection still active (other mounts exist), keeping ref', {
            jobId: currentJobIdForRef,
          });
        }
      }
    }

    try {
      // ✅ IMPROVEMENT: Get session and check token expiry before connecting
      // Refresh token if expired or about to expire (within 5 minutes)
      let { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        throw new Error('Unauthorized - no session');
      }
      
      // ✅ IMPROVEMENT: Check token expiry and refresh if needed
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const expiresAt = session.expires_at || 0;
      const timeUntilExpiry = expiresAt - now;
      const REFRESH_THRESHOLD = 5 * 60; // Refresh if expires within 5 minutes
      
      if (timeUntilExpiry < REFRESH_THRESHOLD) {
        console.log('[SSE] Token expiring soon, refreshing...', {
          timeUntilExpiry,
          expiresAt,
          now,
          hint: 'Refreshing token before connecting to prevent auth errors',
        });
        
        // Refresh session (Supabase will auto-refresh if autoRefreshToken is enabled)
        const { data: { session: refreshedSession }, error: refreshError } = await supabaseClient.auth.refreshSession();
        
        if (refreshError) {
          console.error('[SSE] Failed to refresh token', refreshError);
          throw new Error(`Token refresh failed: ${refreshError.message}`);
        }
        
        if (refreshedSession) {
          session = refreshedSession;
          console.log('[SSE] Token refreshed successfully', {
            newExpiresAt: refreshedSession.expires_at,
            timeUntilExpiry: (refreshedSession.expires_at || 0) - Math.floor(Date.now() / 1000),
          });
        } else {
          console.warn('[SSE] Token refresh returned no session - using existing session');
        }
      }
      
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error('Unauthorized - no access token');
      }

      // ✅ CRITICAL FIX: Check if connection already exists BEFORE creating new one
      // This prevents duplicate connections when useEffect re-runs
      const existingConnection = getActiveConnection(currentJobId);
      if (existingConnection) {
        if (existingConnection.readyState === EventSource.OPEN) {
          // Connection already exists and is open - reuse it
          console.log('[SSE] Reusing existing connection (already open)', {
            jobId: currentJobId,
            readyState: existingConnection.readyState,
            url: existingConnection.url,
          });
          eventSourceRef.current = existingConnection;
          registerConnection(currentJobId, existingConnection); // Increment mount count
          setIsConnected(true);
          return; // Don't create duplicate connection
        } else if (existingConnection.readyState === EventSource.CONNECTING) {
          // Connection is still connecting - wait for it
          console.log('[SSE] Connection already connecting, waiting...', {
            jobId: currentJobId,
            readyState: existingConnection.readyState,
          });
          eventSourceRef.current = existingConnection;
          registerConnection(currentJobId, existingConnection); // Increment mount count
          // Don't set isConnected yet - wait for onopen
          return; // Don't create duplicate connection
        }
        // Connection exists but is CLOSED - will be handled below (create new)
      }
      
      // ✅ CRITICAL FIX: EventSource cannot send Authorization header
      // Pass access token via query param (workaround for EventSource limitation)
      // TODO: Consider using a different SSE library that supports custom headers (e.g., fetch with ReadableStream)
      const url = `/api/video-factory/stream?jobId=${encodeURIComponent(currentJobId)}&token=${encodeURIComponent(accessToken)}`;
      console.log('[SSE] Creating new EventSource connection', { 
        jobId: currentJobId, 
        url: url.replace(accessToken, '***'), // Don't log token
        hasToken: !!accessToken,
        hint: 'Token passed via query param (EventSource cannot send Authorization header)',
      });
      const eventSource = new EventSource(url, {
        withCredentials: true, // Include cookies for auth (if available)
      });
      
      // ✅ CRITICAL FIX: Set ref BEFORE registering to prevent race conditions
      eventSourceRef.current = eventSource;
      
      // Register connection (with mount tracking)
      registerConnection(currentJobId, eventSource);

      eventSource.onopen = () => {
        console.log('[SSE] Connected to video factory stream', { jobId: currentJobId });
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0; // Reset reconnect counter on successful connection
        consecutiveErrorCountRef.current = 0; // ✅ CRITICAL FIX: Reset consecutive error count on successful connection
        
        // ✅ OPTIMIZATION: Clear any pending reconnect timeout since we're now connected
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // ✅ CRITICAL FIX: DISABLE polling when SSE connected (fix hybrid mode)
        // Polling will be skipped while SSE is active (check in polling interval)
        // This prevents redundant API calls and reduces server load
        console.log('[SSE] SSE connected - polling will be disabled while SSE active', { 
          jobId: currentJobId,
          hint: 'Polling disabled while SSE active - will resume if SSE disconnects',
        });
        // Note: Polling interval still runs, but will skip polls while isSSEConnected=true
      };

      eventSource.onerror = (e) => {
        console.error('[SSE] Connection error', { 
          jobId: currentJobId, 
          error: e, 
          readyState: eventSource.readyState,
          url: eventSource.url,
        });
        setIsConnected(false);
        
        // ✅ CRITICAL FIX: Check if error is due to Server B not available
        // If CONNECTION_REFUSED, disable SSE and rely on polling fallback
        const errorMessage = (e as any)?.message || '';
        const errorCode = (e as any)?.code || '';
        const isServerBUnavailable = 
          errorMessage.includes('CONNECTION_REFUSED') || 
          errorMessage.includes('fetch failed') ||
          errorCode === 'CONNECTION_REFUSED' ||
          (eventSource.url.includes('localhost:3001') && eventSource.readyState === EventSource.CLOSED);
        
        if (isServerBUnavailable && eventSource.readyState === EventSource.CLOSED) {
          console.warn('[SSE] Server B unavailable - disabling SSE, activating polling fallback', {
            jobId: currentJobId,
            errorMessage,
            errorCode,
            hint: 'Server B (localhost:3001) is not running. SSE disabled, polling will handle updates.',
          });
          // Activate polling fallback immediately
          activatePollingFallback('Server B unavailable - CONNECTION_REFUSED');
          // Set error to indicate SSE is disabled
          setError(new Error('Server B unavailable - using polling fallback'));
          // Close connection and don't reconnect
          if (eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
          // Unregister connection
          unregisterConnection(currentJobId);
          return;
        }
        
        // ✅ CRITICAL FIX: Don't reconnect if connection is still connecting or already closed by us
        // EventSource.onerror can fire multiple times, we need to be careful
        if (eventSource.readyState === EventSource.CONNECTING) {
          // Still connecting, wait - don't reconnect yet
          console.log('[SSE] Still connecting, waiting...', { jobId: currentJobId });
          return;
        }

        if (eventSource.readyState === EventSource.CLOSED) {
          // ✅ CRITICAL FIX: Check if this connection is still the active one
          // If we already have a new connection, don't reconnect
          const currentActiveConnection = getActiveConnection(currentJobId);
          if (currentActiveConnection && currentActiveConnection !== eventSource) {
            console.log('[SSE] New connection already exists, skipping reconnect', { jobId: currentJobId });
            return; // New connection already exists, don't reconnect old one
          }
          
          // Check if still enabled before reconnecting
          if (!enabledRef.current || !jobIdRef.current || jobIdRef.current !== currentJobId) {
            console.log('[SSE] Not reconnecting - disabled or jobId changed', {
              enabled: enabledRef.current,
              jobId: jobIdRef.current,
              currentJobId,
            });
            return; // Don't reconnect if disabled or jobId changed
          }
          
          // ✅ CRITICAL FIX: Prevent rapid reconnection loops
          // Only reconnect if we haven't exceeded max attempts and no reconnect is already scheduled
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            // Clear any existing timeout to prevent multiple reconnects
            if (reconnectTimeoutRef.current) {
              console.log('[SSE] Clearing existing reconnect timeout', { jobId: currentJobId });
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            reconnectAttemptsRef.current++;
            // ✅ CRITICAL FIX: Exponential backoff - delay increases exponentially: baseDelay * 2^attempt
            // Attempt 1: 10s * 2^1 = 20s
            // Attempt 2: 10s * 2^2 = 40s
            // Attempt 3: 10s * 2^3 = 80s
            // Attempt 4: 10s * 2^4 = 160s
            // Attempt 5: 10s * 2^5 = 320s (max ~5 minutes)
            const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
            console.log(`[SSE] Scheduling reconnect with exponential backoff... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}, delay: ${delay}ms = ${Math.round(delay/1000)}s)`, { jobId: currentJobId });
            
            reconnectTimeoutRef.current = setTimeout(() => {
              // ✅ CRITICAL FIX: Triple-check before reconnecting
              // 1. Check if still enabled
              // 2. Check if jobId hasn't changed
              // 3. Check if no new connection already exists
              if (!enabledRef.current || jobIdRef.current !== currentJobId) {
                console.log('[SSE] Reconnect cancelled - jobId changed or disabled', { 
                  enabled: enabledRef.current,
                  jobId: jobIdRef.current,
                  currentJobId,
                });
                return;
              }
              
              const existingConnection = getActiveConnection(currentJobId);
              if (existingConnection && existingConnection.readyState === EventSource.OPEN) {
                console.log('[SSE] Reconnect cancelled - connection already exists', { jobId: currentJobId });
                eventSourceRef.current = existingConnection;
                registerConnection(currentJobId, existingConnection);
                setIsConnected(true);
                return;
              }
              
              console.log('[SSE] Executing reconnect...', { jobId: currentJobId });
              connect();
            }, delay);
          } else {
          const err = new Error('SSE connection failed after max reconnect attempts - switching to polling-only mode');
          console.error('[SSE] Max reconnect attempts reached, activating polling fallback', err, { jobId: currentJobId });
          activatePollingFallback(err.message);
          }
        }
      };

      // Handle snapshot event (initial state)
      eventSource.addEventListener('snapshot', (e: MessageEvent) => {
        try {
          // ✅ CRITICAL FIX #1: Track message timestamp for stuck state detection
          lastMessageAtRef.current = Date.now();
          
          const data = JSON.parse(e.data) as VideoFactorySSEEvent;
          console.log('[SSE] Snapshot received', data);
          callbacksRef.current.onSnapshot?.(data);
        } catch (err) {
          console.error('[SSE] Failed to parse snapshot', err);
        }
      });

      // Handle step update events
      // Backend SSE events: step.waiting, step.running, step.completed, step.failed
      const stepEventNames = ['step.waiting', 'step.running', 'step.completed', 'step.failed'] as const;
      stepEventNames.forEach((eventName) => {
        eventSource.addEventListener(eventName, (e: MessageEvent) => {
          try {
            // ✅ CRITICAL FIX #1: Track message timestamp for stuck state detection
            lastMessageAtRef.current = Date.now();
            
            const raw = JSON.parse(e.data) as any;
            const data: VideoFactorySSEEvent = {
              event: 'step',
              version: 'v1',
              jobId: raw.jobId,
              step: raw.step,
              status: raw.status,
              progress: raw.progress,
              progressMessage: raw.reason,
              attempt: undefined,
              error: undefined,
              output: raw.output,
              // ✅ Postprocess step: BE gửi data.postprocess.clips (phân biệt với cut data.output.clips)
              postprocess: raw.postprocess,
              timestamp: Date.parse(raw.timestamp) || Date.now(),
            };
            // ✅ DEBUG: Step update - cut/thumbnail dùng output.clips, postprocess dùng postprocess.clips
            console.log('[SSE] Step update received', { 
              eventName, 
              step: raw.step,
              status: raw.status,
              hasOutput: !!raw.output,
              hasPostprocess: !!raw.postprocess,
              outputClipsCount: raw.output?.clips?.length || 0,
              postprocessClipsCount: raw.postprocess?.clips?.length || 0,
              isPartial: raw.output?.isPartial,
              data 
            });
            
            // ✅ CRITICAL FIX: Force refresh when critical steps complete
            // SSE payload may be minimal, need to fetch full data from API
            if (raw.status === 'completed' && raw.jobId) {
              const criticalSteps = ['cut', 'postprocess', 'thumbnail'];
              if (criticalSteps.includes(raw.step)) {
                console.log('[SSE] Critical step completed - forcing data refresh', { 
                  jobId: raw.jobId, 
                  step: raw.step 
                });
                try {
                  callbacksRef.current.onForceRefresh?.(raw.jobId);
                } catch (refreshErr) {
                  console.error('[SSE] onForceRefresh failed after step completion', refreshErr);
                }
              }
            }
            
            callbacksRef.current.onStepUpdate?.(data);
          } catch (err) {
            console.error('[SSE] Failed to parse step event', err);
          }
        });
      });

      // Handle progress update events (job.progress)
      eventSource.addEventListener('job.progress', (e: MessageEvent) => {
        try {
          // ✅ CRITICAL FIX #1: Track message timestamp for stuck state detection
          lastMessageAtRef.current = Date.now();
          
          const raw = JSON.parse(e.data) as any;
          const data: VideoFactorySSEEvent = {
            event: 'progress',
            version: 'v1',
            jobId: raw.jobId,
            step: raw.step,
            status: raw.status,
            progress: raw.progress,
            progressMessage: raw.reason,
            attempt: undefined,
            error: undefined,
            timestamp: Date.parse(raw.timestamp) || Date.now(),
          };
          console.log('[SSE] Progress update', data);
          callbacksRef.current.onProgress?.(data);
        } catch (err) {
          console.error('[SSE] Failed to parse progress event', err);
        }
      });

      // Handle job final/update events (status change, cancel, etc.)
      eventSource.addEventListener('job.final', (e: MessageEvent) => {
        try {
          const raw = JSON.parse(e.data) as any;
          const data: VideoFactorySSEEvent = {
            event: 'job',
            version: 'v1',
            jobId: raw.jobId,
            step: raw.step,
            status: raw.status,
            progress: raw.progress,
            progressMessage: raw.reason,
            attempt: undefined,
            error: undefined,
            timestamp: Date.parse(raw.timestamp) || Date.now(),
          };
          console.log('[SSE] Job final', data);
          
          // ✅ CRITICAL FIX: Force refresh when job completed to get full data
          // SSE payload may be minimal/truncated, need to fetch from API for canonical state
          if (raw.status === 'completed' && raw.jobId) {
            console.log('[SSE] Job completed - forcing data refresh', { jobId: raw.jobId });
            try {
              callbacksRef.current.onForceRefresh?.(raw.jobId);
            } catch (refreshErr) {
              console.error('[SSE] onForceRefresh failed after job completion', refreshErr);
            }
          }
          
          callbacksRef.current.onJobUpdate?.(data);
          
          // ✅ OPTIMIZATION: Close SSE connection when job is final (completed/failed/cancelled/abandoned)
          // No need to keep connection open for final states
          if (raw.status === 'completed' || raw.status === 'failed' || raw.status === 'cancelled' || raw.status === 'abandoned') {
            console.log('[SSE] Job is final, closing connection', { status: raw.status, jobId: currentJobId });
            setTimeout(() => {
              if (eventSourceRef.current === eventSource) {
                const wasClosed = unregisterConnection(currentJobId);
                if (wasClosed) {
                  // Connection was closed - clear ref
                  eventSourceRef.current = null;
                  setIsConnected(false);
                } else {
                  // Connection still active (other mounts) - just clear our ref
                  eventSourceRef.current = null;
                  setIsConnected(false);
                }
              }
            }, 1000); // Small delay to ensure final event is processed
          }
        } catch (err) {
          console.error('[SSE] Failed to parse job final event', err);
        }
      });

      eventSource.addEventListener('job.update', (e: MessageEvent) => {
        try {
          const raw = JSON.parse(e.data) as any;
          const data: VideoFactorySSEEvent = {
            event: 'job',
            version: 'v1',
            jobId: raw.jobId,
            step: raw.step,
            status: raw.status,
            progress: raw.progress,
            progressMessage: raw.reason,
            attempt: undefined,
            error: undefined,
            timestamp: Date.parse(raw.timestamp) || Date.now(),
          };
          console.log('[SSE] Job update', data);
          callbacksRef.current.onJobUpdate?.(data);
        } catch (err) {
          console.error('[SSE] Failed to parse job update event', err);
        }
      });

      // Handle error events
      // ✅ HARDENING: Parse error status codes to prevent unnecessary reconnects
      eventSource.addEventListener('error', async (e: MessageEvent) => {
        try {
          // ✅ CRITICAL FIX: Handle non-JSON error events gracefully
          let data: VideoFactorySSEEvent;
          try {
            data = JSON.parse(e.data) as VideoFactorySSEEvent;
          } catch (parseError) {
            // Error event may not be JSON - handle as string
            console.error('[SSE] Error event (non-JSON)', { 
              rawData: e.data, 
              parseError: parseError instanceof Error ? parseError.message : String(parseError),
            });
            // Create error object from raw data
            data = {
              event: 'error',
              version: 'v1',
              jobId: currentJobId,
              error: {
                message: typeof e.data === 'string' ? e.data : 'SSE error (non-JSON)',
              },
              timestamp: Date.now(),
            } as VideoFactorySSEEvent;
          }
          
          console.error('[SSE] Error event', data);
          
          // ✅ HARDENING: Check error status/code to determine if reconnect is needed
          const errorMessage = data.error?.message || 'SSE error';
          const errorCode = (data.error as any)?.code || '';
          const errorStatus = (data.error as any)?.status;
          const retryAfter = (data.error as any)?.retryAfter;
          const serverB = (data.error as any)?.serverB;
          
          // ✅ CRITICAL FIX: Check if error is due to Server B not available
          // If CONNECTION_REFUSED, disable SSE and rely on polling fallback
          const isServerBUnavailable = 
            errorCode === 'CONNECTION_REFUSED' ||
            errorMessage.includes('CONNECTION_REFUSED') ||
            errorMessage.includes('fetch failed') ||
            (serverB && errorMessage.includes('Failed to connect'));
          
          if (isServerBUnavailable) {
            console.warn('[SSE] Server B unavailable (from error event) - disabling SSE, activating polling fallback', {
              jobId: currentJobId,
              errorMessage,
              errorCode,
              serverB,
              hint: 'Server B is not running. SSE disabled, polling will handle updates.',
            });
            // Activate polling fallback immediately
            activatePollingFallback('Server B unavailable - CONNECTION_REFUSED');
            // Set error to indicate SSE is disabled
            setError(new Error('Server B unavailable - using polling fallback'));
            // Close connection and don't reconnect
            if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
              eventSourceRef.current.close();
            }
            // Unregister connection
            unregisterConnection(currentJobId);
            // Call error callback with Error object
            const err = new Error(errorMessage || 'Server B unavailable - CONNECTION_REFUSED');
            callbacksRef.current.onError?.(err);
            return;
          }
          
          // ✅ OPTIMIZATION: Handle rate limiting - respect retryAfter
          if (errorCode === 'RATE_LIMITED' || retryAfter) {
            const retryDelay = retryAfter ? retryAfter * 1000 : reconnectDelay * 2;
            const rateLimitedUntil = Date.now() + retryDelay;
            rateLimitedUntilRef.current = rateLimitedUntil;
            
            console.warn('[SSE] Rate limited, respecting retryAfter', { 
              errorCode, 
              retryAfter, 
              retryDelay,
              rateLimitedUntil: new Date(rateLimitedUntil).toISOString(),
              hint: 'Will reconnect after delay to respect rate limiting. SSE disabled until then.',
            });
            
            // Close current connection to prevent further errors
            if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
              eventSourceRef.current.close();
            }
            setIsConnected(false);
            
            // Don't increment reconnectAttempts for rate limiting
            // Schedule reconnect with longer delay
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              rateLimitedUntilRef.current = null; // Clear rate limit flag
              if (enabledRef.current && jobIdRef.current === currentJobId) {
                console.log('[SSE] Rate limit period expired, reconnecting...', { jobId: currentJobId });
                connect();
              }
            }, retryDelay);
            return; // Don't treat rate limiting as a real error
          }
          
          // ✅ IMPROVEMENT: Handle auth errors (401/403) - try to refresh token and reconnect
          if (errorStatus === 401 || errorStatus === 403 || 
              errorCode === 'UNAUTHORIZED' || errorMessage.includes('Unauthorized') || 
              errorMessage.includes('expired') || errorMessage.includes('token is expired')) {
            console.warn('[SSE] Auth error detected, attempting token refresh...', { 
              status: errorStatus, 
              code: errorCode,
              message: errorMessage,
              hint: 'Token may have expired - will try to refresh and reconnect',
            });
            
            // Try to refresh token and reconnect
            try {
              const { data: { session: refreshedSession }, error: refreshError } = await supabaseClient.auth.refreshSession();
              
              if (refreshError || !refreshedSession) {
                // Token refresh failed - require re-auth
                const err = new Error('Unauthorized - token refresh failed. Please sign in again.');
                console.error('[SSE] Token refresh failed, disabling SSE', { 
                  refreshError: refreshError?.message,
                  hint: 'User needs to sign in again',
                });
                setError(err);
                callbacksRef.current.onError?.(err);
                enabledRef.current = false; // Disable SSE - require re-auth
                reconnectAttemptsRef.current = maxReconnectAttempts;
                return;
              }
              
              // Token refreshed successfully - reconnect with new token
              console.log('[SSE] Token refreshed successfully, reconnecting...', {
                newExpiresAt: refreshedSession.expires_at,
                hint: 'Will reconnect with new token',
              });
              
              // Reset reconnect attempts to allow reconnect with new token
              reconnectAttemptsRef.current = 0;
              
              // Schedule reconnect with new token (after a short delay)
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
              }
              
              reconnectTimeoutRef.current = setTimeout(() => {
                if (enabledRef.current && jobIdRef.current === currentJobId) {
                  console.log('[SSE] Reconnecting with refreshed token...', { jobId: currentJobId });
                  connect(); // Reconnect with new token
                }
              }, 1000); // 1 second delay before reconnect
              
              return; // Don't treat as error - will reconnect
            } catch (refreshException) {
              // Token refresh exception - require re-auth
              const err = new Error('Unauthorized - token refresh exception. Please sign in again.');
              console.error('[SSE] Token refresh exception, disabling SSE', refreshException);
              setError(err);
              callbacksRef.current.onError?.(err);
              enabledRef.current = false; // Disable SSE - require re-auth
              reconnectAttemptsRef.current = maxReconnectAttempts;
              return;
            }
          }
          
          // Don't reconnect for not-found errors (404/410)
          if (errorStatus === 404 || errorStatus === 410 || 
              errorCode === 'NOT_FOUND' || errorMessage.includes('not found')) {
            const err = new Error('Job not found or gone');
            console.error('[SSE] Job not found, stopping reconnect', { status: errorStatus, code: errorCode });
            setError(err);
            callbacksRef.current.onError?.(err);
            // Stop reconnect attempts
            reconnectAttemptsRef.current = maxReconnectAttempts;
            return;
          }
          
          // Other errors - allow reconnect (network issues, etc.)
          const err = new Error(errorMessage);
          setError(err);
          callbacksRef.current.onError?.(err);
          
          // ✅ CRITICAL FIX: Track consecutive errors and switch to polling after 3 errors
          consecutiveErrorCountRef.current++;
          if (consecutiveErrorCountRef.current >= maxConsecutiveErrors) {
            console.warn('[SSE] Too many consecutive errors, switching to polling', {
              consecutiveErrors: consecutiveErrorCountRef.current,
              maxErrors: maxConsecutiveErrors,
            });
            activatePollingFallback(`SSE errors exceeded threshold (${consecutiveErrorCountRef.current} consecutive errors)`);
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            // If reconnect attempts also hit max, switch to polling
            activatePollingFallback('SSE errors exceeded max retries');
          }
        } catch (err) {
          console.error('[SSE] Failed to parse error event', err);
        }
      });

      // Handle generic message (fallback)
      eventSource.onmessage = (e: MessageEvent) => {
        try {
          // ✅ CRITICAL FIX #1: Track message timestamp for stuck state detection
          lastMessageAtRef.current = Date.now();
          
          const data = JSON.parse(e.data) as VideoFactorySSEEvent;
          
          // ✅ DEBUG: Log all SSE events to debug missing clips
          console.log('[SSE] Message received', {
            event: data.event,
            step: data.step,
            status: data.status,
            jobId: data.jobId || (data as any).job_id || (data as any).id,
            hasOutput: !!(data.output),
            outputKeys: data.output ? Object.keys(data.output) : [],
            clipsCount: data.output?.clips?.length || data.output?.segments?.length || 0,
            clipsPreview: data.output?.clips?.slice(0, 2).map((c: any) => ({
              index: c.index,
              status: c.status,
              hasUrl: !!(c.publicUrl || c.url),
              hasStorageKey: !!(c.storageKey || c.key),
            })),
            hint: 'SSE event received - will process if jobId matches',
          });
          
          // ✅ CRITICAL FIX: Validate jobId match before processing any event
          // This prevents processing events from different jobs (race condition when jobId changes)
          const eventJobId = data.jobId || (data as any).job_id || (data as any).id;
          const currentJobId = jobIdRef.current;
          if (eventJobId && currentJobId && eventJobId !== currentJobId) {
            console.warn('[SSE] Ignoring event from different job', {
              eventJobId,
              currentJobId,
              event: data.event,
              step: data.step,
              status: data.status,
              hint: 'This prevents mixing events from different jobs',
            });
            return; // Ignore events from different job
          }
          
          // Early-exit UX: if cut step already completed, stop SSE/polling and surface completion
          const cutDone =
            data.step === 'cut' && data.status === 'completed' ||
            (data.steps && data.steps.cut && data.steps.cut.status === 'completed');
          if (cutDone) {
            console.log('[SSE] Cut step completed - stopping SSE and marking job done', {
              jobId: data.jobId,
              step: data.step,
              status: data.status,
            });

            // ✅ NEW: Force-refresh canonical job data on cut completion
            // SSE payload may not contain full clips array / thumbnails / URLs
            // → Let FE immediately call GET /jobs/:id to hydrate from source of truth.
            if (data.jobId) {
              try {
                callbacksRef.current.onForceRefresh?.(data.jobId);
              } catch (forceErr) {
                console.error('[SSE] onForceRefresh callback failed', forceErr);
              }
            }

            callbacksRef.current.onStepUpdate?.(data);
            callbacksRef.current.onJobUpdate?.({
              ...data,
              event: 'job',
              status: 'completed',
              progress: 100,
              progressMessage: data.progressMessage || 'Cut completed',
            });
            disconnect(); // stop SSE; hook already falls back to polling if needed
            return;
          }

          // Route to appropriate handler based on event type
          switch (data.event) {
            case 'snapshot':
              callbacksRef.current.onSnapshot?.(data);
              break;
            case 'step':
              callbacksRef.current.onStepUpdate?.(data);
              break;
            case 'progress':
              callbacksRef.current.onProgress?.(data);
              break;
            case 'job':
              callbacksRef.current.onJobUpdate?.(data);
              break;
            case 'error':
              const err = new Error(data.error?.message || 'SSE error');
              setError(err);
              callbacksRef.current.onError?.(err);
              break;
          }
        } catch (err) {
          console.error('[SSE] Failed to parse message', err);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err: any) {
      console.error('[SSE] Failed to connect', err);
      const error = err instanceof Error ? err : new Error('Failed to connect to SSE stream');
      setError(error);
      callbacksRef.current.onError?.(error);
    }
  }, []); // Empty deps - use refs for jobId/enabled to prevent reconnect loops

  // ✅ CRITICAL FIX: Use refs to track previous values and prevent unnecessary re-renders
  const prevJobIdRef = useRef<string | null | undefined>(jobId);
  const prevEnabledRef = useRef<boolean>(enabled);

  // Connect when jobId or enabled changes
  useEffect(() => {
    // ✅ CRITICAL FIX: Only run if jobId or enabled actually changed
    // This prevents unnecessary re-renders when parent component re-renders with same values
    //
    // ✅ CRITICAL FIX (2026-02-05): Also check if connection is still alive.
    // React re-render batching or StrictMode can cause cleanup to close the connection,
    // but on the next effect run prevRefs still match → effect skips → connection never re-established.
    // This caused postprocess SSE to die immediately after connecting (skeleton loading forever).
    const connectionStillAlive = eventSourceRef.current &&
      eventSourceRef.current.readyState !== EventSource.CLOSED;
    const hasActiveGlobalConnection = jobId ? !!getActiveConnection(jobId) : false;

    if (prevJobIdRef.current === jobId && prevEnabledRef.current === enabled) {
      // Values haven't changed - but check if we NEED to reconnect
      if (jobId && enabled && !connectionStillAlive && !hasActiveGlobalConnection) {
        // Connection was lost (cleanup ran, StrictMode, or network error) - reconnect
        console.log('[SSE] Values unchanged but connection lost - reconnecting', {
          jobId,
          enabled,
          readyState: eventSourceRef.current?.readyState,
          hasGlobalConnection: hasActiveGlobalConnection,
          hint: 'Connection was closed by cleanup/StrictMode but refs still match',
        });
        // Fall through to connection logic below
      } else {
        // Values haven't changed AND connection is still alive - skip
        return;
      }
    }

    // Update refs with current values
    prevJobIdRef.current = jobId;
    prevEnabledRef.current = enabled;

    if (!jobId || !enabled) {
      // Cleanup if disabled or no jobId
      console.log('[SSE] Cleaning up - no jobId or disabled', { jobId, enabled });
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        const currentJobIdForCleanup = jobIdRef.current;
        if (currentJobIdForCleanup) {
          const wasClosed = unregisterConnection(currentJobIdForCleanup);
          if (wasClosed) {
            // Connection was closed (last mount) - already closed by unregisterConnection
            eventSourceRef.current = null;
          } else {
            // Connection still active (other mounts) - just clear our ref
            eventSourceRef.current = null;
          }
        }
      }
      setIsConnected(false);
      return;
    }

    // ✅ OPTIMIZATION: Only connect if not already connected to the same jobId
    // ✅ CRITICAL FIX: Check activeConnections Map first to prevent duplicate connections
    const existingActiveConnection = getActiveConnection(jobId);
    if (existingActiveConnection && existingActiveConnection.readyState === EventSource.OPEN) {
      // Connection already exists and is open - reuse it
      console.log('[SSE] Reusing existing active connection', { jobId, readyState: existingActiveConnection.readyState });
      eventSourceRef.current = existingActiveConnection;
      registerConnection(jobId, existingActiveConnection); // Increment mount count
      setIsConnected(true);
      return; // Don't create new connection
    }
    
    const currentConnection = eventSourceRef.current;
    if (!currentConnection || currentConnection.readyState === EventSource.CLOSED) {
      console.log('[SSE] No connection or closed, connecting...', { jobId });
      connect();
    } else if (currentConnection.readyState === EventSource.OPEN) {
      // Already connected - check if jobId matches
      const currentUrl = currentConnection.url;
      const expectedJobId = encodeURIComponent(jobId);
      if (!currentUrl.includes(`jobId=${expectedJobId}`)) {
        // JobId changed - close old connection and connect to new jobId
        console.log('[SSE] JobId changed, reconnecting...', { oldUrl: currentUrl, newJobId: jobId });
        const oldJobId = jobIdRef.current;
        if (oldJobId) {
          unregisterConnection(oldJobId);
        }
        currentConnection.close();
        eventSourceRef.current = null;
        connect();
      } else {
        // Already connected to the same jobId - no action needed
        console.log('[SSE] Already connected to same jobId', { jobId });
      }
    } else if (currentConnection.readyState === EventSource.CONNECTING) {
      // Still connecting - wait, don't create another connection
      console.log('[SSE] Still connecting, waiting...', { jobId });
    }

    // Cleanup on unmount or jobId/enabled change
    return () => {
      console.log('[SSE] Cleanup effect', { jobId, enabled });
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        const currentJobIdForCleanup = jobIdRef.current;
        if (currentJobIdForCleanup) {
          const wasClosed = unregisterConnection(currentJobIdForCleanup);
          if (wasClosed) {
            // Connection was closed (last mount) - already closed by unregisterConnection
            eventSourceRef.current = null;
          } else {
            // Connection still active (other mounts) - just clear our ref
            eventSourceRef.current = null;
          }
        }
      }
      setIsConnected(false);
      setError(null);
      
      // ✅ CRITICAL FIX: Cleanup polling interval on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // ✅ NEW: Clear rate limit tracking on unmount
      rateLimitedUntilRef.current = null;
    };
  }, [jobId, enabled]); // ✅ FIX: Remove 'connect' from deps - it's stable (empty deps useCallback)

  // Manual disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      const currentJobIdForDisconnect = jobIdRef.current;
      if (currentJobIdForDisconnect) {
        const wasClosed = unregisterConnection(currentJobIdForDisconnect);
        if (wasClosed) {
          // Connection was closed (last mount) - already closed by unregisterConnection
          eventSourceRef.current = null;
        } else {
          // Connection still active (other mounts) - just clear our ref
          eventSourceRef.current = null;
        }
      }
    }
    setIsConnected(false);
  }, []);

  return {
    isConnected,
    error,
    isPollingFallback,
    disconnect,
    reconnect: connect,
    // ✅ CRITICAL FIX #1 (Hidden Issue): Expose lastMessageAt for stuck state detection
    // This allows VideoFactoryModal to distinguish between "stuck connection" (no messages) vs "long running step" (messages still coming)
    lastMessageAt: lastMessageAtRef.current,
  };
}
