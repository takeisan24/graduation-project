"use client"

import { ReactNode, memo } from "react"
import Sidebar from "./Sidebar"
import { useNavigationStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import ModalManager from "../modals/ModalManager"
import { usePlanModal } from "@/hooks/usePlanModal"
import DebugPlanModal from "./DebugPlanModal"
import { useTopUpModal } from "@/hooks/useTopUpModal"
import TopUpModal from "./TopUpModal"
import PaymentConfirmationModal from "../modals/PaymentConfirmationModal"

interface CreateLayoutProps {
  children: ReactNode
  activeSection: string
  onSectionChange: (section: string) => void
  isSidebarOpen: boolean
  onSidebarToggle: (isOpen: boolean) => void
}

/**
 * Main layout wrapper for the create page
 * Combines sidebar and main content with consistent styling
 * Memoized to prevent unnecessary re-renders
 */
function CreateLayout({ 
  children, 
  activeSection, 
  onSectionChange, 
  isSidebarOpen, 
  onSidebarToggle,
}: CreateLayoutProps) {
  // Plan modal state
  const planModal = usePlanModal();
  
  // Top-up modal state
  const topUpModal = useTopUpModal();
  
  // Get wizard state to adjust z-index
  return (
    <div className="h-full bg-[#0C0717] text-white">
      {/* Sidebar - Always render (hamburger button needs to be in DOM) */}
      <Sidebar 
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={onSidebarToggle}
        onPlanModalClick={planModal.handlePlanAreaClick}
        onTopUpClick={topUpModal.handleTopUpClick}
      />
      
      <div className="relative flex h-screen overflow-hidden">
        {/* Sidebar spacer - only visible on desktop to reserve space */}
        <div className="hidden lg:block relative flex-none w-[79px] h-full"></div>
        
        {/* Main content - full width on mobile, minus sidebar on desktop */}
        <div className="flex-1 min-w-0 h-full w-full lg:w-auto">
          {children}
        </div>
      </div>
      
      {/* ModalManager - Render at layout level so modals work across all sections */}
      <ModalManager />
      
      {/* Debug Plan Modal - Rendered at top level for proper overlay */}
      {/* <DebugPlanModal
        isOpen={planModal.isPlanModalOpen}
        onClose={planModal.handlePlanModalClose}
        selectedPlan={planModal.selectedPlan}
        onPlanChange={planModal.setSelectedPlan}
        creditsToAdd={planModal.creditsToAdd}
        onCreditsChange={planModal.setCreditsToAdd}
        onSubmit={planModal.handlePlanSubmit}
        isSubmitting={planModal.isSubmittingPlan}
        planOptions={planModal.planOptions}
      /> */}
      
      {/* Top-Up Modal - Rendered at top level for proper overlay */}
      {/* Top-Up Modal - Rendered at top level for proper overlay */}
      <TopUpModal
        isOpen={topUpModal.isTopUpModalOpen}
        onClose={topUpModal.handleCloseModal}
        creditPackages={topUpModal.creditPackages}
        onBuyCredits={topUpModal.handleBuyCredits}
      />

       {/* Payment Modal */}
       <PaymentConfirmationModal
        isOpen={topUpModal.isPaymentModalOpen}
        onClose={topUpModal.handleClosePaymentModal}
        order={topUpModal.currentOrder}
       />
    </div>
  )
}

// Memoize to prevent re-renders when props haven't changed
// Note: children prop changes will still cause re-renders, but other props are memoized
export default memo(CreateLayout);

