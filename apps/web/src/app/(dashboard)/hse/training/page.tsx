import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatDate } from "@/lib/utils"
import { GraduationCap, Plus, AlertTriangle, CheckCircle, Clock } from "lucide-react"

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: { filter?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const now = new Date()
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const { filter } = searchParams

  const trainings = await prisma.safetyTraining.findMany({
    where: {
      workspaceId,
      ...(filter === "expired" ? { expiryDate: { lt: now } } :
         filter === "expiring" ? { expiryDate: { gte: now, lte: thirtyDaysOut } } :
         {}),
    },
    orderBy: { completedDate: "desc" },
  })

  const employeeIds = [...new Set(trainings.map((t) => t.employeeId))]
  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds }, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, jobTitle: true, employeeNumber: true },
      })
    : []
  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]))

  const expiredCount = trainings.filter((t) => t.expiryDate && t.expiryDate < now).length
  const expiringCount = trainings.filter((t) => t.expiryDate && t.expiryDate >= now && t.expiryDate <= thirtyDaysOut).length
  const currentCount = trainings.filter((t) => !t.expiryDate || t.expiryDate >= now).length

  function getStatus(t: typeof trainings[0]) {
    if (!t.expiryDate) return "NO_EXPIRY"
    if (t.expiryDate < now) return "EXPIRED"
    if (t.expiryDate <= thirtyDaysOut) return "EXPIRING"
    return "CURRENT"
  }

  const statusConfig = {
    EXPIRED: { label: "Expired", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
    EXPIRING: { label: "Expiring Soon", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
    CURRENT: { label: "Current", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
    NO_EXPIRY: { label: "No Expiry", color: "bg-gray-100 text-gray-600 border-gray-200", icon: CheckCircle },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-purple-500" />
            Safety Training Records
          </h1>
          <p className="text-muted-foreground">{trainings.length} training record{trainings.length !== 1 ? "s" : ""}</p>
        </div>
        <Button asChild>
          <Link href="/hse/training/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Training
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Link href={filter === "expired" ? "/hse/training" : "/hse/training?filter=expired"}>
          <Card className={cn("cursor-pointer transition-all hover:shadow-md", filter === "expired" ? "ring-2 ring-red-400 border-red-300 bg-red-50" : "")}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-muted-foreground">Expired</p>
              </div>
              <p className={cn("text-3xl font-bold mt-1", expiredCount > 0 ? "text-red-600" : "text-foreground")}>{expiredCount}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={filter === "expiring" ? "/hse/training" : "/hse/training?filter=expiring"}>
          <Card className={cn("cursor-pointer transition-all hover:shadow-md", filter === "expiring" ? "ring-2 ring-amber-400 border-amber-300 bg-amber-50" : "")}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-muted-foreground">Expiring (30d)</p>
              </div>
              <p className={cn("text-3xl font-bold mt-1", expiringCount > 0 ? "text-amber-600" : "text-foreground")}>{expiringCount}</p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-sm text-muted-foreground">Current</p>
            </div>
            <p className="text-3xl font-bold mt-1 text-green-600">{currentCount}</p>
          </CardContent>
        </Card>
      </div>

      {filter && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{filter === "expired" ? "Expired trainings" : "Trainings expiring in 30 days"}</span>
          </p>
          <Link href="/hse/training" className="text-xs text-blue-600 hover:underline">Clear filter</Link>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {trainings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {filter ? "No trainings match this filter" : "No training records yet"}
              </p>
              {!filter && (
                <p className="text-xs text-muted-foreground mt-1">Add safety training records to track certifications</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Training Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Provider</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">Completed</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Expiry</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trainings.map((t) => {
                    const status = getStatus(t)
                    const cfg = statusConfig[status]
                    const StatusIcon = cfg.icon
                    const emp = employeeMap[t.employeeId]
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          "border-b transition-colors",
                          status === "EXPIRED" ? "bg-red-50/50 hover:bg-red-50" :
                          status === "EXPIRING" ? "bg-amber-50/50 hover:bg-amber-50" :
                          "hover:bg-muted/30"
                        )}
                      >
                        <td className="px-6 py-3">
                          {emp ? (
                            <div>
                              <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                              <p className="text-xs text-muted-foreground">{emp.employeeNumber} · {emp.jobTitle ?? "—"}</p>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-xs font-mono">{t.employeeId.slice(0, 8)}…</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{t.trainingType}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{t.provider ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                          {formatDate(t.completedDate)}
                        </td>
                        <td className={cn("px-4 py-3 whitespace-nowrap font-medium",
                          status === "EXPIRED" ? "text-red-700" :
                          status === "EXPIRING" ? "text-amber-700" :
                          "text-muted-foreground"
                        )}>
                          {t.expiryDate ? formatDate(t.expiryDate) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 w-fit whitespace-nowrap", cfg.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
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
