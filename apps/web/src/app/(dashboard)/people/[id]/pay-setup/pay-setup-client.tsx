"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

type Component = {
  id: string
  code: string
  name: string
  type: "EARNING" | "DEDUCTION" | "STATUTORY" | "LOAN"
  defaultAmount: number | null
}

type Setup = {
  id: string
  amount: number
  startDate: string
  endDate: string | null
  payComponent: Component
}

const today = () => new Date().toISOString().slice(0, 10)

export function PaySetupClient({ employeeId }: { employeeId: string }) {
  const [setups, setSetups] = useState<Setup[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ payComponentId: "", amount: "", startDate: today(), endDate: "" })

  async function load() {
    setLoading(true)
    const [a, b] = await Promise.all([
      fetch(`/api/payroll/employees/${employeeId}/setup`).then(r => r.json()),
      fetch(`/api/payroll/components`).then(r => r.json()),
    ])
    setSetups(a.setups ?? [])
    setComponents((b.components ?? []).filter((c: Component) => c.type !== "STATUTORY"))
    setLoading(false)
  }

  useEffect(() => { load() }, [employeeId])

  function openNew() {
    setForm({ payComponentId: components[0]?.id ?? "", amount: "", startDate: today(), endDate: "" })
    setShowForm(true)
  }

  async function submit() {
    setSaving(true)
    try {
      const r = await fetch(`/api/payroll/employees/${employeeId}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payComponentId: form.payComponentId,
          amount: Number(form.amount),
          startDate: form.startDate,
          endDate: form.endDate || null,
        }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? "Save failed")
      toast.success("Pay component added")
      setShowForm(false)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(s: Setup) {
    if (!confirm(`Remove ${s.payComponent.code} from this employee's pay setup?`)) return
    const r = await fetch(`/api/payroll/employees/${employeeId}/setup/${s.id}`, { method: "DELETE" })
    if (!r.ok) {
      toast.error("Delete failed")
      return
    }
    toast.success("Removed")
    load()
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add component</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3">Component</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Amount (GHS)</th>
                <th className="p-3">Start</th>
                <th className="p-3">End</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {setups.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No pay components configured yet.</td></tr>
              )}
              {setups.map(s => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3"><span className="font-mono text-xs mr-2">{s.payComponent.code}</span>{s.payComponent.name}</td>
                  <td className="p-3 text-xs">{s.payComponent.type}</td>
                  <td className="p-3 text-right font-mono">{Number(s.amount).toLocaleString()}</td>
                  <td className="p-3">{s.startDate.slice(0, 10)}</td>
                  <td className="p-3">{s.endDate ? s.endDate.slice(0, 10) : "—"}</td>
                  <td className="p-3"><Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Add pay component</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block mb-1">Component</label>
                <select
                  className="w-full rounded border px-2 py-1.5 bg-background"
                  value={form.payComponentId}
                  onChange={e => {
                    const comp = components.find(c => c.id === e.target.value)
                    setForm({ ...form, payComponentId: e.target.value, amount: comp?.defaultAmount?.toString() ?? form.amount })
                  }}
                >
                  {components.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1">Amount</label>
                <input
                  type="number" step="0.01"
                  className="w-full rounded border px-2 py-1.5 bg-background"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Start date</label>
                  <input type="date" className="w-full rounded border px-2 py-1.5 bg-background"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1">End date (optional)</label>
                  <input type="date" className="w-full rounded border px-2 py-1.5 bg-background"
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !form.amount || !form.payComponentId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
