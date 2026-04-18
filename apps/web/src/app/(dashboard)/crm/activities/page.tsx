import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, cn } from "@/lib/utils"
import { Plus, Briefcase, CheckCircle2 } from "lucide-react"

const typeConfig: Record<string, { label: string; className: string }> = {
  CALL: { label: "Call", className: "bg-blue-100 text-blue-700" },
  EMAIL: { label: "Email", className: "bg-green-100 text-green-700" },
  MEETING: { label: "Meeting", className: "bg-purple-100 text-purple-700" },
  NOTE: { label: "Note", className: "bg-gray-100 text-gray-700" },
  TASK: { label: "Task", className: "bg-amber-100 text-amber-700" },
}

export default async function ActivitiesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const activities = await prisma.crmActivity.findMany({
    where: { workspaceId },
    include: {
      contact: { select: { firstName: true, lastName: true } },
      deal: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const totalCount = activities.length
  const completedCount = activities.filter((a) => a.completedAt !== null).length
  const dueTodayCount = activities.filter(
    (a) => a.dueDate && a.dueDate >= today && a.dueDate < tomorrow && !a.completedAt
  ).length
  const overdueCount = activities.filter(
    (a) => a.dueDate && a.dueDate < today && !a.completedAt
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground">Track calls, emails, meetings, and tasks</p>
        </div>
        <Button asChild>
          <Link href="/crm/activities">
            <Plus className="h-4 w-4 mr-2" />
            Log Activity
          </Link>
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totalCount, color: "text-gray-600" },
          { label: "Due Today", value: dueTodayCount, color: "text-blue-600" },
          { label: "Overdue", value: overdueCount, color: "text-red-600" },
          { label: "Completed", value: completedCount, color: "text-green-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-lg font-bold mt-1", color)}>{value}</p>
            <p className="text-xs text-muted-foreground">{value === 1 ? "activity" : "activities"}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold">No activities yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Log your first activity to start tracking interactions</p>
              <Button asChild>
                <Link href="/crm/activities">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Activity
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => {
                  const tCfg = typeConfig[activity.type] ?? typeConfig.NOTE
                  const isOverdue = activity.dueDate && activity.dueDate < today && !activity.completedAt
                  return (
                    <TableRow key={activity.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{activity.subject}</TableCell>
                      <TableCell>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tCfg.className)}>
                          {tCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {activity.contact ? `${activity.contact.firstName} ${activity.contact.lastName}` : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {activity.deal?.title ?? "-"}
                      </TableCell>
                      <TableCell className={cn(
                        "text-muted-foreground",
                        isOverdue && "text-red-600 font-medium"
                      )}>
                        {activity.dueDate ? formatDate(activity.dueDate) : "-"}
                      </TableCell>
                      <TableCell>
                        {activity.completedAt ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
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
