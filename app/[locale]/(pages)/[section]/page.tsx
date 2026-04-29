"use client"

import CreateLayout from "@/components/features/create/layout/CreateLayout"
import MainContent from "@/components/features/create/layout/MainContent"
import SectionsManager from "@/components/features/create/SectionsManager"
import PageLoader from "@/components/shared/page-loader"

import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigationStore } from "@/store"
import { useShallow } from 'zustand/react/shallow'
import { useRequireAuth } from "@/hooks/useRequireAuth"
import { useCheckPendingPosts } from "@/lib/hooks/useCheckPendingPosts"
import { getSectionHref, normalizeSectionRoute } from "@/lib/navigation/sectionRoutes"
import { useRouter } from "@/i18n/navigation"

/**
 * SectionPage component - handles routing for different sections (create, settings, etc.)
 * Optimized to prevent unnecessary re-renders and API calls
 */
export default function SectionPage({ params }: { params: { section: string } }) {
  // Protect route - require authentication
  const { loading: authLoading, isAuthenticated } = useRequireAuth()
  const router = useRouter()
  
  // Check pending scheduled posts when user enters the page (fallback when webhook is not called)
  // This hook automatically checks posts that should have been posted but webhook was not received
  useCheckPendingPosts()
  // Luôn bắt đầu với isInitialLoad = true để tránh hydration mismatch

  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isMounted, setIsMounted] = useState(false)  
  // Dùng useShallow để component chỉ re-render khi một trong các giá trị này thay đổi,
  // thay vì re-render mỗi khi bất kỳ giá trị nào khác trong store thay đổi.
  const { setActiveSection, isSidebarOpen, setIsSidebarOpen } = useNavigationStore(
    useShallow((state) => ({
      setActiveSection: state.setActiveSection,
      isSidebarOpen: state.isSidebarOpen,
      setIsSidebarOpen: state.setIsSidebarOpen,
    }))
  );
  /**
   * Memoize sectionFromUrl to prevent unnecessary re-renders
   * params.section should be stable, but memoizing ensures consistency
   */
  const sectionFromUrl = useMemo(() => normalizeSectionRoute(params.section), [params.section]);
  
  const lastSectionRef = useRef<string | null>(null);
  

  // Mount effect - check sessionStorage sau khi mounted
  useEffect(() => {
    setIsMounted(true)
    const hasLoadedApp = sessionStorage.getItem('hasLoadedApp') === 'true'

    if (lastSectionRef.current === sectionFromUrl) {
      return;
    }
    
    if (hasLoadedApp) {
      // Đã load app rồi, skip PageLoader
      setIsInitialLoad(false)
    } else {
      // Lần đầu load, show PageLoader
      const timer = setTimeout(() => {
        setIsInitialLoad(false)
        sessionStorage.setItem('hasLoadedApp', 'true')
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [sectionFromUrl])

  useEffect(() => {
    const normalizedSection = normalizeSectionRoute(params.section)
    if (!isMounted || isInitialLoad || params.section === normalizedSection) return
    router.replace(getSectionHref(normalizedSection))
  }, [isInitialLoad, isMounted, params.section, router])

  // Section change effect - chạy khi section thay đổi
  useEffect(() => {
    // Skip nếu chưa mounted hoặc vẫn đang initial load
    if (!isMounted || isInitialLoad) return
    
    // Đóng sidebar khi chuyển section
    setIsSidebarOpen(false);
    
    // Cập nhật section trong store
    const currentState = useNavigationStore.getState().activeSection;
    if (sectionFromUrl && sectionFromUrl !== currentState) {
      setActiveSection(sectionFromUrl);
    }

    lastSectionRef.current = sectionFromUrl;

  }, [sectionFromUrl, setActiveSection, setIsSidebarOpen, isInitialLoad, isMounted]);

  /**
   * Support data hydration is intentionally kept lightweight here.
   * Workspace sections fetch their own operational data when needed.
   */

  // Show full page loader only on first session load
  if (!isMounted || isInitialLoad) {
    return <PageLoader />
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <CreateLayout
      activeSection={sectionFromUrl}
      onSectionChange={setActiveSection}
      isSidebarOpen={isSidebarOpen}
      onSidebarToggle={setIsSidebarOpen}
    >
      <MainContent activeSection={sectionFromUrl}>
        <SectionsManager />
      </MainContent>
    </CreateLayout>
  )
}
