import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, cn } from "@/lib/utils"
import {
  Briefcase,
  TrendingUp,
  Users,
  Target,
  Clock,
  Plus,
  ArrowRight,
  Building2,
  Phone,
  BarChart3,
} from "lucide-react"

const stageConfig: Record<string, { label: string; className: string }> = {
  QUALIFIED: { label: "Qualified", className: "bg-blue-100 text-blue-700 border-blue-200" },
  PROPOSAL: { label: "Proposal", className: "bg-purple-100 text-purple-700 border-purple-200" },
  NEGOTIATION: { label: "Negotiation", className: "bg-amber-100 text-amber-700 border-amber-200" },
  CONTRACT_SENT: { label: "Contract Sent", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  WON: { label: "Won", className: "bg-green-100 text-green-700 border-green-200" },
  LOST: { label: "Lost", className: "bg-red-100 text-red-700 border-red-200" },
}

export default async function CRMPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const [deals, contacts, activities] = await Promise.all([
    prisma.crmDeal.findMany({
      where: { workspaceId, deletedAt: null },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.crmContact.findMany({
      where: { workspaceId, deletedAt: null },
    }),
    prisma.crmActivity.findMany({
      where: {
        workspaceId,
        dueDate: { lte: new Date() },
        completedAt: null,
      },
    }),
  ])

  const activeDeals = deals.filter((d) => d.stage !== "WON" && d.stage !== "LOST")
  const pipelineValue = activeDeals.reduce(
    (sum, d) => sum + Number(d.value) * (d.probability / 100),
    0
  )

  const recentDeals = deals.slice(0, 5)

  // Conversion funnel counts
  const stageCounts = {
    QUALIFIED: deals.filter((d) => d.stage === "QUALIFIED").length,
    PROPOSAL: deals.filter((d) => d.stage === "PROPOSAL").length,
    NEGOTIATION: deals.filter((d) => d.stage === "NEGOTIATION").length,
    CONTRACT_SENT: deals.filter((d) => d.stage === "CONTRACT_SENT").length,
    WON: deals.filter((d) => d.stage === "WON").length,
    LOST: deals.filter((d) => d.stage === "LOST").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground">Manage your customer relationships and sales pipeline</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/crm/contacts/new">
              <Plus className="h-4 w-4 mr-2" />
              Contact
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/crm/companies/new">
              <Plus className="h-4 w-4 mr-2" />
              Company
            </Link>
          </Button>
          <Button asChild>
            <Link href="/crm/deals/new">
              <Plus className="h-4 w-4 mr-2" />
              Deal
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              Pipeline Value (Weighted)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-violet-600">{formatCurrency(pipelineValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Weighted by probability</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Active Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{activeDeals.length}</p>
            <p className="text-xs text-muted-foreground mt-1">In pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{contacts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">In your CRM</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Activities Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{activities.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Overdue or due today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Deals */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Deals</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/crm/deals">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentDeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Briefcase className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No deals yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentDeals.map((deal) => {
                  const cfg = stageConfig[deal.stage] ?? stageConfig.QUALIFIED
                  return (
                    <div key={deal.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-semibold text-violet-700">
                          {deal.number?.slice(-2) ?? "D"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{deal.title}</p>
                          <p className="text-xs text-muted-foreground">{deal.company?.name ?? "No company"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(Number(deal.value), deal.currency)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions + Funnel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/crm/contacts/new", label: "New Contact", icon: Users, color: "text-green-500" },
                { href: "/crm/companies/new", label: "New Company", icon: Building2, color: "text-blue-500" },
                { href: "/crm/deals/new", label: "New Deal", icon: Target, color: "text-violet-500" },
                { href: "/crm/activities", label: "Log Activity", icon: Phone, color: "text-amber-500" },
                { href: "/crm/pipeline", label: "View Pipeline", icon: BarChart3, color: "text-purple-500" },
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
              <CardTitle className="text-base">Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(["QUALIFIED", "PROPOSAL", "NEGOTIATION", "CONTRACT_SENT", "WON", "LOST"] as const).map((stage) => {
                  const cfg = stageConfig[stage]
                  const count = stageCounts[stage]
                  const maxCount = Math.max(...Object.values(stageCounts), 1)
                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{cfg.label}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            stage === "WON" ? "bg-green-500" : stage === "LOST" ? "bg-red-400" : "bg-violet-500"
                          )}
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
