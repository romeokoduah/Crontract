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
  SENT: { label: "Sent", className: "bg-blue-100 text-blue-700 border-blue-200" },
  PAID: { label: "Paid", className: "bg-green-100 text-green-700 border-green-200" },
  OVERDUE: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  // Auto-mark overdue invoices
  await prisma.invoice.updateMany({
    where: {
      workspaceId,
      status: "SENT",
      dueDate: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  })

  const invoices = await prisma.invoice.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  })

  const totals = {
    draft: invoices.filter((i) => i.status === "DRAFT").reduce((s, i) => s + Number(i.total), 0),
    sent: invoices.filter((i) => i.status === "SENT").reduce((s, i) => s + Number(i.total), 0),
    paid: invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total), 0),
    overdue: invoices.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + Number(i.total), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Manage your accounts receivable</p>
        </div>
        <Button asChild>
          <Link href="/finance/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Draft", value: totals.draft, count: invoices.filter((i) => i.status === "DRAFT").length, color: "text-gray-600" },
          { label: "Sent", value: totals.sent, count: invoices.filter((i) => i.status === "SENT").length, color: "text-blue-600" },
          { label: "Overdue", value: totals.overdue, count: invoices.filter((i) => i.status === "OVERDUE").length, color: "text-red-600" },
          { label: "Paid", value: totals.paid, count: invoices.filter((i) => i.status === "PAID").length, color: "text-green-600" },
        ].map(({ label, value, count, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{formatCurrency(value)}</p>
            <p className="text-xs text-muted-foreground">{count} invoice{count !== 1 ? "s" : ""}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No invoices yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first invoice to get started</p>
              <Button asChild>
                <Link href="/finance/invoices/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const cfg = statusConfig[invoice.status] ?? statusConfig.DRAFT
                  return (
                    <TableRow key={invoice.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{invoice.number}</TableCell>
                      <TableCell className="font-medium">{invoice.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(invoice.issueDate)}</TableCell>
                      <TableCell className={cn(
                        "text-muted-foreground",
                        invoice.status === "OVERDUE" && "text-red-600 font-medium"
                      )}>
                        {formatDate(invoice.dueDate)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(invoice.total), invoice.currency)}
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
