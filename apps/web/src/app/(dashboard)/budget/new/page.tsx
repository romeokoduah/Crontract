"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn, formatCurrency } from "@/lib/utils"
import { PiggyBank, ArrowLeft, Plus, Trash2 } from "lucide-react"

interface BudgetLine {
  category: string
  description: string
  budgetAmount: string
  actualAmount: string
  committedAmount: string
}

export default function NewBudgetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    year: new Date().getFullYear().toString(),
    status: "DRAFT",
  })

  const [lines, setLines] = useState<BudgetLine[]>([
    { category: "", description: "", budgetAmount: "", actualAmount: "0", committedAmount: "0" },
  ])

  function addLine() {
    setLines((prev) => [
      ...prev,
      { category: "", description: "", budgetAmount: "", actualAmount: "0", committedAmount: "0" },
    ])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof BudgetLine, value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const totalBudget = lines.reduce((s, l) => s + (parseFloat(l.budgetAmount) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validLines = lines.filter((l) => l.category.trim())
    if (validLines.length === 0) {
      setError("At least one budget line with a category is required")
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: form.name,
        year: parseInt(form.year),
        status: form.status,
        lines: validLines.map((l) => ({
          category: l.category,
          description: l.description || undefined,
          budgetAmount: parseFloat(l.budgetAmount) || 0,
          actualAmount: parseFloat(l.actualAmount) || 0,
          committedAmount: parseFloat(l.committedAmount) || 0,
        })),
      }

      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to create budget")
        return
      }
      router.push(`/budget/${data.budget.id}`)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/budget">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary" />
            New Budget
          </h1>
          <p className="text-muted-foreground text-sm">Create a new budget with line items</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Budget Name *</Label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. FY2026 Operating Budget"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Fiscal Year *</Label>
                <input
                  id="year"
                  type="number"
                  required
                  min={2020}
                  max={2050}
                  value={form.year}
                  onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ACTIVE">Active</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Budget Lines</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {formatCurrency(totalBudget)}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Line
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Headers */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 text-xs font-medium text-muted-foreground px-1">
              <span>Category *</span>
              <span>Description</span>
              <span>Budget Amount *</span>
              <span>Actual Spend</span>
              <span></span>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 p-3 bg-muted/30 rounded-lg border sm:bg-transparent sm:border-0 sm:p-0">
                <div>
                  <label className="sm:hidden text-xs text-muted-foreground block mb-1">Category *</label>
                  <input
                    required
                    value={line.category}
                    onChange={(e) => updateLine(idx, "category", e.target.value)}
                    placeholder="e.g. Salaries"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="sm:hidden text-xs text-muted-foreground block mb-1">Description</label>
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="sm:hidden text-xs text-muted-foreground block mb-1">Budget Amount *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={line.budgetAmount}
                    onChange={(e) => updateLine(idx, "budgetAmount", e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  />
                </div>
                <div>
                  <label className="sm:hidden text-xs text-muted-foreground block mb-1">Actual Spend</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.actualAmount}
                    onChange={(e) => updateLine(idx, "actualAmount", e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  />
                </div>
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className={cn(
                      "text-muted-foreground hover:text-destructive",
                      lines.length === 1 && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/budget">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? "Creating…" : "Create Budget"}
          </Button>
        </div>
      </form>
    </div>
  )
}
