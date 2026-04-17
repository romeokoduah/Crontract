import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatDate } from "@/lib/utils"
import { ShieldCheck, Plus, Flame, Zap, ArrowUpSquare, Square, Drill } from "lucide-react"

const permitTypeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  HOT_WORK: { label: "Hot Work", color: "bg-red-100 text-red-700 border-red-200", icon: Flame },
  CONFINED_SPACE: { label: "Confined Space", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Square },
  WORKING_AT_HEIGHT: { label: "Working at Height", color: "bg-orange-100 text-orange-700 border-orange-200", icon: ArrowUpSquare },
  ELECTRICAL: { label: "Electrical", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Zap },
  EXCAVATION: { label: "Excavation", color: "bg-stone-100 text-stone-700 border-stone-200", icon: Drill },
  GENERAL: { label: "General", color: "bg-gray-100 text-gray-700 border-gray-200", icon: ShieldCheck },
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  REQUESTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-indigo-100 text-indigo-700",
  ACTIVE: "bg-green-100 text-green-700",
  SUSPENDED: "bg-amber-100 text-amber-700",
  CLOSED: "bg-gray-100 text-gray-500",
  EXPIRED: "bg-red-100 text-red-700",
}

const PERMIT_TYPES = ["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL", "EXCAVATION", "GENERAL"]
const PERMIT_STATUSES = ["DRAFT", "REQUESTED", "APPROVED", "ACTIVE", "SUSPENDED", "CLOSED", "EXPIRED"]

export default async function PermitsPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const { type, status } = searchParams

  const permits = await prisma.permit.findMany({
    where: {
      workspaceId,
      ...(type ? { type: type as "HOT_WORK" | "CONFINED_SPACE" | "WORKING_AT_HEIGHT" | "ELECTRICAL" | "EXCAVATION" | "GENERAL" } : {}),
      ...(status ? { status: status as "DRAFT" | "REQUESTED" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CLOSED" | "EXPIRED" } : {}),
    },
    orderBy: { createdAt: "desc" },
  })

  const now = new Date()

  function buildFilterUrl(key: string, value: string) {
    const params = new URLSearchParams({
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    })
    if (params.get(key) === value) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const q = params.toString()
    return `/hse/permits${q ? `?${q}` : ""}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-500" />
            Permits to Work
          </h1>
          <p className="text-muted-foreground">{permits.length} permit{permits.length !== 1 ? "s" : ""}</p>
        </div>
        <Button asChild>
          <Link href="/hse/permits/new">
            <Plus className="h-4 w-4 mr-2" />
            New Permit
          </Link>
        </Button>
      </div>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Type:</span>
        {PERMIT_TYPES.map((t) => {
          const cfg = permitTypeConfig[t]
          const Icon = cfg.icon
          return (
            <Link
              key={t}
              href={buildFilterUrl("type", t)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 transition-all",
                type === t ? cfg.color + " ring-2 ring-offset-1 ring-current" : "border-muted bg-muted/50 text-muted-foreground hover:border-current"
              )}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </Link>
          )
        })}
        <span className="text-sm text-muted-foreground ml-3">Status:</span>
        {PERMIT_STATUSES.map((s) => (
          <Link
            key={s}
            href={buildFilterUrl("status", s)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium transition-all",
              status === s ? statusColors[s] + " ring-2 ring-offset-1 ring-blue-400" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {s}
          </Link>
        ))}
        {(type || status) && (
          <Link href="/hse/permits" className="text-xs text-blue-600 hover:underline ml-2">
            Clear
          </Link>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {permits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No permits found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {type || status ? "Try adjusting your filters" : "Create a permit to work using the button above"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Permit #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Location</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell whitespace-nowrap">Valid From</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell whitespace-nowrap">Valid To</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((permit) => {
                    const cfg = permitTypeConfig[permit.type]
                    const Icon = cfg.icon
                    const isExpired = permit.validTo < now && permit.status === "ACTIVE"
                    return (
                      <tr key={permit.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3">
                          <span className="font-mono text-xs text-blue-600 font-medium">{permit.number}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 w-fit whitespace-nowrap", cfg.color)}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium line-clamp-1">{permit.title}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[150px] truncate">
                          {permit.location}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                          {formatDate(permit.validFrom)}
                        </td>
                        <td className={cn("px-4 py-3 hidden lg:table-cell whitespace-nowrap font-medium", isExpired ? "text-red-600" : "text-foreground")}>
                          {formatDate(permit.validTo)}
                          {isExpired && <span className="text-xs ml-1">(expired)</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", statusColors[permit.status])}>
                            {permit.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
