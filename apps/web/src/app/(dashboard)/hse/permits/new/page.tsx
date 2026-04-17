"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ShieldCheck, ArrowLeft, Plus, Trash2 } from "lucide-react"

const PERMIT_TYPES = [
  { value: "HOT_WORK", label: "Hot Work", description: "Welding, cutting, grinding" },
  { value: "CONFINED_SPACE", label: "Confined Space", description: "Entry into enclosed areas" },
  { value: "WORKING_AT_HEIGHT", label: "Working at Height", description: "Work above 1.8m" },
  { value: "ELECTRICAL", label: "Electrical", description: "Live electrical work" },
  { value: "EXCAVATION", label: "Excavation", description: "Digging, trenching" },
  { value: "GENERAL", label: "General", description: "Other hazardous work" },
]

export default function NewPermitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    type: "",
    title: "",
    location: "",
    description: "",
    validFrom: "",
    validTo: "",
  })

  const [hazards, setHazards] = useState([""])
  const [precautions, setPrecautions] = useState([""])

  function addItem(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter((prev) => [...prev, ""])
  }

  function removeItem(setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number) {
    setter((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateItem(setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number, value: string) {
    setter((prev) => prev.map((item, i) => (i === idx ? value : item)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.type) { setError("Please select a permit type"); return }
    if (form.validTo && form.validFrom && form.validTo < form.validFrom) {
      setError("Valid To must be after Valid From")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/hse/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          hazards: hazards.filter((h) => h.trim()),
          precautions: precautions.filter((p) => p.trim()),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to create permit"); return }
      router.push("/hse/permits")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/hse/permits"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-500" />
            New Permit to Work
          </h1>
          <p className="text-muted-foreground text-sm">Complete all required fields before work begins</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Permit Type */}
        <Card>
          <CardHeader><CardTitle className="text-base">Permit Type *</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PERMIT_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: pt.value }))}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-all",
                    form.type === pt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <p className="text-sm font-semibold">{pt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{pt.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Basic Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Brief work description"
              />
            </div>

            <div>
              <Label htmlFor="location">Location *</Label>
              <input
                id="location"
                required
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Processing Plant Level 2, Pit Section B"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                placeholder="Detailed scope of work…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="validFrom">Valid From *</Label>
                <input
                  id="validFrom"
                  type="datetime-local"
                  required
                  value={form.validFrom}
                  onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <Label htmlFor="validTo">Valid To *</Label>
                <input
                  id="validTo"
                  type="datetime-local"
                  required
                  value={form.validTo}
                  onChange={(e) => setForm((p) => ({ ...p, validTo: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hazards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Hazards Identified</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addItem(setHazards)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Hazard
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {hazards.map((h, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={h}
                  onChange={(e) => updateItem(setHazards, idx, e.target.value)}
                  placeholder={`Hazard ${idx + 1}…`}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {hazards.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(setHazards, idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Precautions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Precautions &amp; Controls</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addItem(setPrecautions)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Precaution
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {precautions.map((p, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={p}
                  onChange={(e) => updateItem(setPrecautions, idx, e.target.value)}
                  placeholder={`Control measure ${idx + 1}…`}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {precautions.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(setPrecautions, idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/hse/permits">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? "Creating…" : "Create Permit"}
          </Button>
        </div>
      </form>
    </div>
  )
}
