import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, cn } from "@/lib/utils"
import { ShoppingCart, Clock, CheckCircle, DollarSign, Plus, ArrowRight } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
  SENT: { label: "Sent", className: "bg-amber-100 text-amber-700 border-amber-200" },
  PARTIALLY_RECEIVED: { label: "Partial", className: "bg-orange-100 text-orange-700 border-orange-200" },
  RECEIVED: { label: "Received", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  BILLED: { label: "Billed", className: "bg-purple-100 text-purple-700 border-purple-200" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

export default async function ProcurementPage() {
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
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const orders = await prisma.purchaseOrder.findMany({
    where: { workspaceId },
    include: { vendor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const openPOs = orders.filter((o) => !["RECEIVED", "BILLED", "CANCELLED"].includes(o.status)).length
  const pendingApprovals = orders.filter((o) => o.status === "SUBMITTED").length
  const thisMonthSpend = orders
    .filter((o) => o.status !== "CANCELLED" && new Date(o.issueDate) >= startOfMonth)
    .reduce((sum, o) => sum + Number(o.total), 0)

  const recentOrders = orders.slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Procurement</h1>
          <p className="text-muted-foreground">Manage purchasing and vendor relationships</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/procurement/requisitions">
              <Plus className="h-4 w-4 mr-2" />
              Requisition
            </Link>
          </Button>
          <Button asChild>
            <Link href="/procurement/orders/new">
              <Plus className="h-4 w-4 mr-2" />
              Purchase Order
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              Open Purchase Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{openPOs}</p>
            <p className="text-xs text-muted-foreground mt-1">Active orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{pendingApprovals}</p>
            <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              This Month Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(thisMonthSpend)}</p>
            <p className="text-xs text-muted-foreground mt-1">Committed value</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent POs */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Purchase Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/procurement/orders">
                View all
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No purchase orders yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => {
                    const cfg = statusConfig[order.status] ?? statusConfig.DRAFT
                    return (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Link href={`/procurement/orders/${order.id}`} className="font-mono text-sm font-semibold hover:underline text-blue-600">
                            {order.number}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{order.vendor.name}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(order.total), order.currency)}
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

        {/* Quick Links */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/procurement/orders/new", label: "Create Purchase Order", icon: ShoppingCart },
                { href: "/procurement/requisitions", label: "Purchase Requisitions", icon: Clock },
                { href: "/procurement/vendors", label: "Vendor Master", icon: CheckCircle },
                { href: "/procurement/vendors/new", label: "Add Vendor", icon: Plus },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {pendingApprovals > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {pendingApprovals} order{pendingApprovals !== 1 ? "s" : ""} awaiting approval
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">Review and approve submitted orders</p>
                    <Button size="sm" variant="outline" className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
                      <Link href="/procurement/orders">Review</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
