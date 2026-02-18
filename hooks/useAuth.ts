"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabaseClient } from "@/lib/supabaseClient"
import type { User, Session } from "@supabase/supabase-js"
import { clearLocalStorage } from "@/lib/utils/storage"

// Biến global chỉ để chặn việc gọi API dữ liệu nặng nhiều lần
// KHÔNG dùng để chặn việc kiểm tra session đăng nhập
let hasHydratedData = false;

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Dùng ref để tránh update state khi component đã unmount
  const mounted = useRef(false)

  // Logic nghiệp vụ: Load dữ liệu nặng (Credits, Posts...)
  const hydrateStores = async (currentSession: Session) => {
    if (hasHydratedData) return; // Nếu đã load rồi thì thôi
    hasHydratedData = true;      // Đánh dấu đã load

    try {
      // Load các store khác
      const { useConnectionsStore, usePublishedPostsStore, useFailedPostsStore } = await import('@/store');

      // Chạy nền, không cần await blocking UI
      Promise.allSettled([
        useConnectionsStore.getState().refreshConnectedAccounts(),
        usePublishedPostsStore.getState().loadPublishedPosts(),
        useFailedPostsStore.getState().loadFailedPosts()
      ]);
    } catch (e) {
      console.warn('[useAuth] Hydration error:', e);
      hasHydratedData = false; // Reset nếu lỗi để thử lại lần sau
    }
  };

  useEffect(() => {
    mounted.current = true;

    // Hàm kiểm tra session - Luôn chạy mỗi khi component mount
    const checkSession = async () => {
      try {
        // Lấy session từ LocalStorage (Rất nhanh, không tốn mạng)
        const { data: { session: currentSession }, error } = await supabaseClient.auth.getSession();

        if (mounted.current) {
          if (error) throw error;

          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          // Chỉ gọi logic nặng nếu có session và chưa từng gọi trước đó
          if (currentSession && !hasHydratedData) {
            hydrateStores(currentSession);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        // QUAN TRỌNG: Chỉ set loading = false SAU KHI đã set User/Session xong
        if (mounted.current) {
          setLoading(false);
        }
      }
    };

    checkSession();

    // Lắng nghe sự kiện thay đổi auth
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted.current) return;

      // Bỏ qua event initial để tránh render thừa (vì checkSession đã làm rồi)
      if (event === 'INITIAL_SESSION') return;

      // Xử lý SIGNED_IN: Chỉ hydrate lại nếu thực sự là đăng nhập mới (người dùng khác hoặc phiên trước đó null)
      if (event === 'SIGNED_IN' && currentSession) {
        // Kiểm tra xem có phải user cũ không
        const isSameUser = user?.id === currentSession.user.id;

        setSession(currentSession);
        setUser(currentSession.user);
        setLoading(false);

        // Strict check: Only hydrate if USER ID CHANGED.
        // If it's the same user, it's just a session re-validation or token refresh that Supabase labeled as SIGNED_IN.
        if (!isSameUser) {
          console.log('[useAuth] New user detected, hydrating stores');
          hasHydratedData = false;
          hydrateStores(currentSession);
          router.refresh();
        } else {
          // If same user, checking hasHydratedData to be extra safe, but primarily relying on isSameUser check.
          // If not hydrated yet for this user (unlikely if isSameUser is true), hydrate.
          if (!hasHydratedData) {
            console.log('[useAuth] Same user but missing data, hydrating');
            hydrateStores(currentSession);
          } else {
            console.log('[useAuth] Session valid for same user, skipping re-hydration');
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setLoading(false);

        hasHydratedData = false;
        clearLocalStorage();
        const { resetAllStores } = await import('@/lib/utils/storeReset');
        resetAllStores();
        // Redirect về trang chủ mới
        window.location.href = '/';
      } else {
        // Các event khác (TOKEN_REFRESHED, etc.) - chỉ cập nhật session
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [router, user?.id]); // Thêm user?.id vào dependency để so sánh

  // Các hàm tiện ích giữ nguyên
  const signOut = async () => {
    try {
      setLoading(true);
      await supabaseClient.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    const { data, error } = await supabaseClient.auth.refreshSession();
    if (error) throw error;
    if (mounted.current) {
      setSession(data.session);
      setUser(data.user);
    }
    return data.session;
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signOut,
    refreshSession,
  }
}