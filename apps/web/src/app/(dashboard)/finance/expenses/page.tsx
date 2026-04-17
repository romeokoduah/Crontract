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
import { Plus, CreditCard } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  REIMBURSED: { label: "Reimbursed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
}

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const expenses = await prisma.expense.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  })

  // Enrich with submitter names
  const userIds = Array.from(new Set(expenses.map((e) => e.submittedBy)))
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  const byStatus = (s: string) => expenses.filter((e) => e.status === s)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Track and manage expense claims</p>
        </div>
        <Button asChild>
          <Link href="/finance/expenses/new">
            <Plus className="h-4 w-4 mr-2" />
            Submit Expense
          </Link>
        </Button>
      </div>

      {/* Status filters summary */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusConfig).map(([status, cfg]) => {
          const count = byStatus(status).length
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
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No expenses yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Submit your first expense claim</p>
              <Button asChild>
                <Link href="/finance/expenses/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Submit Expense
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const cfg = statusConfig[expense.status] ?? statusConfig.DRAFT
                  return (
                    <TableRow key={expense.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium max-w-[200px] truncate">{expense.description}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{expense.category}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(expense.date)}</TableCell>
                      <TableCell className="text-muted-foreground">{userMap[expense.submittedBy] ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(expense.amount), expense.currency)}
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
