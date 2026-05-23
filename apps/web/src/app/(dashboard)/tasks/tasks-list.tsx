"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckSquare, ListFilter } from "lucide-react"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  projectId: string
  projectName: string
  assigneeId: string | null
  assigneeName: string | null
  labels: string[]
  createdAt: string
}

const statusConfig: Record<string, { label: string; class: string }> = {
  TODO: {
    label: "To Do",
    class: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  IN_PROGRESS: {
    label: "In Progress",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  IN_REVIEW: {
    label: "In Review",
    class:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  DONE: {
    label: "Done",
    class:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  BLOCKED: {
    label: "Blocked",
    class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
}

const priorityConfig: Record<string, { label: string; class: string }> = {
  CRITICAL: {
    label: "Critical",
    class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  HIGH: {
    label: "High",
    class:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  MEDIUM: {
    label: "Medium",
    class:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  LOW: {
    label: "Low",
    class:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
}

const filterOptions = ["All", "To Do", "In Progress", "In Review", "Done", "Blocked"]
const filterMap: Record<string, string | null> = {
  All: null,
  "To Do": "TODO",
  "In Progress": "IN_PROGRESS",
  "In Review": "IN_REVIEW",
  Done: "DONE",
  Blocked: "BLOCKED",
}

export function TasksList({
  tasks,
  showAssignee,
}: {
  tasks: Task[]
  showAssignee: boolean
}) {
  const [filter, setFilter] = useState("All")

  const filteredTasks = filterMap[filter]
    ? tasks.filter((t) => t.status === filterMap[filter])
    : tasks

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold">No tasks found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Tasks assigned to you will appear here
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <ListFilter className="h-4 w-4 text-muted-foreground" />
        {filterOptions.map((opt) => (
          <Button
            key={opt}
            variant={filter === opt ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter(opt)}
          >
            {opt}
            {opt !== "All" && (
              <span className="ml-1 opacity-60">
                ({tasks.filter((t) =>
                  filterMap[opt] ? t.status === filterMap[opt] : true
                ).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {filteredTasks.map((task) => {
          const isOverdue =
            task.dueDate &&
            new Date(task.dueDate) < new Date() &&
            task.status !== "DONE"
          const status = statusConfig[task.status]
          const priority = priorityConfig[task.priority]

          return (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{task.title}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        {task.projectName}
                      </Link>
                      {status && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0 border-0",
                            status.class
                          )}
                        >
                          {status.label}
                        </Badge>
                      )}
                      {priority && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0 border-0",
                            priority.class
                          )}
                        >
                          {priority.label}
                        </Badge>
                      )}
                      {showAssignee && task.assigneeName && (
                        <span className="text-xs text-muted-foreground">
                          {task.assigneeName}
                        </span>
                      )}
                    </div>
                    {task.dueDate && (
                      <p
                        className={cn(
                          "text-xs",
                          isOverdue
                            ? "text-red-500 font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {isOverdue ? "Overdue: " : "Due: "}
                        {formatDate(task.dueDate)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No tasks match this filter
        </div>
      )}
    </div>
  )
}
