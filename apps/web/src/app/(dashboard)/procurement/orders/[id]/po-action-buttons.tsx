"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Send,
  CheckCircle,
  Package,
  Truck,
  XCircle,
  Loader2,
} from "lucide-react"

interface POActionButtonsProps {
  orderId: string
  status: string
}

type Action = "submit" | "approve" | "send" | "receive" | "cancel"

export function POActionButtons({ orderId, status }: POActionButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0])
  const [receiptNotes, setReceiptNotes] = useState("")

  async function performAction(action: Action, extra?: Record<string, unknown>) {
    setError(null)
    setLoading(action)
    try {
      const res = await fetch(`/api/procurement/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Action failed")
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(null)
      setReceiveDialogOpen(false)
    }
  }

  const isLoading = loading !== null

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 flex-wrap justify-end">
        {status === "DRAFT" && (
          <Button
            onClick={() => performAction("submit")}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            {loading === "submit" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Submit for Approval
          </Button>
        )}

        {status === "SUBMITTED" && (
          <Button
            onClick={() => performAction("approve")}
            disabled={isLoading}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            {loading === "approve" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Approve
          </Button>
        )}

        {status === "APPROVED" && (
          <Button
            onClick={() => performAction("send")}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            {loading === "send" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
            Mark as Sent
          </Button>
        )}

        {(status === "SENT" || status === "PARTIALLY_RECEIVED") && (
          <Button
            onClick={() => setReceiveDialogOpen(true)}
            disabled={isLoading}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Package className="h-4 w-4 mr-2" />
            Record Receipt
          </Button>
        )}

        {["DRAFT", "SUBMITTED", "APPROVED"].includes(status) && (
          <Button
            onClick={() => performAction("cancel")}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
          >
            {loading === "cancel" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            Cancel
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* Receive Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Goods Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="receivedDate">Received Date</Label>
              <Input
                id="receivedDate"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receiptNotes">Notes</Label>
              <Textarea
                id="receiptNotes"
                placeholder="Condition, partial delivery notes, etc."
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => performAction("receive", {
                receivedDate,
                receiptNotes,
                receiptLines: [],
              })}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading === "receive" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
