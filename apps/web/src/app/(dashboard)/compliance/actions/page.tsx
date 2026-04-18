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
  OPEN: { label: "Open", className: "bg-blue-100 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  OVERDUE: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "text-gray-600" },
  MEDIUM: { label: "Medium", className: "text-blue-600" },
  HIGH: { label: "High", className: "text-amber-600" },
  URGENT: { label: "Urgent", className: "text-red-600" },
}

export default async function ActionsPage() {
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

  // Auto-mark overdue actions
  await prisma.correctiveAction.updateMany({
    where: {
      workspaceId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  })

  const actions = await prisma.correctiveAction.findMany({
    where: { workspaceId },
    include: {
      audit: { select: { title: true, auditNumber: true } },
      obligation: { select: { title: true } },
    },
    orderBy: { dueDate: "asc" },
  })

  const totals = {
    total: actions.length,
    open: actions.filter((a) => a.status === "OPEN").length,
    inProgress: actions.filter((a) => a.status === "IN_PROGRESS").length,
    completed: actions.filter((a) => a.status === "COMPLETED").length,
    overdue: actions.filter((a) => a.status === "OVERDUE").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Corrective Actions</h1>
          <p className="text-muted-foreground">Track and manage corrective and preventive actions</p>
        </div>
        <Button asChild>
          <Link href="/compliance/actions/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Action
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: totals.total, color: "text-blue-600" },
          { label: "Open", value: totals.open, color: "text-blue-600" },
          { label: "In Progress", value: totals.inProgress, color: "text-amber-600" },
          { label: "Completed", value: totals.completed, color: "text-green-600" },
          { label: "Overdue", value: totals.overdue, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No corrective actions yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Add your first corrective action to get started</p>
              <Button asChild>
                <Link href="/compliance/actions/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Action
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Audit</TableHead>
                  <TableHead>Obligation</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((action) => {
                  const sc = statusConfig[action.status] ?? statusConfig.OPEN
                  const pc = priorityConfig[action.priority] ?? priorityConfig.MEDIUM
                  const isOverdue = action.status === "OVERDUE"
                  return (
                    <TableRow key={action.id} className={cn("hover:bg-muted/30", isOverdue && "bg-red-50/50")}>
                      <TableCell className="font-medium">{action.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {action.audit ? action.audit.auditNumber : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {action.obligation ? action.obligation.title : "-"}
                      </TableCell>
                      <TableCell className={cn("text-muted-foreground", isOverdue && "text-red-600 font-medium")}>
                        {action.dueDate ? formatDate(action.dueDate) : "-"}
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
