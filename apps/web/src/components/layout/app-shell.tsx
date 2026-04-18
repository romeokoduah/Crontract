"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        role={session?.user?.role}
      />
      <div
        className={cn(
          "transition-all duration-200",
          collapsed ? "ml-14" : "ml-60"
        )}
      >
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
