import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { PiggyBank, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react"

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

interface BudgetLine {
  category: string
  description?: string
  budgetAmount: number
  actualAmount: number
  committedAmount: number
  phasing?: Record<string, number>
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default async function BudgetDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const budget = await prisma.budget.findFirst({
    where: { id: params.id, workspaceId },
  })
  if (!budget) notFound()

  const creator = await prisma.user.findUnique({
    where: { id: budget.createdBy },
    select: { id: true, name: true },
  })

  const lines = (budget.lines as unknown as BudgetLine[]) ?? []
  const totalBudget = lines.reduce((s, l) => s + l.budgetAmount, 0)
  const totalActual = lines.reduce((s, l) => s + (l.actualAmount ?? 0), 0)
  const totalCommitted = lines.reduce((s, l) => s + (l.committedAmount ?? 0), 0)
  const totalVariance = totalBudget - totalActual - totalCommitted

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/budget">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                statusColors[budget.status]
              )}
            >
              {budget.status}
            </span>
            <span className="text-xs text-muted-foreground">FY {budget.year}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-primary" />
            {budget.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created by {creator?.name ?? "—"} · {formatDate(budget.createdAt)}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Budget</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Actual Spend</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalActual)}</p>
            {totalBudget > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((totalActual / totalBudget) * 100).toFixed(1)}% used
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Committed</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalCommitted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Variance</p>
            <p className={cn("text-2xl font-bold mt-1 flex items-center gap-1", totalVariance >= 0 ? "text-green-600" : "text-red-600")}>
              {totalVariance >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {formatCurrency(Math.abs(totalVariance))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Lines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No budget lines defined</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Budget</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Actual</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Committed</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Variance</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">% Used</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const actual = line.actualAmount ?? 0
                    const committed = line.committedAmount ?? 0
                    const variance = line.budgetAmount - actual - committed
                    const pct = line.budgetAmount > 0 ? ((actual + committed) / line.budgetAmount) * 100 : 0

                    return (
                      <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{line.category}</p>
                          {line.description && (
                            <p className="text-xs text-muted-foreground">{line.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(line.budgetAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono hidden sm:table-cell">{formatCurrency(actual)}</td>
                        <td className="px-4 py-3 text-right font-mono hidden md:table-cell">{formatCurrency(committed)}</td>
                        <td className={cn("px-4 py-3 text-right font-mono hidden lg:table-cell", variance >= 0 ? "text-green-600" : "text-red-600")}>
                          {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-primary"
                                )}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalBudget)}</td>
                    <td className="px-4 py-3 text-right font-mono hidden sm:table-cell">{formatCurrency(totalActual)}</td>
                    <td className="px-4 py-3 text-right font-mono hidden md:table-cell">{formatCurrency(totalCommitted)}</td>
                    <td className={cn("px-4 py-3 text-right font-mono hidden lg:table-cell", totalVariance >= 0 ? "text-green-600" : "text-red-600")}>
                      {totalVariance >= 0 ? "+" : ""}{formatCurrency(totalVariance)}
                    </td>
                    <td className="px-4 py-3">
                      {totalBudget > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {(((totalActual + totalCommitted) / totalBudget) * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Phasing */}
      {lines.some((l) => l.phasing && Object.keys(l.phasing).length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Phasing</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="text-right px-2 py-3 font-medium text-muted-foreground whitespace-nowrap">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines
                    .filter((l) => l.phasing && Object.keys(l.phasing).length > 0)
                    .map((line, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{line.category}</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="px-2 py-2 text-right text-xs font-mono text-muted-foreground">
                            {line.phasing?.[m] ? formatCurrency(line.phasing[m]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
