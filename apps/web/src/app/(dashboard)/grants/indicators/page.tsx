import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { BarChart3 } from "lucide-react"

const typeConfig: Record<string, { label: string; className: string }> = {
  OUTPUT: { label: "Output", className: "bg-blue-100 text-blue-700 border-blue-200" },
  OUTCOME: { label: "Outcome", className: "bg-purple-100 text-purple-700 border-purple-200" },
  IMPACT: { label: "Impact", className: "bg-pink-100 text-pink-700 border-pink-200" },
}

export default async function IndicatorsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const indicators = await prisma.indicator.findMany({
    where: { workspaceId },
    include: {
      grant: { select: { title: true, grantNumber: true } },
      results: { orderBy: { reportedDate: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  })

  const totalIndicators = indicators.length
  const outputCount = indicators.filter((i) => i.type === "OUTPUT").length
  const outcomeCount = indicators.filter((i) => i.type === "OUTCOME").length
  const impactCount = indicators.filter((i) => i.type === "IMPACT").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indicators</h1>
          <p className="text-muted-foreground">M&E performance indicators and results</p>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold mt-1 text-pink-600">{totalIndicators}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Output</p>
          <p className="text-lg font-bold mt-1 text-blue-600">{outputCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Outcome</p>
          <p className="text-lg font-bold mt-1 text-purple-600">{outcomeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Impact</p>
          <p className="text-lg font-bold mt-1 text-pink-600">{impactCount}</p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {indicators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No indicators yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Add indicators to track grant outcomes</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Grant</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Baseline</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Latest Actual</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicators.map((indicator) => {
                  const cfg = typeConfig[indicator.type] ?? typeConfig.OUTPUT
                  const latestResult = indicator.results[0]
                  const latestActual = latestResult ? Number(latestResult.actualValue) : null
                  const target = Number(indicator.target)
                  const baseline = Number(indicator.baseline)
                  const denominator = target - baseline
                  const progress = latestActual !== null && denominator > 0
                    ? Math.round(((latestActual - baseline) / denominator) * 100)
                    : null

                  return (
                    <TableRow key={indicator.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{indicator.name}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{indicator.grant.title}</TableCell>
                      <TableCell className="text-muted-foreground">{indicator.unit}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{baseline}</TableCell>
                      <TableCell className="text-right font-semibold">{target}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {latestActual !== null ? latestActual : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {progress !== null ? (
                          <span className={cn(
                            "text-xs font-semibold px-2 py-1 rounded-full",
                            progress >= 100 ? "bg-green-100 text-green-700" :
                            progress >= 50 ? "bg-blue-100 text-blue-700" :
                            progress >= 25 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {progress}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
