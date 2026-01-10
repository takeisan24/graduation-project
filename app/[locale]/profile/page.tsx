"use client"

import CreateLayout from "@/components/features/create/layout/CreateLayout"
import UserProfile from "@/components/features/user/UserProfile"
import { useState } from "react"

export default function ProfilePage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    
    return (
        <CreateLayout
            activeSection="profile"
            onSectionChange={() => {}}
            isSidebarOpen={isSidebarOpen}
            onSidebarToggle={setIsSidebarOpen}
        >
            <div className="h-full overflow-y-auto bg-[#0C0717]">
                <UserProfile />
            </div>
        </CreateLayout>
    )
}
