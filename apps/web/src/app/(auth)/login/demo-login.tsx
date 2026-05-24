"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { Loader2, Pickaxe, Heart, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DemoWorkspace {
  name: string
  description: string
  type: "MINING_CONTRACTOR" | "NGO" | "STARTUP"
  adminEmail: string
  country: string
  icon: React.ElementType
  accentColor: string
  bgColor: string
  modules: string[]
}

const DEMO_WORKSPACES: DemoWorkspace[] = [
  {
    name: "GoldStar Mining Ltd",
    description: "Mining contractor — Tarkwa, GH",
    type: "MINING_CONTRACTOR",
    adminEmail: "admin@goldstar.io",
    country: "GH",
    icon: Pickaxe,
    accentColor: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50",
    modules: ["Finance", "HR", "HSE", "Procurement", "Projects"],
  },
  {
    name: "Horizon Ghana NGO",
    description: "Non-profit organisation — Accra, GH",
    type: "NGO",
    adminEmail: "admin@horizon-ghana.org",
    country: "GH",
    icon: Heart,
    accentColor: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50",
    modules: ["Finance", "HR", "Projects", "Donors", "Reports"],
  },
  {
    name: "Kobo Labs",
    description: "B2B SaaS startup — Accra, GH",
    type: "STARTUP",
    adminEmail: "admin@kobolabs.com",
    country: "GH",
    icon: Rocket,
    accentColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50",
    modules: ["Finance", "HR", "Projects", "CRM", "Documents"],
  },
]

const DEMO_PASSWORD = "password123"

export function DemoLogin() {
  const router = useRouter()
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null)

  async function handleDemoLogin(workspace: DemoWorkspace) {
    setLoadingEmail(workspace.adminEmail)
    try {
      const result = await signIn("credentials", {
        email: workspace.adminEmail,
        password: DEMO_PASSWORD,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Demo workspace unavailable", {
          description:
            "This demo workspace hasn't been seeded yet. Please run the seed script.",
        })
        return
      }

      toast.success(`Welcome to ${workspace.name}!`, {
        description: "You're signed in as Administrator.",
      })
      router.push("/dashboard")
      router.refresh()
    } catch {
      toast.error("Failed to sign in to demo workspace")
    } finally {
      setLoadingEmail(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground text-center">
        Pre-loaded with realistic data. No signup required.
      </p>
      <div className="grid gap-2.5">
        {DEMO_WORKSPACES.map((workspace) => {
          const Icon = workspace.icon
          const isLoading = loadingEmail === workspace.adminEmail
          const isAnyLoading = loadingEmail !== null

          return (
            <div
              key={workspace.adminEmail}
              className={cn(
                "rounded-lg border p-3.5 transition-all",
                workspace.bgColor
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0",
                      "bg-white dark:bg-white/10 shadow-sm"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", workspace.accentColor)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {workspace.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {workspace.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {workspace.modules.slice(0, 3).map((mod) => (
                        <span
                          key={mod}
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/60 dark:bg-white/10 text-muted-foreground"
                        >
                          {mod}
                        </span>
                      ))}
                      {workspace.modules.length > 3 && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/60 dark:bg-white/10 text-muted-foreground">
                          +{workspace.modules.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 h-8 text-xs font-semibold bg-white dark:bg-white/10 border-white/80 dark:border-white/20 hover:bg-white/90 dark:hover:bg-white/20 shadow-sm"
                  disabled={isAnyLoading}
                  onClick={() => handleDemoLogin(workspace)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Try as Admin"
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
