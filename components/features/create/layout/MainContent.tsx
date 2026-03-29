"use client"

import { ReactNode, memo } from "react"

interface MainContentProps {
  activeSection: string
  children: ReactNode
}

function MainContent({ activeSection, children }: MainContentProps) {
  void activeSection

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {children}
    </div>
  )
}

export default memo(MainContent);
