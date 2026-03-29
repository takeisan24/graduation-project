"use client"

import { ReactNode, memo } from "react"
import TopBar from "./TopBar"
import Sidebar from "./Sidebar"
import { useNavigationStore } from '@/store'
import ModalManager from "../modals/ModalManager"

interface CreateLayoutProps {
  children: ReactNode
  activeSection: string
  onSectionChange: (section: string) => void
  isSidebarOpen: boolean
  onSidebarToggle: (isOpen: boolean) => void
}

function CreateLayout({
  children,
  activeSection,
  onSectionChange,
  isSidebarOpen,
  onSidebarToggle,
}: CreateLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* TopBar - fixed top */}
      <TopBar onMobileMenuToggle={() => onSidebarToggle(!isSidebarOpen)} />

      {/* Main area: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - temporarily keeping old sidebar, Phase 2 will replace with SlimSidebar */}
        <Sidebar
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={onSidebarToggle}
        />

        {/* Sidebar spacer for desktop */}
        <div className="hidden lg:block flex-none w-[79px]" />

        {/* Main content */}
        <div className="flex-1 min-w-0 h-full">
          {children}
        </div>
      </div>

      <ModalManager />
    </div>
  )
}

export default memo(CreateLayout);
