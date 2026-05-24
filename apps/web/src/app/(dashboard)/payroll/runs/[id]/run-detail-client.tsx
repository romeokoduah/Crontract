"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, FileDown, RotateCcw, Trash2, Archive } from "lucide-react"
import { toast } from "sonner"

type Status = "DRAFT" | "APPROVED" | "POSTED" | "REVERSED"

type RunData = {
  id: string
  year: number
  month: number
  status: Status
  totals: { gross: number; deductions: number; net: number; employerCost: number }
  journalNumber: string | null
  approvedAt: string | null
  postedAt: string | null
  reversedAt: string | null
  payslips: {
    id: string
    employee: { id: string; firstName: string; lastName: string; employeeNumber: string; jobTitle: string | null }
    basicSalary: number
    totalEarnings: number
    gross: number
    paye: number
    ssnitEmployee: number
    tier2: number
    loanDeductions: number
    otherDeductions: number
    totalDeductions: number
    netPay: number
    currency: string
  }[]
}

const STATUS_COLOR: Record<Status, string> = {
  DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
  POSTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REVERSED: "bg-rose-50 text-rose-700 border-rose-200",
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function RunDetailClient({ run }: { run: RunData }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function callAction(path: string, label: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setBusy(label)
    try {
      const r = await fetch(`/api/payroll/runs/${run.id}/${path}`, { method: "POST" })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? `${label} failed`)
      toast.success(`${label} succeeded`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function deleteRun() {
    if (!confirm("Delete this DRAFT run and all its payslips? This cannot be undone.")) return
    setBusy("Delete")
    try {
      const r = await fetch(`/api/payroll/runs/${run.id}`, { method: "DELETE" })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? "Delete failed")
      toast.success("Run deleted")
      router.push("/payroll")
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <span className={`inline-block px-3 py-1 rounded text-sm border ${STATUS_COLOR[run.status]}`}>{run.status}</span>
        {run.journalNumber && <span className="text-sm text-muted-foreground">Journal: <code className="font-mono">{run.journalNumber}</code></span>}
        {run.approvedAt && <span className="text-xs text-muted-foreground">Approved {new Date(run.approvedAt).toLocaleString()}</span>}
        {run.postedAt && <span className="text-xs text-muted-foreground">Posted {new Date(run.postedAt).toLocaleString()}</span>}
        {run.reversedAt && <span className="text-xs text-muted-foreground">Reversed {new Date(run.reversedAt).toLocaleString()}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Gross", run.totals.gross],
          ["Deductions", run.totals.deductions],
          ["Net Pay", run.totals.net],
          ["Employer Cost", run.totals.employerCost],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-xl font-semibold mt-1 font-mono">GHS {fmt(value as number)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {run.status === "DRAFT" && (
          <>
            <Button size="sm" onClick={() => callAction("approve", "Approve")}
              disabled={!!busy}>
              {busy === "Approve" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Approve
            </Button>
            <Button size="sm" variant="outline" onClick={deleteRun} disabled={!!busy}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete DRAFT
            </Button>
          </>
        )}
        {run.status === "APPROVED" && (
          <Button size="sm" onClick={() => callAction("post", "Post", "Post this run to the General Ledger? This creates a journal entry and decrements loan balances.")}
            disabled={!!busy}>
            {busy === "Post" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Post to GL
          </Button>
        )}
        {run.status === "POSTED" && (
          <Button size="sm" variant="outline" onClick={() => callAction("reverse", "Reverse", "Reverse this posted run? A reversing journal will be created and loan balances restored.")}
            disabled={!!busy}>
            {busy === "Reverse" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />} Reverse
          </Button>
        )}
        <a href={`/api/payroll/runs/${run.id}/payslips.zip`} target="_blank" rel="noopener">
          <Button size="sm" variant="outline">
            <Archive className="h-4 w-4 mr-1" /> Download all payslips (zip)
          </Button>
        </a>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3 text-right">Basic</th>
                <th className="p-3 text-right">Other Earnings</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">PAYE</th>
                <th className="p-3 text-right">SSNIT</th>
                <th className="p-3 text-right">Tier 2</th>
                <th className="p-3 text-right">Loans</th>
                <th className="p-3 text-right">Net Pay</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {run.payslips.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    {p.employee.firstName} {p.employee.lastName}
                    <span className="ml-2 text-xs text-muted-foreground">{p.employee.employeeNumber}</span>
                  </td>
                  <td className="p-3 text-right font-mono">{fmt(p.basicSalary)}</td>
                  <td className="p-3 text-right font-mono">{fmt(p.totalEarnings)}</td>
                  <td className="p-3 text-right font-mono">{fmt(p.gross)}</td>
                  <td className="p-3 text-right font-mono">{fmt(p.paye)}</td>
                  <td className="p-3 text-right font-mono">{fmt(p.ssnitEmployee)}</td>
                  <td className="p-3 text-right font-mono">{fmt(p.tier2)}</td>
                  <td className="p-3 text-right font-mono">{fmt(p.loanDeductions)}</td>
                  <td className="p-3 text-right font-mono font-semibold">{fmt(p.netPay)}</td>
                  <td className="p-3">
                    <a href={`/api/payroll/payslips/${p.id}/pdf`} target="_blank" rel="noopener">
                      <Button size="sm" variant="ghost" title="Download payslip PDF"><FileDown className="h-3.5 w-3.5" /></Button>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
