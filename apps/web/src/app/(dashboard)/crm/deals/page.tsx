import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Plus, Briefcase } from "lucide-react"

const stageConfig: Record<string, { label: string; className: string }> = {
  QUALIFIED: { label: "Qualified", className: "bg-blue-100 text-blue-700 border-blue-200" },
  PROPOSAL: { label: "Proposal", className: "bg-purple-100 text-purple-700 border-purple-200" },
  NEGOTIATION: { label: "Negotiation", className: "bg-amber-100 text-amber-700 border-amber-200" },
  CONTRACT_SENT: { label: "Contract Sent", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  WON: { label: "Won", className: "bg-green-100 text-green-700 border-green-200" },
  LOST: { label: "Lost", className: "bg-red-100 text-red-700 border-red-200" },
}

export default async function DealsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const deals = await prisma.crmDeal.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      contact: { select: { firstName: true, lastName: true } },
      company: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const stageTotals = (["QUALIFIED", "PROPOSAL", "NEGOTIATION", "CONTRACT_SENT", "WON", "LOST"] as const).map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage)
    return {
      stage,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + Number(d.value), 0),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground">Track your sales pipeline</p>
        </div>
        <Button asChild>
          <Link href="/crm/deals/new">
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stageTotals.map(({ stage, count, value }) => {
          const cfg = stageConfig[stage]
          return (
            <Card key={stage} className="p-4">
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
              <p className={cn("text-lg font-bold mt-1", cfg.className.split(" ").pop())}>{formatCurrency(value)}</p>
              <p className="text-xs text-muted-foreground">{count} deal{count !== 1 ? "s" : ""}</p>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No deals yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first deal to start tracking your pipeline</p>
              <Button asChild>
                <Link href="/crm/deals/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Deal
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Probability</TableHead>
                  <TableHead>Expected Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => {
                  const cfg = stageConfig[deal.stage] ?? stageConfig.QUALIFIED
                  return (
                    <TableRow key={deal.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{deal.number}</TableCell>
                      <TableCell className="font-medium">{deal.title}</TableCell>
                      <TableCell className="text-muted-foreground">{deal.company?.name ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(deal.value), deal.currency)}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{deal.probability}%</TableCell>
                      <TableCell className="text-muted-foreground">
                        {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "-"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
