"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Users,
  FolderKanban,
  CheckSquare,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"

interface DashboardProps {
  stats: {
    employees: number
    projects: number
    activeTasks: number
    pendingApprovals: number
  }
  recentActivity: {
    id: string
    action: string
    entityType: string
    userName: string
    createdAt: string
  }[]
  userName: string
  workspaceName: string
}

const statCards = [
  {
    key: "employees" as const,
    title: "Active Employees",
    icon: Users,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "projects" as const,
    title: "Projects",
    icon: FolderKanban,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    key: "activeTasks" as const,
    title: "Active Tasks",
    icon: CheckSquare,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    key: "pendingApprovals" as const,
    title: "Pending Approvals",
    icon: Clock,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
]

function getActionLabel(action: string, entityType: string) {
  const entity = entityType.replace(/_/g, " ").toLowerCase()
  switch (action) {
    case "CREATE":
      return `created a ${entity}`
    case "UPDATE":
      return `updated a ${entity}`
    case "DELETE":
      return `deleted a ${entity}`
    case "APPROVE":
      return `approved a ${entity}`
    case "REJECT":
      return `rejected a ${entity}`
    default:
      return `${action.toLowerCase()} a ${entity}`
  }
}

export function AdminDashboardContent({
  stats,
  recentActivity,
  userName,
  workspaceName,
}: DashboardProps) {
  const firstName = userName.split(" ")[0]
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening at {workspaceName} today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.key}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="text-3xl font-bold mt-1">
                      {stats[card.key]}
                    </p>
                  </div>
                  <div className={`${card.bg} ${card.color} rounded-lg p-3`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </div>
            <CardDescription>Latest actions in your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Activity will appear here as your team starts working
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p>
                        <span className="font-medium">{activity.userName}</span>{" "}
                        {getActionLabel(activity.action, activity.entityType)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateTime(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
