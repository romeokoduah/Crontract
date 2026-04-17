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
import { Plus, Receipt } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  RECEIVED: { label: "Received", className: "bg-blue-100 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-amber-100 text-amber-700 border-amber-200" },
  PAID: { label: "Paid", className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

export default async function BillsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const bills = await prisma.bill.findMany({
    where: { workspaceId },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const totals = {
    draft: bills.filter((b) => b.status === "DRAFT").reduce((s, b) => s + Number(b.total), 0),
    received: bills.filter((b) => b.status === "RECEIVED").reduce((s, b) => s + Number(b.total), 0),
    approved: bills.filter((b) => b.status === "APPROVED").reduce((s, b) => s + Number(b.total), 0),
    paid: bills.filter((b) => b.status === "PAID").reduce((s, b) => s + Number(b.total), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
          <p className="text-muted-foreground">Manage your accounts payable</p>
        </div>
        <Button asChild>
          <Link href="/finance/bills/new">
            <Plus className="h-4 w-4 mr-2" />
            Record Bill
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Draft", value: totals.draft, count: bills.filter((b) => b.status === "DRAFT").length, color: "text-gray-600" },
          { label: "Received", value: totals.received, count: bills.filter((b) => b.status === "RECEIVED").length, color: "text-blue-600" },
          { label: "Approved", value: totals.approved, count: bills.filter((b) => b.status === "APPROVED").length, color: "text-amber-600" },
          { label: "Paid", value: totals.paid, count: bills.filter((b) => b.status === "PAID").length, color: "text-green-600" },
        ].map(({ label, value, count, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{formatCurrency(value)}</p>
            <p className="text-xs text-muted-foreground">{count} bill{count !== 1 ? "s" : ""}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {bills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No bills yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Record your first bill to track payables</p>
              <Button asChild>
                <Link href="/finance/bills/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Record Bill
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => {
                  const cfg = statusConfig[bill.status] ?? statusConfig.DRAFT
                  return (
                    <TableRow key={bill.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-semibold">{bill.number}</TableCell>
                      <TableCell className="font-medium">{bill.vendor.name}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(bill.issueDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(bill.dueDate)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(bill.total), bill.currency)}
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
