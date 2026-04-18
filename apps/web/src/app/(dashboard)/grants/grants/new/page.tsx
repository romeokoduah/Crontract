"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react"

interface BudgetLine {
  category: string
  amount: number
}

interface DonorOption {
  id: string
  name: string
}

const CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN", "ZAR"]

const STATUSES = [
  { value: "PIPELINE", label: "Pipeline" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CLOSEOUT", label: "Close-out" },
  { value: "CLOSED", label: "Closed" },
]

const FREQUENCIES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-Annual" },
  { value: "ANNUAL", label: "Annual" },
]

export default function NewGrantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [donors, setDonors] = useState<DonorOption[]>([])

  const [title, setTitle] = useState("")
  const [donorId, setDonorId] = useState("")
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState("GHS")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split("T")[0]
  })
  const [status, setStatus] = useState("PIPELINE")
  const [reportingFrequency, setReportingFrequency] = useState("QUARTERLY")
  const [programArea, setProgramArea] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<BudgetLine[]>([
    { category: "", amount: 0 },
  ])

  useEffect(() => {
    fetch("/api/grants/donors")
      .then((r) => r.json())
      .then((data) => {
        if (data.donors) {
          setDonors(data.donors.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })))
        }
      })
      .catch(() => {})
  }, [])

  const totalBudget = lines.reduce((s, l) => s + l.amount, 0)

  function updateLine(idx: number, field: keyof BudgetLine, value: string | number) {
    setLines((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function addLine() {
    setLines((prev) => [...prev, { category: "", amount: 0 }])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function submit() {
    setError(null)
    if (!title.trim()) { setError("Grant title is required"); return }
    if (!donorId) { setError("Please select a donor"); return }
    if (amount <= 0) { setError("Amount must be positive"); return }

    setLoading(true)
    try {
      const budgetLines = lines.filter((l) => l.category.trim())
      const res = await fetch("/api/grants/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          donorId,
          amount,
          currency,
          startDate,
          endDate,
          status,
          reportingFrequency,
          programArea: programArea || undefined,
          contactPerson: contactPerson || undefined,
          description: description || undefined,
          notes: notes || undefined,
          lines: budgetLines.length > 0 ? budgetLines : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create grant")
      }
      router.push("/grants/grants")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/grants/grants">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Grant</h1>
          <p className="text-muted-foreground">Create a new grant record</p>
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
          {/* Grant Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grant Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="title">Grant Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. Community Health Programme 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Donor *</Label>
                <Select value={donorId} onValueChange={setDonorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select donor" />
                  </SelectTrigger>
                  <SelectContent>
                    {donors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Grant Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount || ""}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
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
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reporting Frequency</Label>
                <Select value={reportingFrequency} onValueChange={setReportingFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="programArea">Program Area</Label>
                <Input
                  id="programArea"
                  placeholder="e.g. Health, Education"
                  value={programArea}
                  onChange={(e) => setProgramArea(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  placeholder="Grant manager name"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Grant objectives and scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Budget Lines */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Budget Lines</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
                <span className="col-span-7">Category</span>
                <span className="col-span-4 text-right">Planned Amount</span>
                <span className="col-span-1" />
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-7">
                    <Input
                      placeholder="e.g. Personnel, Equipment"
                      value={line.category}
                      onChange={(e) => updateLine(idx, "category", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={line.amount || ""}
                      onChange={(e) => updateLine(idx, "amount", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-right"
                    />
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
                  <span className="text-muted-foreground">Grant Amount</span>
                  <span className="font-medium">{formatCurrency(amount, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Budget Lines</span>
                  <span className="font-medium">{formatCurrency(totalBudget, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{currency}</span>
                </div>
                {amount > 0 && totalBudget > 0 && totalBudget !== amount && (
                  <div className="flex justify-between text-amber-600">
                    <span>Difference</span>
                    <span className="font-medium">{formatCurrency(amount - totalBudget, currency)}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  className="w-full bg-pink-600 hover:bg-pink-700"
                  onClick={submit}
                  disabled={loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Saving..." : "Save Grant"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
