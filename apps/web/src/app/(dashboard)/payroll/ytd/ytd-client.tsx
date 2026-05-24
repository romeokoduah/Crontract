"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

type Row = {
  employeeId: string
  name: string
  employeeNumber: string
  runs: number
  gross: number
  paye: number
  ssnitEmployee: number
  ssnitEmployer: number
  tier2: number
  net: number
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function YtdClient({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState(defaultYear)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/payroll/ytd?year=${year}`)
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year])

  const years = [defaultYear - 1, defaultYear, defaultYear + 1]

  const totals = rows.reduce(
    (a, r) => ({
      gross: a.gross + r.gross,
      paye: a.paye + r.paye,
      ssnitEmployee: a.ssnitEmployee + r.ssnitEmployee,
      ssnitEmployer: a.ssnitEmployer + r.ssnitEmployer,
      tier2: a.tier2 + r.tier2,
      net: a.net + r.net,
    }),
    { gross: 0, paye: 0, ssnitEmployee: 0, ssnitEmployer: 0, tier2: 0, net: 0 }
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm">Year:</label>
        <select className="rounded border px-2 py-1.5 bg-background text-sm"
          value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3 text-right">Runs</th>
                  <th className="p-3 text-right">Gross</th>
                  <th className="p-3 text-right">PAYE</th>
                  <th className="p-3 text-right">SSNIT (EE)</th>
                  <th className="p-3 text-right">SSNIT (ER)</th>
                  <th className="p-3 text-right">Tier 2</th>
                  <th className="p-3 text-right">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No POSTED runs in {year}.</td></tr>
                )}
                {rows.map(r => (
                  <tr key={r.employeeId} className="border-b last:border-0">
                    <td className="p-3">{r.name}<span className="ml-2 text-xs text-muted-foreground">{r.employeeNumber}</span></td>
                    <td className="p-3 text-right">{r.runs}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.gross)}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.paye)}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.ssnitEmployee)}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.ssnitEmployer)}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.tier2)}</td>
                    <td className="p-3 text-right font-mono font-semibold">{fmt(r.net)}</td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="font-semibold bg-muted/40">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right"></td>
                    <td className="p-3 text-right font-mono">{fmt(totals.gross)}</td>
                    <td className="p-3 text-right font-mono">{fmt(totals.paye)}</td>
                    <td className="p-3 text-right font-mono">{fmt(totals.ssnitEmployee)}</td>
                    <td className="p-3 text-right font-mono">{fmt(totals.ssnitEmployer)}</td>
                    <td className="p-3 text-right font-mono">{fmt(totals.tier2)}</td>
                    <td className="p-3 text-right font-mono">{fmt(totals.net)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
