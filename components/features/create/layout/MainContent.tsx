"use client"

import { ReactNode, memo } from "react"

interface MainContentProps {
  /**
   * The currently active section key; used for conditional styles or future logic
   */
  activeSection: string
  /**
   * Child nodes to render inside the main content area
   */
  children: ReactNode
}

/**
 * MainContent
 *
 * Wrapper for the primary content area next to the sidebar. This centralizes
 * layout styling so the page can remain focused on composition. Exposes
 * `activeSection` for potential contextual UI adjustments (e.g., breadcrumbs,
 * sticky headers, etc.).
 * Memoized to prevent unnecessary re-renders
 */
function MainContent({ activeSection, children }: MainContentProps) {
  // NOTE: `activeSection` is currently unused visually, but is kept here to
  // make it easy to adjust the layout based on context without refactoring
  // consumers.
  void activeSection

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden h-full">
      {children}
    </div>
  )
}

// Memoize to prevent re-renders when props haven't changed
// Note: children prop changes will still cause re-renders, but activeSection is memoized
export default memo(MainContent);


