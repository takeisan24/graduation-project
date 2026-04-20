"use client"

import { memo } from "react"
import dynamic from "next/dynamic"
import { useNavigationStore } from "@/store"
import SectionLoader from "@/components/shared/section-loader"

// Lazy load sections — only the active section's bundle is loaded
const CreateSection = dynamic(() => import("./CreateSection"), { loading: () => <SectionLoader /> })
const CalendarSection = dynamic(() => import("./calendar/CalendarSection"), { loading: () => <SectionLoader /> })
const DraftsSection = dynamic(() => import("./drafts/DraftsSection"), { loading: () => <SectionLoader /> })
const PublishedSection = dynamic(() => import("./published/PublishedSection"), { loading: () => <SectionLoader /> })
const FailedSection = dynamic(() => import("./failed/FailedSection"), { loading: () => <SectionLoader /> })
const ConnectionsSection = dynamic(() => import("./connections/SettingsSection"), { loading: () => <SectionLoader /> })
const SystemSettingsSection = dynamic(() => import("./settings/SystemSettingsSection"), { loading: () => <SectionLoader /> })
const ProfileSection = dynamic(() => import("./profile/ProfileSection"), { loading: () => <SectionLoader /> })
const OperationsSection = dynamic(() => import("./operations/ApiDashboard"), { loading: () => <SectionLoader /> })

function SectionsManager() {
  const activeSection = useNavigationStore((state) => state.activeSection);

  switch (activeSection) {
    case "connections":
      return <ConnectionsSection />
    case "settings":
      return <SystemSettingsSection />
    case "profile":
      return <ProfileSection />
    case "calendar":
      return <CalendarSection />
    case "drafts":
      return <DraftsSection />
    case "published":
      return <PublishedSection />
    case "failed":
      return <FailedSection />
    case "operations":
      return <OperationsSection />
    case "create":
    default:
      return <CreateSection />
  }
}

export default memo(SectionsManager);
