"use client"

import { memo } from "react"
import { useNavigationStore } from "@/store"

import ApiDashboardSection from "./api-dashboard/ApiDashboard"
import CreateSection from "./CreateSection"
import CalendarSection from "./calendar/CalendarSection"
import DraftsSection from "./drafts/DraftsSection"
import FailedSection from "./failed/FailedSection"
import PublishedSection from "./published/PublishedSection"
import SettingsSection from "./settings/SettingsSection"
import VideosSection from "./videos/VideosSection"

/**
 * Main sections manager component that renders the appropriate section based on activeSection
 * Centralizes all section components and their props
 * Uses switch statement for conditional rendering (components unmount/mount on section change)
 * Memoized to prevent unnecessary re-renders when parent re-renders
 */
function SectionsManager() {
  const activeSection = useNavigationStore((state) => state.activeSection);

  switch (activeSection) {
    case "settings":
      return <SettingsSection />

    case "calendar":
      return (
        <CalendarSection />
      )

    case "drafts":
      return (
        <DraftsSection />
      )

    case "published":
      return (
        <PublishedSection />
      )

    case "failed":
      return (
        <FailedSection />
      )

    case "videos":
      return (
        <VideosSection />
      )

    case "api-dashboard":
      return (
        <ApiDashboardSection />
      )

    case "create":
    default:
      return (
        <CreateSection />
      )
  }
}

// Memoize to prevent re-renders when parent re-renders but activeSection hasn't changed
export default memo(SectionsManager);