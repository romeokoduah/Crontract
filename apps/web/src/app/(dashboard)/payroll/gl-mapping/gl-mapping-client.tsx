"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Check, AlertCircle } from "lucide-react"
import { toast } from "sonner"

type LineType =
  | "WAGES_EXPENSE"
  | "EMPLOYER_SSNIT_EXPENSE"
  | "EMPLOYER_TIER2_EXPENSE"
  | "SSNIT_PAYABLE"
  | "PAYE_PAYABLE"
  | "TIER2_PAYABLE"
  | "LOAN_RECEIVABLE"
  | "NET_PAY_CLEARING"

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"

type Account = { id: string; code: string; name: string; type: AccountType; isActive: boolean }
type Mapping = { lineType: LineType; accountId: string; account?: Account }
type Default = { lineType: LineType; code: string; name: string; type: AccountType }

const LABELS: Record<LineType, string> = {
  WAGES_EXPENSE: "Wages & Salaries Expense (Dr)",
  EMPLOYER_SSNIT_EXPENSE: "Employer SSNIT Expense (Dr)",
  EMPLOYER_TIER2_EXPENSE: "Employer Tier 2 Expense (Dr)",
  SSNIT_PAYABLE: "SSNIT Payable (Cr)",
  PAYE_PAYABLE: "PAYE Payable (Cr)",
  TIER2_PAYABLE: "Tier 2 Payable (Cr)",
  LOAN_RECEIVABLE: "Staff Loans Receivable (Cr)",
  NET_PAY_CLEARING: "Net Pay Clearing (Cr)",
}

const TYPE_FILTER: Record<LineType, AccountType[]> = {
  WAGES_EXPENSE: ["EXPENSE"],
  EMPLOYER_SSNIT_EXPENSE: ["EXPENSE"],
  EMPLOYER_TIER2_EXPENSE: ["EXPENSE"],
  SSNIT_PAYABLE: ["LIABILITY"],
  PAYE_PAYABLE: ["LIABILITY"],
  TIER2_PAYABLE: ["LIABILITY"],
  LOAN_RECEIVABLE: ["ASSET"],
  NET_PAY_CLEARING: ["LIABILITY", "ASSET"],
}

type Choice =
  | { mode: "create" }
  | { mode: "existing"; accountId: string }
  | { mode: "unset" }

export function GlMappingClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaults, setDefaults] = useState<Default[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentMappings, setCurrentMappings] = useState<Mapping[]>([])
  const [choices, setChoices] = useState<Partial<Record<LineType, Choice>>>({})

  useEffect(() => {
    fetch("/api/payroll/gl-mapping")
      .then(r => r.json())
      .then(d => {
        setDefaults(d.defaults)
        setAccounts(d.accounts)
        setCurrentMappings(d.mappings)
        // Pre-populate choices from current mappings if present
        const init: Partial<Record<LineType, Choice>> = {}
        for (const def of d.defaults as Default[]) {
          const existing = (d.mappings as Mapping[]).find(m => m.lineType === def.lineType)
          init[def.lineType] = existing
            ? { mode: "existing", accountId: existing.accountId }
            : { mode: "create" }
        }
        setChoices(init)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error("Failed to load GL mapping")
        setLoading(false)
      })
  }, [])

  const setChoice = (lineType: LineType, c: Choice) =>
    setChoices(prev => ({ ...prev, [lineType]: c }))

  async function apply() {
    setSaving(true)
    try {
      const mappings = defaults.map(def => {
        const c = choices[def.lineType]
        if (!c || c.mode === "unset") {
          throw new Error(`No choice for ${def.lineType}`)
        }
        if (c.mode === "create") {
          return { lineType: def.lineType, create: true }
        }
        return { lineType: def.lineType, accountId: c.accountId }
      })
      const res = await fetch("/api/payroll/gl-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Apply failed")
      toast.success("GL mapping applied")
      // refresh
      const d = await fetch("/api/payroll/gl-mapping").then(r => r.json())
      setAccounts(d.accounts)
      setCurrentMappings(d.mappings)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading mapping…
      </div>
    )
  }

  const allMapped = currentMappings.length === 8

  return (
    <div className="space-y-4">
      <div className={`rounded-md border p-3 text-sm flex items-start gap-2 ${allMapped ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {allMapped ? <Check className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
        <div>
          {allMapped
            ? "All 8 payroll lines are mapped. Payroll runs can be posted."
            : `Mapped ${currentMappings.length}/8 lines — payroll runs cannot be posted until all 8 are set.`}
        </div>
      </div>

      <div className="grid gap-3">
        {defaults.map(def => {
          const choice = choices[def.lineType] ?? { mode: "create" }
          const eligible = accounts.filter(a => TYPE_FILTER[def.lineType].includes(a.type))
          return (
            <Card key={def.lineType}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{LABELS[def.lineType]}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Default: <code>{def.code}</code> — {def.name} ({def.type})
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={choice.mode === "create"}
                      onChange={() => setChoice(def.lineType, { mode: "create" })}
                    />
                    <span>Create new account ({def.code})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={choice.mode === "existing"}
                      onChange={() => setChoice(def.lineType, { mode: "existing", accountId: eligible[0]?.id ?? "" })}
                      disabled={eligible.length === 0}
                    />
                    <span>Map to existing</span>
                  </label>
                </div>
                {choice.mode === "existing" && (
                  <select
                    className="w-full rounded border px-2 py-1.5 text-sm bg-background"
                    value={(choice as { mode: "existing"; accountId: string }).accountId}
                    onChange={e => setChoice(def.lineType, { mode: "existing", accountId: e.target.value })}
                  >
                    {eligible.length === 0 && <option value="">No accounts of compatible type</option>}
                    {eligible.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={apply} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying…</> : "Apply Mapping"}
        </Button>
      </div>
    </div>
  )
}
