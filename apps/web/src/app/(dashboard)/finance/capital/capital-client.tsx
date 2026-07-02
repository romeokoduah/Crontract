"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { Sparkles, Loader2, ShieldCheck, TrendingUp, FileText } from "lucide-react"
import type { CreditAssessment, Factor } from "@/lib/credit/types"

const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  B: "bg-green-500/15 text-green-600 border-green-500/30",
  C: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  D: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  E: "bg-red-500/15 text-red-600 border-red-500/30",
}

const POLARITY_BAR: Record<Factor["polarity"], string> = {
  strength: "[&>div]:bg-emerald-500",
  watch: "[&>div]:bg-amber-500",
  weakness: "[&>div]:bg-red-500",
}

function money(v: number, currency: string) {
  return `${currency} ${Math.round(v).toLocaleString()}`
}

export function CapitalClient({ initial }: { initial: CreditAssessment }) {
  const [assessment] = useState<CreditAssessment>(initial)
  const [memo, setMemo] = useState<string | null>(null)
  const [memoSource, setMemoSource] = useState<"ai" | "template" | null>(null)
  const [loading, setLoading] = useState(false)

  async function generateMemo() {
    setLoading(true)
    try {
      const res = await fetch("/api/finance/credit/memo", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setMemo(data.memo)
        setMemoSource(data.source)
      } else {
        setMemo(data.error ?? "Could not generate the memo.")
        setMemoSource(null)
      }
    } catch {
      setMemo("Could not reach the memo service.")
      setMemoSource(null)
    } finally {
      setLoading(false)
    }
  }

  const a = assessment

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">Financing Readiness</h1>
          <Badge variant="outline" className="ml-1">Beta</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Your working-capital creditworthiness, computed from your own operational data —
          receivables, collection behaviour, concentration, payables discipline and reliability.
          The score is deterministic and explainable; AI only writes the memo, it never changes a number.
        </p>
      </div>

      {/* Score + offer */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Crontract Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-bold tabular-nums">{Math.round(a.score)}</span>
              <span className="mb-2 text-sm text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={cn("rounded border px-2 py-0.5 text-sm font-semibold", GRADE_COLOR[a.grade])}>
                Grade {a.grade}
              </span>
              <Badge variant="secondary" className="capitalize">{a.confidence} confidence</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Indicative working-capital facility
            </CardTitle>
          </CardHeader>
          <CardContent>
            {a.offer.eligible ? (
              <>
                <div className="text-3xl font-bold">
                  Up to {money(a.offer.limit, a.currency)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {a.offer.advanceRatePct}% advance rate · {a.offer.basis}
                </p>
              </>
            ) : (
              <>
                <div className="text-xl font-semibold text-muted-foreground">Not yet eligible</div>
                <p className="mt-1 text-sm text-muted-foreground">{a.offer.basis}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Factor breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What drives your score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {a.factors.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{f.label}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                      f.polarity === "strength" && "bg-emerald-500/10 text-emerald-600",
                      f.polarity === "watch" && "bg-amber-500/10 text-amber-600",
                      f.polarity === "weakness" && "bg-red-500/10 text-red-600"
                    )}
                  >
                    {f.polarity}
                  </span>
                  <span className="tabular-nums">{Math.round(f.score)}/100</span>
                  <span className="tabular-nums text-xs">·&nbsp;{f.contribution.toFixed(1)} pts</span>
                </span>
              </div>
              <Progress value={f.score} className={cn("h-2", POLARITY_BAR[f.polarity])} />
              <p className="text-xs text-muted-foreground">{f.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Underwriting memo */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Underwriting memo
          </CardTitle>
          <Button size="sm" onClick={generateMemo} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {memo ? "Regenerate" : "Generate memo"}
          </Button>
        </CardHeader>
        <CardContent>
          {memo ? (
            <>
              {memoSource === "template" && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Generated without AI (no model key configured) — deterministic template.
                </p>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{memo}</pre>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate a lender-ready credit memo that explains this score in plain language.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{a.disclaimer}</p>
    </div>
  )
}
