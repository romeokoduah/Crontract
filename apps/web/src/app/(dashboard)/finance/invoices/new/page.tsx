"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { Plus, Trash2, ArrowLeft, Send, Save } from "lucide-react"

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

const CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN", "ZAR"]

export default function NewInvoicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState<"draft" | "send" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [customerName, setCustomerName] = useState("")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split("T")[0]
  })
  const [currency, setCurrency] = useState("GHS")
  const [notes, setNotes] = useState("")
  const [taxRate, setTaxRate] = useState(0)
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, amount: 0 },
  ])

  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  function updateLine(idx: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => {
      const next = [...prev]
      const line = { ...next[idx], [field]: value }
      if (field === "quantity" || field === "unitPrice") {
        line.amount = Number(line.quantity) * Number(line.unitPrice)
      }
      next[idx] = line
      return next
    })
  }

  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, amount: 0 }])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function submit(status: "DRAFT" | "SENT") {
    setError(null)
    if (!customerName.trim()) { setError("Customer name is required"); return }
    if (lines.some((l) => !l.description.trim())) { setError("All line items need a description"); return }

    setLoading(status === "DRAFT" ? "draft" : "send")
    try {
      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          issueDate,
          dueDate,
          currency,
          lines,
          tax: taxAmount,
          notes,
          status,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create invoice")
      }
      router.push("/finance/invoices")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finance/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Invoice</h1>
          <p className="text-muted-foreground">Create a new customer invoice</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bill To</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  placeholder="Customer or company name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issueDate">Issue Date *</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
                <span className="col-span-5">Description</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Unit Price</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-1" />
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium tabular-nums">
                    {formatCurrency(line.amount, currency)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-500"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Payment terms, bank details, or any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary Panel */}
        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Tax (%)</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="h-7 w-20 text-right text-sm"
                  />
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax amount</span>
                    <span>{formatCurrency(taxAmount, currency)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full"
                  onClick={() => submit("SENT")}
                  disabled={loading !== null}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {loading === "send" ? "Sending..." : "Send Invoice"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => submit("DRAFT")}
                  disabled={loading !== null}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading === "draft" ? "Saving..." : "Save as Draft"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
