"use client"

import { ReactNode } from "react"
import { LucideIcon } from "lucide-react"

interface SectionHeaderProps {
  icon: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
}

export default function SectionHeader({ icon: Icon, title, description, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 lg:px-6 py-4 border-b border-border/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-utc-royal to-utc-sky flex items-center justify-center flex-shrink-0">
          <Icon className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight truncate">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
