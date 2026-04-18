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
import { formatDate, cn } from "@/lib/utils"
import { Plus, Shield } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  COMPLIANT: { label: "Compliant", className: "bg-green-100 text-green-700 border-green-200" },
  NON_COMPLIANT: { label: "Non-Compliant", className: "bg-red-100 text-red-700 border-red-200" },
  AT_RISK: { label: "At Risk", className: "bg-amber-100 text-amber-700 border-amber-200" },
  NOT_ASSESSED: { label: "Not Assessed", className: "bg-gray-100 text-gray-700 border-gray-200" },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "text-gray-600" },
  MEDIUM: { label: "Medium", className: "text-blue-600" },
  HIGH: { label: "High", className: "text-amber-600" },
  URGENT: { label: "Urgent", className: "text-red-600" },
}

export default async function ObligationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const obligations = await prisma.complianceObligation.findMany({
    where: { workspaceId: session.user.workspaceId, deletedAt: null },
    orderBy: { nextDueDate: { sort: "asc", nulls: "last" } },
  })

  const totals = {
    total: obligations.length,
    compliant: obligations.filter((o) => o.status === "COMPLIANT").length,
    nonCompliant: obligations.filter((o) => o.status === "NON_COMPLIANT").length,
    atRisk: obligations.filter((o) => o.status === "AT_RISK").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Obligations</h1>
          <p className="text-muted-foreground">Track regulatory and internal compliance requirements</p>
        </div>
        <Button asChild>
          <Link href="/compliance/obligations/new">
            <Plus className="h-4 w-4 mr-2" />
            New Obligation
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totals.total, color: "text-blue-600" },
          { label: "Compliant", value: totals.compliant, color: "text-green-600" },
          { label: "Non-Compliant", value: totals.nonCompliant, color: "text-red-600" },
          { label: "At Risk", value: totals.atRisk, color: "text-amber-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {obligations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No obligations yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first compliance obligation to get started</p>
              <Button asChild>
                <Link href="/compliance/obligations/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Obligation
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Regulation</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {obligations.map((ob) => {
                  const sc = statusConfig[ob.status] ?? statusConfig.NOT_ASSESSED
                  const pc = priorityConfig[ob.priority] ?? priorityConfig.MEDIUM
                  return (
                    <TableRow key={ob.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{ob.title}</TableCell>
                      <TableCell className="text-muted-foreground">{ob.regulation ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{ob.category}</TableCell>
                      <TableCell className="text-muted-foreground">{ob.frequency.replace("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {ob.nextDueDate ? formatDate(ob.nextDueDate) : "-"}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", sc.className)}>
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-medium", pc.className)}>{pc.label}</span>
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
