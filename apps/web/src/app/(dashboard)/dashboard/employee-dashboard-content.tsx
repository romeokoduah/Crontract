"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckSquare,
  AlertTriangle,
  FolderKanban,
  Clock,
  Calendar,
  MapPin,
  ArrowRight,
} from "lucide-react"
import { formatDate, formatDateTime } from "@/lib/utils"
import Link from "next/link"

interface EmployeeDashboardProps {
  stats: {
    myTasks: number
    overdueTasks: number
    myProjects: number
    pendingApprovals: number
  }
  upcomingMeetings: {
    id: string
    title: string
    startTime: string
    endTime: string
    location: string | null
  }[]
  myTasks: {
    id: string
    title: string
    status: string
    priority: string
    dueDate: string | null
    projectName: string
  }[]
  userName: string
  workspaceName: string
}

const statCards = [
  {
    key: "myTasks" as const,
    title: "My Active Tasks",
    icon: CheckSquare,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    href: "/tasks",
  },
  {
    key: "overdueTasks" as const,
    title: "Overdue",
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    href: "/tasks",
  },
  {
    key: "myProjects" as const,
    title: "My Projects",
    icon: FolderKanban,
    color: "text-green-500",
    bg: "bg-green-500/10",
    href: "/projects",
  },
  {
    key: "pendingApprovals" as const,
    title: "Pending Approvals",
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    href: "/approvals",
  },
]

const priorityColor: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
}

const statusLabel: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  BLOCKED: "Blocked",
}

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr))
}

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

function isTomorrow(dateStr: string) {
  const d = new Date(dateStr)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  )
}

function meetingDateLabel(dateStr: string) {
  if (isToday(dateStr)) return "Today"
  if (isTomorrow(dateStr)) return "Tomorrow"
  return formatDate(dateStr)
}

export function EmployeeDashboardContent({
  stats,
  upcomingMeetings,
  myTasks,
  userName,
  workspaceName,
}: EmployeeDashboardProps) {
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
          Here&apos;s your personal overview at {workspaceName}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.key} href={card.href}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
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
            </Link>
          )
        })}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">My Tasks</CardTitle>
              </div>
              <Link
                href="/tasks"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <CardDescription>
              Your highest priority tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No active tasks assigned to you
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myTasks.map((task) => {
                  const isOverdue =
                    task.dueDate && new Date(task.dueDate) < new Date()
                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 text-sm rounded-md border p-3"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-medium truncate">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {task.projectName}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 border-0 ${
                              priorityColor[task.priority] || ""
                            }`}
                          >
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {statusLabel[task.status] || task.status}
                          </Badge>
                        </div>
                        {task.dueDate && (
                          <p
                            className={`text-xs ${
                              isOverdue
                                ? "text-red-500 font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isOverdue ? "Overdue: " : "Due: "}
                            {formatDate(task.dueDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Meetings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Upcoming Meetings</CardTitle>
              </div>
              <Link
                href="/meetings"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <CardDescription>Your next scheduled meetings</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">No upcoming meetings</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your schedule is clear
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-start gap-3 text-sm rounded-md border p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                      <span className="text-[10px] font-medium leading-none">
                        {meetingDateLabel(meeting.startTime)}
                      </span>
                      <span className="text-xs font-bold leading-tight mt-0.5">
                        {formatTime(meeting.startTime)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium truncate">{meeting.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {formatTime(meeting.startTime)} –{" "}
                          {formatTime(meeting.endTime)}
                        </span>
                        {meeting.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {meeting.location}
                          </span>
                        )}
                      </div>
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
