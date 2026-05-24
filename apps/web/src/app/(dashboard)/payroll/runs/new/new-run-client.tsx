"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

export function NewRunClient({ defaultYear, defaultMonth }: { defaultYear: number; defaultMonth: number }) {
  const router = useRouter()
  const [year, setYear] = useState(defaultYear)
  const [month, setMonth] = useState(defaultMonth)
  const [submitting, setSubmitting] = useState(false)

  async function create() {
    setSubmitting(true)
    try {
      const r = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      })
      const body = await r.json()
      if (!r.ok) {
        if (r.status === 409 && body.existingRunId) {
          toast.error("A run for this period already exists")
          router.push(`/payroll/runs/${body.existingRunId}`)
          return
        }
        throw new Error(body.error ?? "Create failed")
      }
      toast.success(
        body.skipped?.length > 0
          ? `Run created. ${body.skipped.length} employee(s) skipped (missing basic salary).`
          : "Run created"
      )
      router.push(`/payroll/runs/${body.run.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const years = [defaultYear - 1, defaultYear, defaultYear + 1]

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1 font-medium">Month</label>
            <select className="w-full rounded border px-2 py-1.5 bg-background"
              value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Year</label>
            <select className="w-full rounded border px-2 py-1.5 bg-background"
              value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Period: <strong>{MONTHS[month-1]} {year}</strong>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button onClick={create} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Computing…</> : "Create Run"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
