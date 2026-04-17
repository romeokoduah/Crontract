import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatCurrency } from "@/lib/utils"
import { PiggyBank, Plus, TrendingUp, TrendingDown } from "lucide-react"

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

interface BudgetLine {
  category: string
  budgetAmount: number
  actualAmount: number
  committedAmount: number
}

export default async function BudgetPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const budgets = await prisma.budget.findMany({
    where: { workspaceId },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
  })

  // Enrich with creator names
  const userIds = [...new Set(budgets.map((b) => b.createdBy))]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  // Compute summary stats
  const activeBudgets = budgets.filter((b) => b.status === "ACTIVE" || b.status === "APPROVED")
  const totalBudgeted = activeBudgets.reduce((s, b) => s + Number(b.totalAmount), 0)
  const totalActual = activeBudgets.reduce((s, b) => {
    const lines = (b.lines as unknown as BudgetLine[]) ?? []
    return s + lines.reduce((ls, l) => ls + (l.actualAmount ?? 0), 0)
  }, 0)
  const totalCommitted = activeBudgets.reduce((s, b) => {
    const lines = (b.lines as unknown as BudgetLine[]) ?? []
    return s + lines.reduce((ls, l) => ls + (l.committedAmount ?? 0), 0)
  }, 0)
  const variance = totalBudgeted - totalActual - totalCommitted

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-primary" />
            Budget
          </h1>
          <p className="text-muted-foreground">
            {budgets.length} budget{budgets.length !== 1 ? "s" : ""} ·{" "}
            {activeBudgets.length} active
          </p>
        </div>
        <Button asChild>
          <Link href="/budget/new">
            <Plus className="h-4 w-4 mr-2" />
            New Budget
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      {activeBudgets.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Budgeted</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalBudgeted)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Actual Spend</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalActual)}</p>
              {totalBudgeted > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {((totalActual / totalBudgeted) * 100).toFixed(1)}% used
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
              <p className={cn("text-2xl font-bold mt-1 flex items-center gap-1", variance >= 0 ? "text-green-600" : "text-red-600")}>
                {variance >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {formatCurrency(Math.abs(variance))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {variance >= 0 ? "Under budget" : "Over budget"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budgets List */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          All Budgets
        </h2>
        {budgets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <PiggyBank className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No budgets created yet</p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/budget/new">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create Budget
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {budgets.map((budget) => {
              const lines = (budget.lines as unknown as BudgetLine[]) ?? []
              const actual = lines.reduce((s, l) => s + (l.actualAmount ?? 0), 0)
              const pct = Number(budget.totalAmount) > 0 ? (actual / Number(budget.totalAmount)) * 100 : 0

              return (
                <Card key={budget.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <Link href={`/budget/${budget.id}`} className="block p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                statusColors[budget.status]
                              )}
                            >
                              {budget.status}
                            </span>
                            <span className="text-xs text-muted-foreground">{budget.year}</span>
                          </div>
                          <p className="font-semibold">{budget.name}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {lines.length} line{lines.length !== 1 ? "s" : ""} ·{" "}
                            Created by {userMap[budget.createdBy]?.name ?? "—"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{formatCurrency(Number(budget.totalAmount))}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatCurrency(actual)} spent
                          </p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-primary"
                            )}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% utilised</p>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
