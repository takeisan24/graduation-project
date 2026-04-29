"use client"

import CreateLayout from "@/components/features/create/layout/CreateLayout"
import UserProfile from "@/components/features/user/UserProfile"
import { useEffect, useState } from "react"
import { useNavigationStore } from "@/store"
import { useRequireAuth } from "@/hooks/useRequireAuth"

export default function ProfilePage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const setActiveSection = useNavigationStore((state) => state.setActiveSection)
    const { loading: authLoading, isAuthenticated } = useRequireAuth()

    useEffect(() => {
        setActiveSection("profile")
    }, [setActiveSection])

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
                    <p className="text-muted-foreground">Redirecting...</p>
                </div>
            </div>
        )
    }
    
    return (
        <CreateLayout
            activeSection="profile"
            onSectionChange={setActiveSection}
            isSidebarOpen={isSidebarOpen}
            onSidebarToggle={setIsSidebarOpen}
        >
            <div className="h-full overflow-y-auto bg-background">
                <UserProfile />
            </div>
        </CreateLayout>
    )
}
