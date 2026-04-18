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
  PLANNED: { label: "Planned", className: "bg-blue-100 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

const ratingConfig: Record<string, { label: string; className: string }> = {
  SATISFACTORY: { label: "Satisfactory", className: "bg-green-100 text-green-700 border-green-200" },
  NEEDS_IMPROVEMENT: { label: "Needs Improvement", className: "bg-amber-100 text-amber-700 border-amber-200" },
  UNSATISFACTORY: { label: "Unsatisfactory", className: "bg-red-100 text-red-700 border-red-200" },
}

export default async function AuditsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const audits = await prisma.complianceAudit.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: {
      _count: { select: { correctiveActions: true } },
    },
    orderBy: { scheduledDate: "desc" },
  })

  const totals = {
    total: audits.length,
    planned: audits.filter((a) => a.status === "PLANNED").length,
    inProgress: audits.filter((a) => a.status === "IN_PROGRESS").length,
    completed: audits.filter((a) => a.status === "COMPLETED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audits</h1>
          <p className="text-muted-foreground">Manage compliance audits and inspections</p>
        </div>
        <Button asChild>
          <Link href="/compliance/audits/new">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Audit
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totals.total, color: "text-blue-600" },
          { label: "Planned", value: totals.planned, color: "text-blue-600" },
          { label: "In Progress", value: totals.inProgress, color: "text-amber-600" },
          { label: "Completed", value: totals.completed, color: "text-green-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {audits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No audits yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Schedule your first audit to get started</p>
              <Button asChild>
                <Link href="/compliance/audits/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Audit
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Audit #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((audit) => {
                  const sc = statusConfig[audit.status] ?? statusConfig.PLANNED
                  const rc = audit.overallRating ? ratingConfig[audit.overallRating] : null
                  return (
                    <TableRow key={audit.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{audit.auditNumber}</TableCell>
                      <TableCell className="font-medium">{audit.title}</TableCell>
                      <TableCell className="text-muted-foreground">{audit.type}</TableCell>
                      <TableCell className="text-muted-foreground">{audit.auditor ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(audit.scheduledDate)}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", sc.className)}>
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {rc ? (
                          <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", rc.className)}>
                            {rc.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {audit._count.correctiveActions}
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
