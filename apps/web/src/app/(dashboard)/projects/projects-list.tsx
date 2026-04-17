"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { cn, formatDate, getInitials } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar, CheckSquare } from "lucide-react"

type Project = {
  id: string
  name: string
  description: string | null
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  startDate: string | null
  endDate: string | null
  budget: number | null
  ownerId: string
  ownerName: string | null
  taskCount: number
  completedTaskCount: number
  createdAt: string
}

const statusConfig: Record<
  Project["status"],
  { label: string; colorClass: string }
> = {
  PLANNING: {
    label: "Planning",
    colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  ACTIVE: {
    label: "Active",
    colorClass: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  },
  ON_HOLD: {
    label: "On Hold",
    colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  COMPLETED: {
    label: "Completed",
    colorClass: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    colorClass: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  },
}

const priorityConfig: Record<
  Project["priority"],
  { label: string; dotClass: string }
> = {
  LOW: { label: "Low", dotClass: "bg-slate-400" },
  MEDIUM: { label: "Medium", dotClass: "bg-blue-400" },
  HIGH: { label: "High", dotClass: "bg-amber-400" },
  URGENT: { label: "Urgent", dotClass: "bg-red-500" },
}

const tabs = [
  { value: "all", label: "All" },
  { value: "PLANNING", label: "Planning" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
]

export function ProjectsList({ projects }: { projects: Project[] }) {
  const [activeTab, setActiveTab] = useState("all")

  const filtered = useMemo(() => {
    if (activeTab === "all") return projects
    return projects.filter((p) => p.status === activeTab)
  }, [projects, activeTab])

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {tabs.map((tab) => {
            const count =
              tab.value === "all"
                ? projects.length
                : projects.filter((p) => p.status === tab.value).length
            return (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
                {count > 0 && (
                  <span className="ml-1.5 text-xs opacity-60">({count})</span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          No projects in this category.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const progress =
              project.taskCount > 0
                ? Math.round((project.completedTaskCount / project.taskCount) * 100)
                : 0
            const status = statusConfig[project.status]
            const priority = priorityConfig[project.priority]

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="group h-full transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer border-border/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("h-2 w-2 rounded-full shrink-0", priority.dotClass)} />
                        <h3 className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-xs shrink-0 font-medium border", status.colorClass)}
                      >
                        {status.label}
                      </Badge>
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {project.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Owner */}
                    {project.ownerName && (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                            {getInitials(project.ownerName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{project.ownerName}</span>
                      </div>
                    )}

                    {/* Dates */}
                    {(project.startDate || project.endDate) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {project.startDate ? formatDate(project.startDate) : "—"}
                          {" → "}
                          {project.endDate ? formatDate(project.endDate) : "Open"}
                        </span>
                      </div>
                    )}

                    {/* Task progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckSquare className="h-3.5 w-3.5" />
                          <span>
                            {project.completedTaskCount}/{project.taskCount} tasks
                          </span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
