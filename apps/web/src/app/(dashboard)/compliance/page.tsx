import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, cn } from "@/lib/utils"
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  Calendar,
  Plus,
  ArrowRight,
  FileText,
  Scale,
  Search,
} from "lucide-react"

export default async function CompliancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const [obligations, licences, actions, audits] = await Promise.all([
    prisma.complianceObligation.findMany({
      where: { workspaceId, deletedAt: null },
    }),
    prisma.licence.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.correctiveAction.findMany({
      where: { workspaceId },
      include: {
        audit: { select: { auditNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.complianceAudit.findMany({
      where: { workspaceId },
    }),
  ])

  // Compliance Score: % of non-NOT_ASSESSED obligations that are COMPLIANT
  const assessed = obligations.filter((o) => o.status !== "NOT_ASSESSED")
  const compliant = assessed.filter((o) => o.status === "COMPLIANT")
  const complianceScore = assessed.length > 0 ? Math.round((compliant.length / assessed.length) * 100) : 0

  // Expiring licences
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiringLicences = licences.filter(
    (l) => l.status === "EXPIRING_SOON" || (l.expiryDate <= thirtyDaysFromNow && l.expiryDate >= now)
  )
  const expiringLicencesList = licences
    .filter((l) => l.status !== "EXPIRED" && l.status !== "SUSPENDED" && l.status !== "REVOKED")
    .slice(0, 5)

  // Open actions
  const openActions = actions.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS")

  // Upcoming audits
  const plannedAudits = audits.filter((a) => a.status === "PLANNED")

  const actionStatusColor: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-green-100 text-green-700",
    OVERDUE: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
          <p className="text-muted-foreground">Regulatory compliance overview for your workspace</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/compliance/obligations/new">
              <Plus className="h-4 w-4 mr-2" />
              Obligation
            </Link>
          </Button>
          <Button asChild>
            <Link href="/compliance/licences/new">
              <Plus className="h-4 w-4 mr-2" />
              Licence
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", complianceScore >= 80 ? "text-green-600" : complianceScore >= 50 ? "text-amber-600" : "text-red-600")}>
              {complianceScore}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {compliant.length} of {assessed.length} assessed obligations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Expiring Licences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", expiringLicences.length > 0 ? "text-amber-600" : "text-green-600")}>
              {expiringLicences.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-500" />
              Open Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{openActions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Open or in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Upcoming Audits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{plannedAudits.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Planned audits</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expiring Licences Alert */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Expiring Licences</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/compliance/licences">
                View all
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {expiringLicencesList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No licences to display</p>
              </div>
            ) : (
              <div className="divide-y">
                {expiringLicencesList.map((licence) => {
                  const daysRemaining = Math.ceil(
                    (licence.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  )
                  const isExpired = daysRemaining < 0
                  return (
                    <div key={licence.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold",
                          isExpired ? "bg-red-100 text-red-700" : daysRemaining <= 30 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        )}>
                          <Shield className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{licence.name}</p>
                          <p className="text-xs text-muted-foreground">{licence.licenceNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{formatDate(licence.expiryDate)}</p>
                        <p className={cn(
                          "text-xs font-medium",
                          isExpired ? "text-red-600" : daysRemaining <= 30 ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          {isExpired ? `Expired ${Math.abs(daysRemaining)} days ago` : `${daysRemaining} days remaining`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/compliance/obligations/new", label: "New Obligation", icon: Shield, color: "text-blue-500" },
                { href: "/compliance/licences/new", label: "Add Licence", icon: FileText, color: "text-blue-500" },
                { href: "/compliance/policies/new", label: "Create Policy", icon: Scale, color: "text-blue-500" },
                { href: "/compliance/audits/new", label: "Schedule Audit", icon: Search, color: "text-blue-500" },
                { href: "/compliance/actions/new", label: "Add Action", icon: ClipboardList, color: "text-blue-500" },
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
        </div>
      </div>

      {/* Recent Corrective Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Corrective Actions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/compliance/actions">
              View all
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No corrective actions yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {actions.map((action) => (
                <div key={action.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.audit ? action.audit.auditNumber : "No audit"}
                        {action.dueDate && ` | Due: ${formatDate(action.dueDate)}`}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    actionStatusColor[action.status] ?? "bg-gray-100 text-gray-700"
                  )}>
                    {action.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
