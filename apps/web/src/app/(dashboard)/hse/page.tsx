import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatDate } from "@/lib/utils"
import {
  HardHat,
  AlertTriangle,
  ShieldCheck,
  Clock,
  GraduationCap,
  Plus,
  ArrowRight,
} from "lucide-react"

const severityColors: Record<string, string> = {
  NEAR_MISS: "bg-blue-100 text-blue-700 border-blue-200",
  MINOR: "bg-amber-100 text-amber-700 border-amber-200",
  MODERATE: "bg-orange-100 text-orange-700 border-orange-200",
  MAJOR: "bg-red-100 text-red-700 border-red-200",
  FATAL: "bg-gray-900 text-white border-gray-800",
}

const severityBarColor: Record<string, string> = {
  NEAR_MISS: "bg-blue-400",
  MINOR: "bg-amber-400",
  MODERATE: "bg-orange-500",
  MAJOR: "bg-red-600",
  FATAL: "bg-gray-900",
}

const statusColors: Record<string, string> = {
  REPORTED: "bg-gray-100 text-gray-700",
  UNDER_INVESTIGATION: "bg-blue-100 text-blue-700",
  CORRECTIVE_ACTIONS: "bg-amber-100 text-amber-700",
  CLOSED: "bg-green-100 text-green-700",
  REOPENED: "bg-red-100 text-red-700",
}

const permitTypeColors: Record<string, string> = {
  HOT_WORK: "bg-red-100 text-red-700",
  CONFINED_SPACE: "bg-purple-100 text-purple-700",
  WORKING_AT_HEIGHT: "bg-orange-100 text-orange-700",
  ELECTRICAL: "bg-yellow-100 text-yellow-800",
  EXCAVATION: "bg-stone-100 text-stone-700",
  GENERAL: "bg-gray-100 text-gray-700",
}

function severityLabel(s: string) {
  return s.replace(/_/g, " ")
}

export default async function HSEDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [allIncidents, activePermits, overdueTrainings, upcomingTrainings] = await Promise.all([
    prisma.incident.findMany({
      where: { workspaceId, incidentDate: { gte: startOfYear } },
      orderBy: { incidentDate: "desc" },
    }),
    prisma.permit.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { validTo: "asc" },
      take: 10,
    }),
    prisma.safetyTraining.findMany({
      where: { workspaceId, expiryDate: { lt: now } },
      orderBy: { expiryDate: "asc" },
      take: 5,
    }),
    prisma.safetyTraining.findMany({
      where: { workspaceId, expiryDate: { gte: now, lte: thirtyDaysOut } },
      orderBy: { expiryDate: "asc" },
      take: 5,
    }),
  ])

  const totalIncidents = allIncidents.length

  // Days since last incident (excluding near-misses)
  const lastRealIncident = allIncidents
    .filter((i) => i.severity !== "NEAR_MISS")
    .sort((a, b) => new Date(b.incidentDate).getTime() - new Date(a.incidentDate).getTime())[0]

  const daysSinceLast = lastRealIncident
    ? Math.floor((now.getTime() - new Date(lastRealIncident.incidentDate).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Severity breakdown
  const severityCounts = allIncidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1
    return acc
  }, {})

  const recentIncidents = allIncidents.slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HardHat className="h-6 w-6 text-amber-500" />
            Health, Safety &amp; Environment
          </h1>
          <p className="text-muted-foreground">Safety performance dashboard for {now.getFullYear()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/hse/permits/new">
              <Plus className="h-4 w-4 mr-2" />
              New Permit
            </Link>
          </Button>
          <Button asChild className="bg-red-600 hover:bg-red-700 text-white">
            <Link href="/hse/incidents/new">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Report Incident
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Total Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalIncidents}</p>
            <p className="text-xs text-muted-foreground mt-1">This year</p>
          </CardContent>
        </Card>

        <Card className={cn(
          daysSinceLast !== null && daysSinceLast < 7 ? "border-red-300 bg-red-50" :
          daysSinceLast !== null && daysSinceLast < 30 ? "border-amber-300 bg-amber-50" :
          "border-green-300 bg-green-50"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              Days Since Last Incident
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-3xl font-bold",
              daysSinceLast !== null && daysSinceLast < 7 ? "text-red-700" :
              daysSinceLast !== null && daysSinceLast < 30 ? "text-amber-700" :
              "text-green-700"
            )}>
              {daysSinceLast !== null ? daysSinceLast : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {daysSinceLast !== null
                ? lastRealIncident ? `Last: ${formatDate(lastRealIncident.incidentDate)}` : ""
                : "No incidents recorded"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              Active Permits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{activePermits.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Permits to Work</p>
          </CardContent>
        </Card>

        <Card className={overdueTrainings.length > 0 ? "border-red-300 bg-red-50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-purple-500" />
              Overdue Trainings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-3xl font-bold", overdueTrainings.length > 0 ? "text-red-600" : "text-green-600")}>
              {overdueTrainings.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {upcomingTrainings.length > 0 ? `${upcomingTrainings.length} expiring in 30 days` : "All current"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Severity Breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Severity Breakdown</CardTitle>
            <Link href="/hse/incidents" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalIncidents === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No incidents this year</p>
            ) : (
              ["NEAR_MISS", "MINOR", "MODERATE", "MAJOR", "FATAL"].map((sev) => {
                const count = severityCounts[sev] ?? 0
                const pct = totalIncidents > 0 ? Math.round((count / totalIncidents) * 100) : 0
                return (
                  <div key={sev}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", severityColors[sev])}>
                        {severityLabel(sev)}
                      </span>
                      <span className="text-sm font-semibold">{count}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={cn("h-1.5 rounded-full transition-all", severityBarColor[sev])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Active Permits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active Permits</CardTitle>
            <Link href="/hse/permits" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {activePermits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No active permits</p>
              </div>
            ) : (
              <div className="divide-y">
                {activePermits.slice(0, 6).map((p) => (
                  <Link key={p.id} href="/hse/permits" className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors group">
                    <div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", permitTypeColors[p.type])}>
                        {p.type.replace(/_/g, " ")}
                      </span>
                      <p className="text-sm font-medium mt-1 truncate max-w-[180px]">{p.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Expires</p>
                      <p className={cn("text-xs font-medium", new Date(p.validTo) < new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) ? "text-red-600" : "text-foreground")}>
                        {formatDate(p.validTo)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Training Expiries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Training Expiries</CardTitle>
            <Link href="/hse/training" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {overdueTrainings.length === 0 && upcomingTrainings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <GraduationCap className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-green-600 font-medium">All trainings current</p>
              </div>
            ) : (
              <div className="divide-y">
                {overdueTrainings.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium">{t.trainingType}</p>
                      <p className="text-xs text-muted-foreground">ID: {t.employeeId.slice(0, 8)}…</p>
                    </div>
                    <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">EXPIRED</span>
                  </div>
                ))}
                {upcomingTrainings.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium">{t.trainingType}</p>
                      <p className="text-xs text-muted-foreground">Exp: {t.expiryDate ? formatDate(t.expiryDate) : "—"}</p>
                    </div>
                    <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">EXPIRING</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Incidents</CardTitle>
          <Link href="/hse/incidents" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="h-10 w-10 text-green-400 mb-2" />
              <p className="text-sm font-medium text-green-600">No incidents reported this year</p>
              <p className="text-xs text-muted-foreground mt-1">Keep up the great work!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Incident #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Location</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Severity</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIncidents.map((inc) => (
                    <tr key={inc.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <Link href={`/hse/incidents/${inc.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                          {inc.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/hse/incidents/${inc.id}`} className="font-medium hover:underline line-clamp-1">
                          {inc.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(inc.incidentDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{inc.location}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", severityColors[inc.severity])}>
                          {severityLabel(inc.severity)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColors[inc.status])}>
                          {inc.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/hse/risks", label: "Risk Assessments", icon: AlertTriangle, color: "text-red-500" },
          { href: "/hse/toolbox-talks", label: "Toolbox Talks", icon: HardHat, color: "text-amber-500" },
          { href: "/hse/training", label: "Safety Training", icon: GraduationCap, color: "text-purple-500" },
          { href: "/hse/permits", label: "Permits to Work", icon: ShieldCheck, color: "text-blue-500" },
        ].map(({ href, label, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
          >
            <Icon className={cn("h-5 w-5", color)} />
            <span className="text-sm font-medium">{label}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  )
}
