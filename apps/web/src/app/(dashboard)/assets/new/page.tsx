"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Package, ArrowLeft } from "lucide-react"

interface AssetCategory {
  id: string
  name: string
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "MAINTENANCE", label: "Under Maintenance" },
  { value: "CHECKED_OUT", label: "Checked Out" },
  { value: "RETIRED", label: "Retired" },
]

export default function NewAssetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<AssetCategory[]>([])

  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    location: "",
    serialNumber: "",
    purchaseDate: "",
    purchaseCost: "",
    currentValue: "",
    status: "ACTIVE",
    warrantyExpiry: "",
    notes: "",
  })

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.categoryId) {
      setError("Please select a category")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          categoryId: form.categoryId,
          location: form.location || undefined,
          serialNumber: form.serialNumber || undefined,
          purchaseDate: form.purchaseDate,
          purchaseCost: parseFloat(form.purchaseCost) || 0,
          currentValue: parseFloat(form.currentValue || form.purchaseCost) || 0,
          status: form.status,
          warrantyExpiry: form.warrantyExpiry || undefined,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to create asset")
        return
      }
      router.push("/assets")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function field(id: keyof typeof form, label: string, opts?: {
    type?: string
    placeholder?: string
    required?: boolean
    hint?: string
  }) {
    const { type = "text", placeholder = "", required = false, hint } = opts ?? {}
    return (
      <div>
        <Label htmlFor={id}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {hint && <p className="text-xs text-muted-foreground mb-1">{hint}</p>}
        <input
          id={id}
          type={type}
          required={required}
          value={form[id]}
          onChange={(e) => setForm((p) => ({ ...p, [id]: e.target.value }))}
          placeholder={placeholder}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/assets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Add Asset
          </h1>
          <p className="text-muted-foreground text-sm">Register a new asset to the register</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {field("name", "Asset Name", { required: true, placeholder: "e.g. Caterpillar 320 Excavator" })}
            {field("description", "Description", { placeholder: "Optional description" })}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="categoryId">
                  Category <span className="text-destructive">*</span>
                </Label>
                <select
                  id="categoryId"
                  required
                  value={form.categoryId}
                  onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No categories found. Add one in Admin settings.</p>
                )}
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {field("location", "Location", { placeholder: "e.g. Site A, Warehouse 2" })}
              {field("serialNumber", "Serial Number", { placeholder: "Manufacturer S/N" })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {field("purchaseDate", "Purchase Date", { type: "date", required: true })}
              {field("purchaseCost", "Purchase Cost (GHS)", {
                type: "number",
                required: true,
                placeholder: "0.00",
              })}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {field("currentValue", "Current Value (GHS)", {
                type: "number",
                placeholder: "Defaults to purchase cost",
                hint: "Leave blank to use purchase cost",
              })}
              {field("warrantyExpiry", "Warranty Expiry", { type: "date" })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Additional notes, maintenance history, etc."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/assets">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? "Saving…" : "Add Asset"}
          </Button>
        </div>
      </form>
    </div>
  )
}
