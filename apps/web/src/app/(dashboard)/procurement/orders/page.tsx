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
import { Plus, ShoppingCart } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
  SENT: { label: "Sent to Vendor", className: "bg-amber-100 text-amber-700 border-amber-200" },
  PARTIALLY_RECEIVED: { label: "Partially Received", className: "bg-orange-100 text-orange-700 border-orange-200" },
  RECEIVED: { label: "Received", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  BILLED: { label: "Billed", className: "bg-purple-100 text-purple-700 border-purple-200" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

export default async function OrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const orders = await prisma.purchaseOrder.findMany({
    where: { workspaceId },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage and track purchase orders</p>
        </div>
        <Button asChild>
          <Link href="/procurement/orders/new">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Link>
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusConfig).map(([status, cfg]) => {
          const count = orders.filter((o) => o.status === status).length
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
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No purchase orders yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first purchase order</p>
              <Button asChild>
                <Link href="/procurement/orders/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Order
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const cfg = statusConfig[order.status] ?? statusConfig.DRAFT
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Link
                          href={`/procurement/orders/${order.id}`}
                          className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                        >
                          {order.number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{order.vendor.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{order.title}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(order.issueDate)}</TableCell>
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
    </div>
  )
}
