"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

type ComponentType = "EARNING" | "DEDUCTION" | "STATUTORY" | "LOAN"
type Component = {
  id: string
  code: string
  name: string
  type: ComponentType
  taxable: boolean
  pensionable: boolean
  defaultAmount: number | null
  sequence: number
}

const TYPE_LABEL: Record<ComponentType, string> = {
  EARNING: "Earning",
  DEDUCTION: "Deduction",
  STATUTORY: "Statutory",
  LOAN: "Loan",
}

const TYPE_COLOR: Record<ComponentType, string> = {
  EARNING: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DEDUCTION: "bg-amber-50 text-amber-700 border-amber-200",
  STATUTORY: "bg-blue-50 text-blue-700 border-blue-200",
  LOAN: "bg-rose-50 text-rose-700 border-rose-200",
}

const empty = {
  code: "",
  name: "",
  type: "EARNING" as ComponentType,
  taxable: true,
  pensionable: false,
  defaultAmount: "",
  sequence: 50,
}

export function ComponentsClient() {
  const [items, setItems] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Component | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const r = await fetch("/api/payroll/components")
    const d = await r.json()
    setItems(d.components ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(empty)
    setShowForm(true)
  }

  function openEdit(c: Component) {
    setEditing(c)
    setForm({
      code: c.code,
      name: c.name,
      type: c.type,
      taxable: c.taxable,
      pensionable: c.pensionable,
      defaultAmount: c.defaultAmount?.toString() ?? "",
      sequence: c.sequence,
    })
    setShowForm(true)
  }

  async function submit() {
    setSaving(true)
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        taxable: form.taxable,
        pensionable: form.pensionable,
        defaultAmount: form.defaultAmount ? Number(form.defaultAmount) : undefined,
        sequence: form.sequence,
      }
      const url = editing ? `/api/payroll/components/${editing.id}` : "/api/payroll/components"
      const method = editing ? "PATCH" : "POST"
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? "Save failed")
      toast.success(editing ? "Component updated" : "Component created")
      setShowForm(false)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(c: Component) {
    if (!confirm(`Delete ${c.code} — ${c.name}?`)) return
    const r = await fetch(`/api/payroll/components/${c.id}`, { method: "DELETE" })
    if (!r.ok) {
      const body = await r.json()
      toast.error(body.error ?? "Delete failed")
      return
    }
    toast.success("Deleted")
    load()
  }

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin" />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New component</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Taxable</th>
                <th className="p-3">Pensionable</th>
                <th className="p-3 text-right">Default Amount</th>
                <th className="p-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No components yet.</td></tr>
              )}
              {items.map(c => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3 font-mono text-xs">{c.code}</td>
                  <td className="p-3">{c.name}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${TYPE_COLOR[c.type]}`}>
                      {TYPE_LABEL[c.type]}
                    </span>
                  </td>
                  <td className="p-3">{c.taxable ? "Yes" : "No"}</td>
                  <td className="p-3">{c.pensionable ? "Yes" : "No"}</td>
                  <td className="p-3 text-right font-mono">{c.defaultAmount?.toLocaleString() ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editing ? "Edit component" : "New component"}</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block mb-1">Code</label>
                <input
                  className="w-full rounded border px-2 py-1.5 bg-background font-mono"
                  value={form.code}
                  disabled={!!editing}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1">Name</label>
                <input
                  className="w-full rounded border px-2 py-1.5 bg-background"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1">Type</label>
                <select
                  className="w-full rounded border px-2 py-1.5 bg-background"
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as ComponentType })}
                >
                  <option value="EARNING">Earning</option>
                  <option value="DEDUCTION">Deduction</option>
                  <option value="STATUTORY">Statutory</option>
                  <option value="LOAN">Loan</option>
                </select>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.taxable} onChange={e => setForm({ ...form, taxable: e.target.checked })} />
                  Taxable
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.pensionable} onChange={e => setForm({ ...form, pensionable: e.target.checked })} />
                  Pensionable
                </label>
              </div>
              <div>
                <label className="block mb-1">Default amount (optional)</label>
                <input
                  type="number"
                  className="w-full rounded border px-2 py-1.5 bg-background"
                  value={form.defaultAmount}
                  onChange={e => setForm({ ...form, defaultAmount: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1">Sequence</label>
                <input
                  type="number"
                  className="w-full rounded border px-2 py-1.5 bg-background"
                  value={form.sequence}
                  onChange={e => setForm({ ...form, sequence: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? "Save" : "Create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
