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
import { Plus, FileText } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  CONVERTED: { label: "Converted to PO", className: "bg-purple-100 text-purple-700 border-purple-200" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "text-gray-500" },
  MEDIUM: { label: "Medium", className: "text-blue-600" },
  HIGH: { label: "High", className: "text-amber-600" },
  URGENT: { label: "Urgent", className: "text-red-600 font-semibold" },
}

export default async function RequisitionsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const requisitions = await prisma.purchaseRequisition.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  })

  const userIds = Array.from(new Set(requisitions.map((r) => r.requestedBy)))
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Requisitions</h1>
          <p className="text-muted-foreground">Internal purchase requests awaiting approval</p>
        </div>
        <Button asChild>
          <Link href="/procurement/requisitions/new">
            <Plus className="h-4 w-4 mr-2" />
            New Requisition
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusConfig).map(([status, cfg]) => {
          const count = requisitions.filter((r) => r.status === status).length
          if (count === 0) return null
          return (
            <div key={status} className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium",
              cfg.className
            )}>
              <span>{cfg.label}</span>
              <span className="opacity-60">({count})</span>
            </div>
          )
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {requisitions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No requisitions yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create a purchase requisition to request items</p>
              <Button asChild>
                <Link href="/procurement/requisitions/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Requisition
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Needed By</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.map((req) => {
                  const cfg = statusConfig[req.status] ?? statusConfig.DRAFT
                  const pri = priorityConfig[req.priority] ?? priorityConfig.MEDIUM
                  return (
                    <TableRow key={req.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{req.number}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{req.title}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-medium", pri.className)}>{pri.label}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{userMap[req.requestedBy] ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {req.neededBy ? formatDate(req.neededBy) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(req.totalAmount), req.currency)}
                      </TableCell>
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
