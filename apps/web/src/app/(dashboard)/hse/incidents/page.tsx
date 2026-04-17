import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatDate } from "@/lib/utils"
import { AlertTriangle, Plus, Filter } from "lucide-react"

const severityColors: Record<string, string> = {
  NEAR_MISS: "bg-blue-100 text-blue-700 border-blue-200",
  MINOR: "bg-amber-100 text-amber-700 border-amber-200",
  MODERATE: "bg-orange-100 text-orange-700 border-orange-200",
  MAJOR: "bg-red-100 text-red-700 border-red-200",
  FATAL: "bg-gray-900 text-white border-gray-800",
}

const statusColors: Record<string, string> = {
  REPORTED: "bg-gray-100 text-gray-700",
  UNDER_INVESTIGATION: "bg-blue-100 text-blue-700",
  CORRECTIVE_ACTIONS: "bg-amber-100 text-amber-700",
  CLOSED: "bg-green-100 text-green-700",
  REOPENED: "bg-red-100 text-red-700",
}

const SEVERITIES = ["NEAR_MISS", "MINOR", "MODERATE", "MAJOR", "FATAL"]
const STATUSES = ["REPORTED", "UNDER_INVESTIGATION", "CORRECTIVE_ACTIONS", "CLOSED", "REOPENED"]

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: { severity?: string; status?: string; type?: string }
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
  const { severity, status, type } = searchParams

  const incidents = await prisma.incident.findMany({
    where: {
      workspaceId,
      ...(severity ? { severity: severity as "NEAR_MISS" | "MINOR" | "MODERATE" | "MAJOR" | "FATAL" } : {}),
      ...(status ? { status: status as "REPORTED" | "UNDER_INVESTIGATION" | "CORRECTIVE_ACTIONS" | "CLOSED" | "REOPENED" } : {}),
      ...(type ? { type: type as "INJURY" | "PROPERTY_DAMAGE" | "ENVIRONMENTAL" | "NEAR_MISS" | "VEHICLE" | "FIRE" | "CHEMICAL" | "ELECTRICAL" | "OTHER" } : {}),
    },
    orderBy: { incidentDate: "desc" },
  })

  // Enrich with reporter names
  const userIds = [...new Set(incidents.map((i) => i.reportedBy))]
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  function buildFilterUrl(key: string, value: string) {
    const params = new URLSearchParams({
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    })
    if (params.get(key) === value) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const q = params.toString()
    return `/hse/incidents${q ? `?${q}` : ""}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            Incident Register
          </h1>
          <p className="text-muted-foreground">{incidents.length} incident{incidents.length !== 1 ? "s" : ""} found</p>
        </div>
        <Button asChild className="bg-red-600 hover:bg-red-700 text-white">
          <Link href="/hse/incidents/new">
            <Plus className="h-4 w-4 mr-2" />
            Report Incident
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" /> Severity:
        </span>
        {SEVERITIES.map((s) => (
          <Link
            key={s}
            href={buildFilterUrl("severity", s)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
              severity === s ? severityColors[s] + " ring-2 ring-offset-1 ring-current" : "border-muted bg-muted/50 text-muted-foreground hover:border-current"
            )}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
        <span className="text-sm text-muted-foreground ml-3">Status:</span>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={buildFilterUrl("status", s)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium transition-all",
              status === s ? statusColors[s] + " ring-2 ring-offset-1 ring-blue-400" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
        {(severity || status || type) && (
          <Link href="/hse/incidents" className="text-xs text-blue-600 hover:underline ml-2">
            Clear filters
          </Link>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No incidents found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {severity || status || type ? "Try adjusting your filters" : "Report an incident using the button above"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Incident #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Location</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Severity</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Reported By</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <Link href={`/hse/incidents/${inc.id}`} className="font-mono text-xs text-blue-600 hover:underline font-medium">
                          {inc.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <Link href={`/hse/incidents/${inc.id}`} className="font-medium hover:underline line-clamp-1">
                          {inc.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                        {formatDate(inc.incidentDate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[150px] truncate">
                        {inc.location}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap", severityColors[inc.severity])}>
                          {inc.severity.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                        {inc.type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", statusColors[inc.status])}>
                          {inc.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                        {userMap[inc.reportedBy]?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
