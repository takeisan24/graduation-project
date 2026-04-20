"use client"

import CreateLayout from "@/components/features/create/layout/CreateLayout"
import UserProfile from "@/components/features/user/UserProfile"
import { useEffect, useState } from "react"
import { useNavigationStore } from "@/store"

export default function ProfilePage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const setActiveSection = useNavigationStore((state) => state.setActiveSection)

    useEffect(() => {
        setActiveSection("profile")
    }, [setActiveSection])
    
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
