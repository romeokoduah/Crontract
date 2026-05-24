"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

type RateType =
  | "PAYE_BRACKET" | "SSNIT_EMPLOYEE" | "SSNIT_EMPLOYER" | "TIER2"
  | "RELIEF_PERSONAL" | "RELIEF_MARRIAGE" | "RELIEF_DEPENDANT_PER_CHILD"
  | "RELIEF_OLD_AGE" | "RELIEF_AGED_DEPENDANT" | "RELIEF_DISABILITY_PCT"

type Rate = {
  id: string
  taxYear: number
  type: RateType
  value: number
  bracketMin: number | null
  bracketMax: number | null
  sequence: number
}

const RATE_LABEL: Record<RateType, string> = {
  PAYE_BRACKET: "PAYE Bracket",
  SSNIT_EMPLOYEE: "SSNIT Employee %",
  SSNIT_EMPLOYER: "SSNIT Employer %",
  TIER2: "Tier 2 %",
  RELIEF_PERSONAL: "Personal Relief (GHS/year)",
  RELIEF_MARRIAGE: "Marriage Relief (GHS/year)",
  RELIEF_DEPENDANT_PER_CHILD: "Dependant Child Relief (GHS/year, max 3)",
  RELIEF_OLD_AGE: "Old-Age Relief (GHS/year)",
  RELIEF_AGED_DEPENDANT: "Aged-Dependant Relief (GHS/year)",
  RELIEF_DISABILITY_PCT: "Disability Relief (% of assessable)",
}

const SINGLE_VALUE_TYPES: RateType[] = [
  "SSNIT_EMPLOYEE","SSNIT_EMPLOYER","TIER2",
  "RELIEF_PERSONAL","RELIEF_MARRIAGE","RELIEF_DEPENDANT_PER_CHILD",
  "RELIEF_OLD_AGE","RELIEF_AGED_DEPENDANT","RELIEF_DISABILITY_PCT",
]

export function TaxSettingsClient({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState(defaultYear)
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [dirty, setDirty] = useState<Record<string, Partial<Rate>>>({})
  const [newBracket, setNewBracket] = useState<{ min: string; max: string; rate: string }>({ min: "", max: "", rate: "" })

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/payroll/tax-rates?year=${year}`)
    const d = await r.json()
    setRates(d.rates ?? [])
    setDirty({})
    setLoading(false)
  }

  useEffect(() => { load() }, [year])

  function patchLocal(id: string, patch: Partial<Rate>) {
    setDirty(d => ({ ...d, [id]: { ...d[id], ...patch } }))
  }

  async function save(rate: Rate) {
    const patch = dirty[rate.id]
    if (!patch) return
    setSaving(rate.id)
    try {
      const payload = {
        id: rate.id,
        taxYear: rate.taxYear,
        type: rate.type,
        value: Number(patch.value ?? rate.value),
        bracketMin: patch.bracketMin !== undefined ? (patch.bracketMin === null ? null : Number(patch.bracketMin)) : rate.bracketMin,
        bracketMax: patch.bracketMax !== undefined ? (patch.bracketMax === null ? null : Number(patch.bracketMax)) : rate.bracketMax,
        sequence: rate.sequence,
      }
      const r = await fetch("/api/payroll/tax-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? "Save failed")
      toast.success("Rate updated")
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(null)
    }
  }

  async function remove(rate: Rate) {
    if (!confirm(`Delete this rate? (${RATE_LABEL[rate.type]} for ${rate.taxYear})`)) return
    const r = await fetch(`/api/payroll/tax-rates/${rate.id}`, { method: "DELETE" })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(body.error ?? "Delete failed")
      return
    }
    toast.success("Deleted")
    load()
  }

  async function addBracket() {
    if (!newBracket.min || !newBracket.rate) return
    setSaving("new")
    try {
      const r = await fetch("/api/payroll/tax-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxYear: year,
          type: "PAYE_BRACKET",
          value: Number(newBracket.rate),
          bracketMin: Number(newBracket.min),
          bracketMax: newBracket.max ? Number(newBracket.max) : null,
          sequence: (rates.filter(r => r.type === "PAYE_BRACKET").length),
        }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? "Add failed")
      toast.success("Bracket added")
      setNewBracket({ min: "", max: "", rate: "" })
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(null)
    }
  }

  const brackets = rates.filter(r => r.type === "PAYE_BRACKET").sort((a, b) => a.sequence - b.sequence)
  const singles = SINGLE_VALUE_TYPES.map(t => ({ type: t, row: rates.find(r => r.type === t) ?? null }))

  const years = [defaultYear - 1, defaultYear, defaultYear + 1, defaultYear + 2]

  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <label className="text-sm">Year:</label>
        <select className="rounded border px-2 py-1.5 bg-background text-sm"
          value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <h2 className="font-semibold">PAYE Brackets (annual GHS)</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 w-12">#</th>
                <th className="py-2">Lower</th>
                <th className="py-2">Upper</th>
                <th className="py-2">Rate (decimal — e.g. 0.05 for 5%)</th>
                <th className="py-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {brackets.map((b, i) => {
                const patch = dirty[b.id] ?? {}
                const isDirty = !!dirty[b.id]
                return (
                  <tr key={b.id} className="border-t">
                    <td className="py-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2">
                      <input type="number" step="0.01" className="w-32 rounded border px-2 py-1 bg-background"
                        defaultValue={Number(b.bracketMin ?? 0)}
                        onChange={e => patchLocal(b.id, { bracketMin: Number(e.target.value) })} />
                    </td>
                    <td className="py-2">
                      <input type="number" step="0.01" className="w-32 rounded border px-2 py-1 bg-background"
                        defaultValue={b.bracketMax != null ? Number(b.bracketMax) : ""}
                        placeholder="∞"
                        onChange={e => patchLocal(b.id, { bracketMax: e.target.value === "" ? null : Number(e.target.value) })} />
                    </td>
                    <td className="py-2">
                      <input type="number" step="0.001" className="w-24 rounded border px-2 py-1 bg-background"
                        defaultValue={Number(b.value)}
                        onChange={e => patchLocal(b.id, { value: Number(e.target.value) })} />
                    </td>
                    <td className="py-2 text-right space-x-1">
                      {isDirty && (
                        <Button size="sm" onClick={() => save(b)} disabled={saving === b.id}>
                          {saving === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t bg-muted/30">
                <td className="py-2 text-muted-foreground">New</td>
                <td className="py-2">
                  <input type="number" step="0.01" className="w-32 rounded border px-2 py-1 bg-background"
                    placeholder="Lower" value={newBracket.min}
                    onChange={e => setNewBracket({ ...newBracket, min: e.target.value })} />
                </td>
                <td className="py-2">
                  <input type="number" step="0.01" className="w-32 rounded border px-2 py-1 bg-background"
                    placeholder="Upper (blank = ∞)" value={newBracket.max}
                    onChange={e => setNewBracket({ ...newBracket, max: e.target.value })} />
                </td>
                <td className="py-2">
                  <input type="number" step="0.001" className="w-24 rounded border px-2 py-1 bg-background"
                    placeholder="0.05" value={newBracket.rate}
                    onChange={e => setNewBracket({ ...newBracket, rate: e.target.value })} />
                </td>
                <td className="py-2 text-right">
                  <Button size="sm" onClick={addBracket} disabled={saving === "new"}>
                    {saving === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" /> Add</>}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <h2 className="font-semibold">Statutory Rates & Reliefs</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Setting</th>
                <th className="py-2">Value</th>
                <th className="py-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {singles.map(s => {
                const isMissing = !s.row
                const id = s.row?.id ?? `missing-${s.type}`
                return (
                  <tr key={id} className="border-t">
                    <td className="py-2">{RATE_LABEL[s.type]}</td>
                    <td className="py-2">
                      {isMissing ? (
                        <span className="text-rose-600 text-xs">Not configured — using 0</span>
                      ) : (
                        <input type="number" step="0.0001" className="w-32 rounded border px-2 py-1 bg-background"
                          defaultValue={Number(s.row!.value)}
                          onChange={e => patchLocal(s.row!.id, { value: Number(e.target.value) })} />
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {s.row && dirty[s.row.id] && (
                        <Button size="sm" onClick={() => save(s.row!)} disabled={saving === s.row!.id}>
                          {saving === s.row!.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
