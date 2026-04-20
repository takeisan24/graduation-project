/**
 * Hook to check pending scheduled posts when component mounts
 * This is a fallback mechanism when webhook is not called by getlate.dev
 */
import { useEffect, useRef } from 'react';
import { checkPendingPostsWithStores } from '@/store/shared/statusCheck';

// Module-level flag to prevent duplicate calls across all component instances
let hasCheckedPendingPosts = false;
let checkTimer: NodeJS.Timeout | null = null;

export function useCheckPendingPosts() {
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls: only check once per page load
    if (hasRunRef.current || hasCheckedPendingPosts) {
      return;
    }

    // Mark as checked immediately to prevent duplicate calls
    hasRunRef.current = true;
    hasCheckedPendingPosts = true;

    // Check pending posts when component mounts (user enters the page)
    // Wait a bit for session to be ready
    checkTimer = setTimeout(() => {
      checkPendingPostsWithStores();
    }, 2000); // Wait 2 seconds for session/auth to be ready

    return () => {
      if (checkTimer) {
        clearTimeout(checkTimer);
        checkTimer = null;
      }
      // Reset flag when component unmounts (user navigates away)
      // This allows checking again when user returns to the page
      hasCheckedPendingPosts = false;
    };
  }, []); // Empty dependency array - only run once on mount
}

