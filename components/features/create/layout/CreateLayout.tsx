"use client"

import { ReactNode, memo } from "react"
import TopBar from "./TopBar"
import SlimSidebar from "./SlimSidebar"
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
      {/* TopBar */}
      <TopBar onMobileMenuToggle={() => onSidebarToggle(!isSidebarOpen)} />

      {/* Main area: SlimSidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <SlimSidebar
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={onSidebarToggle}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          {children}
        </div>
      </div>

      <ModalManager />
    </div>
  )
}

export default memo(CreateLayout);
