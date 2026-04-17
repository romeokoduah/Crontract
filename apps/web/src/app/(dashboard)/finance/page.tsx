import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileText,
  Receipt,
  CreditCard,
  Plus,
  ArrowRight,
} from "lucide-react"

export default async function FinancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const [invoices, bills] = await Promise.all([
    prisma.invoice.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } }),
    prisma.bill.findMany({ where: { workspaceId }, include: { vendor: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ])

  const totalRevenue = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.total), 0)

  const totalExpenses = bills
    .filter((b) => b.status === "PAID")
    .reduce((sum, b) => sum + Number(b.total), 0)

  const outstandingInvoices = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + Number(i.total), 0)

  const outstandingBills = bills
    .filter((b) => b.status === "RECEIVED" || b.status === "APPROVED")
    .reduce((sum, b) => sum + Number(b.total), 0)

  // Recent transactions: combine invoices and bills
  const recentInvoices = invoices.slice(0, 5).map((i) => ({
    id: i.id,
    type: "invoice" as const,
    number: i.number,
    party: i.customerName,
    date: i.issueDate,
    amount: Number(i.total),
    currency: i.currency,
    status: i.status,
    href: `/finance/invoices`,
  }))
  const recentBills = bills.slice(0, 5).map((b) => ({
    id: b.id,
    type: "bill" as const,
    number: b.number,
    party: b.vendor.name,
    date: b.issueDate,
    amount: Number(b.total),
    currency: b.currency,
    status: b.status,
    href: `/finance/bills`,
  }))

  const recentTransactions = [...recentInvoices, ...recentBills]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)

  const invoiceStatusColor: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    PAID: "bg-green-100 text-green-700",
    OVERDUE: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  }

  const billStatusColor: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    RECEIVED: "bg-blue-100 text-blue-700",
    APPROVED: "bg-amber-100 text-amber-700",
    PAID: "bg-green-100 text-green-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">Financial overview for your workspace</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/finance/invoices/new">
              <Plus className="h-4 w-4 mr-2" />
              Invoice
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/finance/bills">
              <Plus className="h-4 w-4 mr-2" />
              Bill
            </Link>
          </Button>
          <Button asChild>
            <Link href="/finance/expenses">
              <Plus className="h-4 w-4 mr-2" />
              Expense
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">From paid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">From paid bills</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Outstanding Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(outstandingInvoices)}</p>
            <p className="text-xs text-muted-foreground mt-1">Sent &amp; overdue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Outstanding Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(outstandingBills)}</p>
            <p className="text-xs text-muted-foreground mt-1">Received &amp; approved</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Receipt className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentTransactions.map((tx) => (
                  <div key={`${tx.type}-${tx.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold",
                        tx.type === "invoice" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {tx.type === "invoice" ? "INV" : "BIL"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.number}</p>
                        <p className="text-xs text-muted-foreground">{tx.party}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        tx.type === "invoice" ? invoiceStatusColor[tx.status] : billStatusColor[tx.status]
                      )}>
                        {tx.status}
                      </span>
                      <div className="text-right">
                        <p className={cn("text-sm font-semibold", tx.type === "invoice" ? "text-green-600" : "text-red-600")}>
                          {tx.type === "invoice" ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/finance/invoices/new", label: "Create Invoice", icon: FileText, color: "text-blue-500" },
                { href: "/finance/bills", label: "Record Bill", icon: Receipt, color: "text-amber-500" },
                { href: "/finance/expenses", label: "Submit Expense", icon: CreditCard, color: "text-purple-500" },
                { href: "/finance/accounts", label: "Chart of Accounts", icon: TrendingUp, color: "text-green-500" },
                { href: "/finance/journals", label: "Journal Entries", icon: FileText, color: "text-gray-500" },
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
              <CardTitle className="text-base">Net Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium text-green-600">+{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-medium text-red-600">-{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-sm font-semibold">Net</span>
                  <span className={cn("font-bold", totalRevenue - totalExpenses >= 0 ? "text-green-600" : "text-red-600")}>
                    {formatCurrency(totalRevenue - totalExpenses)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
