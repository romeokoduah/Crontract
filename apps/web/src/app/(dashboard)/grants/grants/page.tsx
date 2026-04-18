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
import { Plus, Heart } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  PIPELINE: { label: "Pipeline", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-700 border-green-200" },
  SUSPENDED: { label: "Suspended", className: "bg-amber-100 text-amber-700 border-amber-200" },
  CLOSEOUT: { label: "Close-out", className: "bg-orange-100 text-orange-700 border-orange-200" },
  CLOSED: { label: "Closed", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

export default async function GrantsListPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const grants = await prisma.grant.findMany({
    where: { workspaceId, deletedAt: null },
    include: { donor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const totalFunding = grants.reduce((s, g) => s + Number(g.amount), 0)
  const activeFunding = grants.filter((g) => g.status === "ACTIVE").reduce((s, g) => s + Number(g.amount), 0)
  const pipelineFunding = grants.filter((g) => g.status === "PIPELINE" || g.status === "SUBMITTED").reduce((s, g) => s + Number(g.amount), 0)
  const closedFunding = grants.filter((g) => g.status === "CLOSED" || g.status === "CLOSEOUT").reduce((s, g) => s + Number(g.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grants</h1>
          <p className="text-muted-foreground">Manage your grant portfolio</p>
        </div>
        <Button asChild className="bg-pink-600 hover:bg-pink-700">
          <Link href="/grants/grants/new">
            <Plus className="h-4 w-4 mr-2" />
            New Grant
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Funding", value: totalFunding, count: grants.length, color: "text-pink-600" },
          { label: "Active", value: activeFunding, count: grants.filter((g) => g.status === "ACTIVE").length, color: "text-green-600" },
          { label: "Pipeline", value: pipelineFunding, count: grants.filter((g) => g.status === "PIPELINE" || g.status === "SUBMITTED").length, color: "text-blue-600" },
          { label: "Closed", value: closedFunding, count: grants.filter((g) => g.status === "CLOSED" || g.status === "CLOSEOUT").length, color: "text-gray-600" },
        ].map(({ label, value, count, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{formatCurrency(value)}</p>
            <p className="text-xs text-muted-foreground">{count} grant{count !== 1 ? "s" : ""}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {grants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No grants yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first grant to get started</p>
              <Button asChild className="bg-pink-600 hover:bg-pink-700">
                <Link href="/grants/grants/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Grant
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grant #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants.map((grant) => {
                  const cfg = statusConfig[grant.status] ?? statusConfig.PIPELINE
                  return (
                    <TableRow key={grant.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{grant.grantNumber}</TableCell>
                      <TableCell className="font-medium">{grant.title}</TableCell>
                      <TableCell className="text-muted-foreground">{grant.donor.name}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(grant.amount), grant.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(grant.startDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(grant.endDate)}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
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
