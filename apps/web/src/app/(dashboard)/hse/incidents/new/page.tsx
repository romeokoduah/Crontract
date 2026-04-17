"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react"

interface InjuredPerson {
  name: string
  injuryType: string
  severity: string
}

const SEVERITY_OPTIONS = [
  { value: "NEAR_MISS", label: "Near Miss", color: "bg-blue-100 text-blue-700" },
  { value: "MINOR", label: "Minor", color: "bg-amber-100 text-amber-700" },
  { value: "MODERATE", label: "Moderate", color: "bg-orange-100 text-orange-700" },
  { value: "MAJOR", label: "Major", color: "bg-red-100 text-red-700" },
  { value: "FATAL", label: "Fatal", color: "bg-gray-900 text-white" },
]

const TYPE_OPTIONS = [
  "INJURY", "PROPERTY_DAMAGE", "ENVIRONMENTAL", "NEAR_MISS",
  "VEHICLE", "FIRE", "CHEMICAL", "ELECTRICAL", "OTHER",
]

export default function NewIncidentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: "",
    description: "",
    incidentDate: "",
    location: "",
    severity: "",
    type: "",
    witnesses: [""],
  })

  const [injuredPersons, setInjuredPersons] = useState<InjuredPerson[]>([])

  function addInjuredPerson() {
    setInjuredPersons((prev) => [...prev, { name: "", injuryType: "", severity: "" }])
  }

  function removeInjuredPerson(idx: number) {
    setInjuredPersons((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateInjuredPerson(idx: number, field: keyof InjuredPerson, value: string) {
    setInjuredPersons((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  function addWitness() {
    setForm((prev) => ({ ...prev, witnesses: [...prev.witnesses, ""] }))
  }

  function removeWitness(idx: number) {
    setForm((prev) => ({ ...prev, witnesses: prev.witnesses.filter((_, i) => i !== idx) }))
  }

  function updateWitness(idx: number, value: string) {
    setForm((prev) => ({
      ...prev,
      witnesses: prev.witnesses.map((w, i) => (i === idx ? value : w)),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.severity) { setError("Please select a severity level"); return }
    if (!form.type) { setError("Please select an incident type"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/hse/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          witnesses: form.witnesses.filter((w) => w.trim()),
          injuredPersons: injuredPersons.filter((p) => p.name.trim()),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to report incident")
        return
      }
      router.push(`/hse/incidents/${data.incident.id}`)
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
          <Link href="/hse/incidents"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Report Incident
          </h1>
          <p className="text-muted-foreground text-sm">Complete all fields as accurately as possible</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Incident Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Brief description of what happened"
              />
            </div>

            <div>
              <Label htmlFor="description">Full Description *</Label>
              <textarea
                id="description"
                required
                rows={5}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                placeholder="Describe the incident in detail: what happened, sequence of events, immediate actions taken..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="incidentDate">Incident Date &amp; Time *</Label>
                <input
                  id="incidentDate"
                  type="datetime-local"
                  required
                  value={form.incidentDate}
                  onChange={(e) => setForm((p) => ({ ...p, incidentDate: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <Label htmlFor="location">Location *</Label>
                <input
                  id="location"
                  required
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Level 3 Processing Plant, Pit 2"
                />
              </div>
            </div>

            {/* Severity */}
            <div>
              <Label>Severity *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, severity: opt.value }))}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all",
                      form.severity === opt.value
                        ? opt.color + " border-current scale-105 shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:border-muted-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <Label htmlFor="type">Incident Type *</Label>
              <select
                id="type"
                required
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select type...</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Injured Persons */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Injured Persons</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addInjuredPerson}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Person
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {injuredPersons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No injured persons recorded. Click Add Person if applicable.</p>
            ) : (
              injuredPersons.map((person, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 p-3 bg-muted/30 rounded-lg border">
                  <div>
                    <Label className="text-xs">Full Name</Label>
                    <input
                      value={person.name}
                      onChange={(e) => updateInjuredPerson(idx, "name", e.target.value)}
                      placeholder="Employee name"
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Injury Type</Label>
                    <input
                      value={person.injuryType}
                      onChange={(e) => updateInjuredPerson(idx, "injuryType", e.target.value)}
                      placeholder="e.g. Laceration, Fracture"
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Severity</Label>
                    <select
                      value={person.severity}
                      onChange={(e) => updateInjuredPerson(idx, "severity", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select…</option>
                      <option value="FIRST_AID">First Aid</option>
                      <option value="MEDICAL_TREATMENT">Medical Treatment</option>
                      <option value="LOST_TIME">Lost Time</option>
                      <option value="FATALITY">Fatality</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-0.5">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeInjuredPerson(idx)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Witnesses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Witnesses</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addWitness}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Witness
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {form.witnesses.map((w, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={w}
                  onChange={(e) => updateWitness(idx, e.target.value)}
                  placeholder={`Witness ${idx + 1} full name`}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {form.witnesses.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeWitness(idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/hse/incidents">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white min-w-[140px]">
            {loading ? "Submitting…" : "Report Incident"}
          </Button>
        </div>
      </form>
    </div>
  )
}
