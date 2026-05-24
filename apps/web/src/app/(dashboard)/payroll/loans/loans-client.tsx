"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Plus, Ban } from "lucide-react"
import { toast } from "sonner"

type Loan = {
  id: string
  employeeId: string
  principal: number
  monthlyDeduction: number
  startMonth: string
  balance: number
  status: "ACTIVE" | "PAID" | "CANCELLED"
  employee: { firstName: string; lastName: string; employeeNumber: string }
}

type Employee = { id: string; firstName: string; lastName: string; employeeNumber: string }

const STATUS_COLOR: Record<Loan["status"], string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAID: "bg-slate-50 text-slate-700 border-slate-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
}

const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function LoansClient() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ employeeId: "", principal: "", monthlyDeduction: "", startMonth: thisMonth() })

  async function load() {
    setLoading(true)
    const [a, b] = await Promise.all([
      fetch("/api/payroll/loans").then(r => r.json()),
      fetch("/api/people").then(r => r.json()),
    ])
    setLoans(a.loans ?? [])
    setEmployees(b.employees ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm({ employeeId: employees[0]?.id ?? "", principal: "", monthlyDeduction: "", startMonth: thisMonth() })
    setShowForm(true)
  }

  async function submit() {
    setSaving(true)
    try {
      const r = await fetch("/api/payroll/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId,
          principal: Number(form.principal),
          monthlyDeduction: Number(form.monthlyDeduction),
          startMonth: form.startMonth,
        }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? "Save failed")
      toast.success("Loan created")
      setShowForm(false)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function cancel(l: Loan) {
    if (!confirm(`Cancel loan for ${l.employee.firstName} ${l.employee.lastName}? Remaining balance: GHS ${Number(l.balance).toLocaleString()}`)) return
    const r = await fetch(`/api/payroll/loans/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    })
    if (!r.ok) {
      toast.error("Cancel failed")
      return
    }
    toast.success("Loan cancelled")
    load()
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New loan</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3 text-right">Principal (GHS)</th>
                <th className="p-3 text-right">Monthly</th>
                <th className="p-3">Start</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No loans recorded yet.</td></tr>}
              {loans.map(l => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="p-3">{l.employee.firstName} {l.employee.lastName}<span className="text-xs text-muted-foreground ml-2">{l.employee.employeeNumber}</span></td>
                  <td className="p-3 text-right font-mono">{Number(l.principal).toLocaleString()}</td>
                  <td className="p-3 text-right font-mono">{Number(l.monthlyDeduction).toLocaleString()}</td>
                  <td className="p-3">{l.startMonth}</td>
                  <td className="p-3 text-right font-mono">{Number(l.balance).toLocaleString()}</td>
                  <td className="p-3"><span className={`inline-block px-2 py-0.5 rounded text-xs border ${STATUS_COLOR[l.status]}`}>{l.status}</span></td>
                  <td className="p-3">
                    {l.status === "ACTIVE" && <Button size="sm" variant="ghost" onClick={() => cancel(l)} title="Cancel loan"><Ban className="h-3.5 w-3.5" /></Button>}
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
            <h2 className="text-lg font-semibold">New staff loan</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block mb-1">Employee</label>
                <select className="w-full rounded border px-2 py-1.5 bg-background"
                  value={form.employeeId}
                  onChange={e => setForm({ ...form, employeeId: e.target.value })}>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNumber})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Principal (GHS)</label>
                  <input type="number" step="0.01" className="w-full rounded border px-2 py-1.5 bg-background"
                    value={form.principal} onChange={e => setForm({ ...form, principal: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1">Monthly deduction</label>
                  <input type="number" step="0.01" className="w-full rounded border px-2 py-1.5 bg-background"
                    value={form.monthlyDeduction} onChange={e => setForm({ ...form, monthlyDeduction: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block mb-1">Start month (YYYY-MM)</label>
                <input className="w-full rounded border px-2 py-1.5 bg-background font-mono"
                  value={form.startMonth} onChange={e => setForm({ ...form, startMonth: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
