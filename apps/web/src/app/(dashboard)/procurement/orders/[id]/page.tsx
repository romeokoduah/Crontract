import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
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
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  FileText,
  Package,
  Receipt,
  AlertCircle,
} from "lucide-react"
import { POActionButtons } from "./po-action-buttons"

const statusConfig: Record<string, { label: string; className: string; dotColor: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200", dotColor: "bg-gray-400" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200", dotColor: "bg-blue-500" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200", dotColor: "bg-green-500" },
  SENT: { label: "Sent to Vendor", className: "bg-amber-100 text-amber-700 border-amber-200", dotColor: "bg-amber-500" },
  PARTIALLY_RECEIVED: { label: "Partially Received", className: "bg-orange-100 text-orange-700 border-orange-200", dotColor: "bg-orange-500" },
  RECEIVED: { label: "Received", className: "bg-emerald-100 text-emerald-700 border-emerald-200", dotColor: "bg-emerald-500" },
  BILLED: { label: "Billed", className: "bg-purple-100 text-purple-700 border-purple-200", dotColor: "bg-purple-500" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200", dotColor: "bg-gray-300" },
}

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

interface ReceiptLine {
  description: string
  quantityOrdered: number
  quantityReceived: number
}

export default async function PODetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) notFound()

  const workspaceId = session.user.workspaceId

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      vendor: true,
      goodsReceipts: { orderBy: { createdAt: "desc" } },
      bills: {
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!order) notFound()

  const lines = order.lines as unknown as LineItem[]
  const cfg = statusConfig[order.status] ?? statusConfig.DRAFT

  const hasReceipt = order.goodsReceipts.length > 0
  const hasBill = order.bills.length > 0
  const threeWayMatch = hasReceipt && hasBill

  // Three-way match status
  const poAmount = Number(order.total)
  const receiptComplete = order.status === "RECEIVED" || order.status === "BILLED"
  const billAmount = order.bills.reduce((s, b) => s + Number(b.total), 0)
  const amountMatch = hasBill && Math.abs(poAmount - billAmount) < 0.01

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/procurement/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-mono">{order.number}</h1>
              <span className={cn("text-sm px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5", cfg.className)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotColor)} />
                {cfg.label}
              </span>
            </div>
            <p className="text-muted-foreground mt-0.5">{order.title}</p>
          </div>
        </div>
        <POActionButtons orderId={order.id} status={order.status} />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vendor</p>
                <p className="font-semibold mt-0.5">{order.vendor.name}</p>
                {order.vendor.contactName && (
                  <p className="text-sm text-muted-foreground">{order.vendor.contactName}</p>
                )}
                {order.vendor.email && (
                  <p className="text-xs text-muted-foreground">{order.vendor.email}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Dates</p>
                <div className="flex justify-between gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Issued</span>
                    <p className="font-medium">{formatDate(order.issueDate)}</p>
                  </div>
                  {order.deliveryDate && (
                    <div>
                      <span className="text-muted-foreground text-xs">Delivery</span>
                      <p className="font-medium">{formatDate(order.deliveryDate)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Order Value</p>
              <p className="text-2xl font-bold">{formatCurrency(Number(order.total), order.currency)}</p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Subtotal: {formatCurrency(Number(order.subtotal), order.currency)}</span>
                {Number(order.tax) > 0 && (
                  <span>Tax: {formatCurrency(Number(order.tax), order.currency)}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Three-Way Match Visual */}
      <Card className={cn(
        "border-2",
        threeWayMatch && amountMatch
          ? "border-emerald-300 bg-emerald-50/30"
          : threeWayMatch
          ? "border-amber-300 bg-amber-50/30"
          : "border-dashed border-muted"
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Three-Way Match
            {threeWayMatch && amountMatch ? (
              <span className="text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                Matched
              </span>
            ) : threeWayMatch ? (
              <span className="text-xs text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                Partial Match
              </span>
            ) : (
              <span className="text-xs text-muted-foreground bg-muted border px-2 py-0.5 rounded-full font-medium">
                Pending
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {/* PO Node */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center border-2 transition-colors",
                "border-blue-300 bg-blue-50"
              )}>
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-blue-700">Purchase Order</p>
                <p className="text-xs text-muted-foreground font-mono">{order.number}</p>
                <p className="text-xs font-medium mt-0.5">{formatCurrency(poAmount, order.currency)}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </div>

            {/* Connector PO → Receipt */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={cn(
                "h-0.5 w-16 transition-colors",
                receiptComplete ? "bg-emerald-400" : "bg-gray-200"
              )} />
              {receiptComplete && (
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
              )}
            </div>

            {/* Receipt Node */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center border-2 transition-colors",
                hasReceipt
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 bg-gray-50"
              )}>
                <Package className={cn("h-6 w-6", hasReceipt ? "text-emerald-600" : "text-gray-400")} />
              </div>
              <div className="text-center">
                <p className={cn("text-xs font-semibold", hasReceipt ? "text-emerald-700" : "text-gray-400")}>
                  Goods Receipt
                </p>
                {hasReceipt ? (
                  <>
                    <p className="text-xs text-muted-foreground font-mono">{order.goodsReceipts[0].number}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(order.goodsReceipts[0].receivedDate)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Awaiting receipt</p>
                )}
              </div>
              {hasReceipt ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-gray-300" />
              )}
            </div>

            {/* Connector Receipt → Bill */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={cn(
                "h-0.5 w-16 transition-colors",
                hasBill && amountMatch ? "bg-emerald-400" : hasBill ? "bg-amber-400" : "bg-gray-200"
              )} />
              {hasBill && (
                <div className={cn(
                  "flex items-center justify-center h-5 w-5 rounded-full",
                  amountMatch ? "bg-emerald-100" : "bg-amber-100"
                )}>
                  {amountMatch ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </div>
              )}
            </div>

            {/* Bill Node */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center border-2 transition-colors",
                hasBill
                  ? amountMatch ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
                  : "border-gray-200 bg-gray-50"
              )}>
                <Receipt className={cn(
                  "h-6 w-6",
                  hasBill
                    ? amountMatch ? "text-emerald-600" : "text-amber-600"
                    : "text-gray-400"
                )} />
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-xs font-semibold",
                  hasBill ? (amountMatch ? "text-emerald-700" : "text-amber-700") : "text-gray-400"
                )}>
                  Vendor Bill
                </p>
                {hasBill ? (
                  <>
                    <p className="text-xs text-muted-foreground font-mono">{order.bills[0].number}</p>
                    <p className="text-xs font-medium mt-0.5">{formatCurrency(billAmount, order.currency)}</p>
                    {!amountMatch && (
                      <p className="text-xs text-amber-600">Amount mismatch</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Awaiting bill</p>
                )}
              </div>
              {hasBill && amountMatch ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : hasBill ? (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              ) : (
                <Circle className="h-4 w-4 text-gray-300" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-20">Qty</TableHead>
                <TableHead className="text-right w-32">Unit Price</TableHead>
                <TableHead className="text-right w-32">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{line.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(line.unitPrice, order.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(line.amount, order.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-6 py-4">
            <div className="flex flex-col items-end gap-1.5 text-sm">
              <div className="flex gap-8">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums w-28 text-right">{formatCurrency(Number(order.subtotal), order.currency)}</span>
              </div>
              {Number(order.tax) > 0 && (
                <div className="flex gap-8">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums w-28 text-right">{formatCurrency(Number(order.tax), order.currency)}</span>
                </div>
              )}
              <Separator className="w-48 my-1" />
              <div className="flex gap-8 font-bold text-base">
                <span>Total</span>
                <span className="tabular-nums w-28 text-right">{formatCurrency(Number(order.total), order.currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goods Receipts */}
      {order.goodsReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              Goods Receipts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.goodsReceipts.map((receipt) => {
              const receiptLines = receipt.lines as unknown as ReceiptLine[]
              return (
                <div key={receipt.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-emerald-800">{receipt.number}</span>
                      <span className="text-xs text-muted-foreground">
                        Received {formatDate(receipt.receivedDate)}
                      </span>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receiptLines.map((line, idx) => {
                        const variance = line.quantityReceived - line.quantityOrdered
                        return (
                          <TableRow key={idx}>
                            <TableCell>{line.description}</TableCell>
                            <TableCell className="text-right">{line.quantityOrdered}</TableCell>
                            <TableCell className="text-right font-medium">{line.quantityReceived}</TableCell>
                            <TableCell className={cn(
                              "text-right font-medium",
                              variance === 0 ? "text-emerald-600" : variance < 0 ? "text-amber-600" : "text-blue-600"
                            )}>
                              {variance > 0 ? "+" : ""}{variance}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  {receipt.notes && (
                    <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                      {receipt.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Bills */}
      {order.bills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-purple-600" />
              Associated Bills
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                {order.bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-mono text-sm font-semibold">{bill.number}</TableCell>
                    <TableCell>{bill.vendor.name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(bill.issueDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(bill.dueDate)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(Number(bill.total), bill.currency)}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-700">
                        {bill.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
