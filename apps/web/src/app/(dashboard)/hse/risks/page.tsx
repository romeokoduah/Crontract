import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatDate } from "@/lib/utils"
import { AlertTriangle, Plus } from "lucide-react"

const riskLevelColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-700 border-green-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
}


export default async function RisksPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const risks = await prisma.riskAssessment.findMany({
    where: { workspaceId },
    orderBy: { assessedDate: "desc" },
  })

  const byLevel = risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.riskLevel] = (acc[r.riskLevel] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Risk Assessments
          </h1>
          <p className="text-muted-foreground">{risks.length} assessment{risks.length !== 1 ? "s" : ""}</p>
        </div>
        <Button asChild>
          <Link href="/hse/risks/new">
            <Plus className="h-4 w-4 mr-2" />
            New Assessment
          </Link>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => (
          <Card key={level} className={cn("border", riskLevelColors[level].split(" ")[0].replace("bg-", "border-").replace("100", "200"))}>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">{level}</p>
              <p className={cn("text-3xl font-bold mt-1", riskLevelColors[level].split(" ")[1])}>
                {byLevel[level] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {risks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No risk assessments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first risk assessment to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Area</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk Level</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Assessed Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Review Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r) => {
                    const isOverdueReview = r.reviewDate && r.reviewDate < new Date()
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3">
                          <p className="font-medium">{r.title}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r.area}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap", riskLevelColors[r.riskLevel])}>
                            {r.riskLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                          {formatDate(r.assessedDate)}
                        </td>
                        <td className={cn("px-4 py-3 hidden lg:table-cell whitespace-nowrap", isOverdueReview ? "text-red-600 font-medium" : "text-muted-foreground")}>
                          {r.reviewDate ? formatDate(r.reviewDate) : "—"}
                          {isOverdueReview && <span className="text-xs ml-1">(overdue)</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            r.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                          )}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
