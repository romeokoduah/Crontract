import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import {
  Heart,
  TrendingUp,
  Activity,
  Target,
  FileText,
  Plus,
  ArrowRight,
  Users,
  BarChart3,
  ClipboardList,
} from "lucide-react"

export default async function GrantsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const [grants, indicators, reports] = await Promise.all([
    prisma.grant.findMany({
      where: { workspaceId, deletedAt: null },
      include: { donor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.indicator.findMany({
      where: { workspaceId },
      include: { results: { orderBy: { reportedDate: "desc" }, take: 1 } },
    }),
    prisma.grantReport.findMany({
      where: { workspaceId },
    }),
  ])

  const totalFunding = grants.reduce((sum, g) => sum + Number(g.amount), 0)
  const activeGrants = grants.filter((g) => g.status === "ACTIVE").length

  const indicatorsOnTrack = indicators.filter((ind) => {
    const latest = ind.results[0]
    if (!latest) return false
    return Number(latest.actualValue) >= Number(ind.target)
  }).length

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const reportsDue = reports.filter(
    (r) => r.status === "DRAFT" && new Date(r.dueDate) <= thirtyDaysFromNow
  ).length

  const recentGrants = grants.slice(0, 5)

  const statusConfig: Record<string, { label: string; className: string }> = {
    PIPELINE: { label: "Pipeline", className: "bg-gray-100 text-gray-700" },
    SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
    APPROVED: { label: "Approved", className: "bg-indigo-100 text-indigo-700" },
    ACTIVE: { label: "Active", className: "bg-green-100 text-green-700" },
    SUSPENDED: { label: "Suspended", className: "bg-amber-100 text-amber-700" },
    CLOSEOUT: { label: "Close-out", className: "bg-orange-100 text-orange-700" },
    CLOSED: { label: "Closed", className: "bg-gray-100 text-gray-500" },
  }

  // Funding by status
  const fundingByStatus = Object.entries(statusConfig).map(([status, cfg]) => {
    const filtered = grants.filter((g) => g.status === status)
    return {
      status,
      label: cfg.label,
      count: filtered.length,
      amount: filtered.reduce((sum, g) => sum + Number(g.amount), 0),
    }
  }).filter((s) => s.count > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grants & M&E</h1>
          <p className="text-muted-foreground">Grant funding and monitoring overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/grants/donors/new">
              <Plus className="h-4 w-4 mr-2" />
              Donor
            </Link>
          </Button>
          <Button asChild className="bg-pink-600 hover:bg-pink-700">
            <Link href="/grants/grants/new">
              <Plus className="h-4 w-4 mr-2" />
              New Grant
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-pink-500" />
              Total Grant Funding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-pink-600">{formatCurrency(totalFunding)}</p>
            <p className="text-xs text-muted-foreground mt-1">{grants.length} grant{grants.length !== 1 ? "s" : ""} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              Active Grants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{activeGrants}</p>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Indicators on Track
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{indicatorsOnTrack}</p>
            <p className="text-xs text-muted-foreground mt-1">of {indicators.length} total indicators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              Reports Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{reportsDue}</p>
            <p className="text-xs text-muted-foreground mt-1">Within next 30 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Grants */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Grants</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/grants/grants">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentGrants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Heart className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No grants yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentGrants.map((grant) => {
                  const cfg = statusConfig[grant.status] ?? statusConfig.PIPELINE
                  return (
                    <div key={grant.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center text-xs font-semibold text-pink-700">
                          GRT
                        </div>
                        <div>
                          <p className="text-sm font-medium">{grant.title}</p>
                          <p className="text-xs text-muted-foreground">{grant.grantNumber} - {grant.donor.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-pink-600">
                            {formatCurrency(Number(grant.amount), grant.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(grant.startDate)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions + Funding Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/grants/grants/new", label: "New Grant", icon: Plus, color: "text-pink-500" },
                { href: "/grants/donors/new", label: "Add Donor", icon: Users, color: "text-blue-500" },
                { href: "/grants/logframes", label: "View Logframes", icon: ClipboardList, color: "text-indigo-500" },
                { href: "/grants/indicators", label: "View Indicators", icon: BarChart3, color: "text-green-500" },
                { href: "/grants/reports", label: "View Reports", icon: FileText, color: "text-amber-500" },
              ].map(({ href, label, icon: Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-4 w-4", color)} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funding by Status</CardTitle>
            </CardHeader>
            <CardContent>
              {fundingByStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">No grants to display</p>
              ) : (
                <div className="space-y-2">
                  {fundingByStatus.map((s) => (
                    <div key={s.status} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{s.label} ({s.count})</span>
                      <span className="font-medium">{formatCurrency(s.amount)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="font-bold text-pink-600">{formatCurrency(totalFunding)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
