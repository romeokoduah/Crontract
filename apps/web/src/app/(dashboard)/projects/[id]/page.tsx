import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { cn, formatDate, formatCurrency, getInitials } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Calendar, DollarSign, Settings } from "lucide-react"
import { KanbanBoard } from "./board"

const statusConfig: Record<string, { label: string; colorClass: string }> = {
  PLANNING: { label: "Planning", colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  ACTIVE: { label: "Active", colorClass: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20" },
  ON_HOLD: { label: "On Hold", colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  COMPLETED: { label: "Completed", colorClass: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20" },
  CANCELLED: { label: "Cancelled", colorClass: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
}

const priorityConfig: Record<string, { label: string; dotClass: string }> = {
  LOW: { label: "Low", dotClass: "bg-slate-400" },
  MEDIUM: { label: "Medium", dotClass: "bg-blue-400" },
  HIGH: { label: "High", dotClass: "bg-amber-400" },
  URGENT: { label: "Urgent", dotClass: "bg-red-500" },
}

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) return notFound()

  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      workspaceId: session.user.workspaceId,
      deletedAt: null,
    },
    include: {
      tasks: {
        where: { deletedAt: null, parentId: null },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: {
          subtasks: {
            where: { deletedAt: null },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  })

  if (!project) return notFound()

  const owner = await prisma.user.findUnique({
    where: { id: project.ownerId },
    select: { id: true, name: true, avatarUrl: true },
  })

  // Get workspace members for assignee options
  const members = await prisma.membership.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    take: 50,
  })

  // Enrich tasks with assignee info
  const assigneeIds = project.tasks
    .map((t) => t.assigneeId)
    .filter((id): id is string => id !== null)
  const assignees = assigneeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, name: true, avatarUrl: true },
      })
    : []
  const assigneeMap = Object.fromEntries(assignees.map((u) => [u.id, u]))

  const status = statusConfig[project.status]
  const priority = priorityConfig[project.priority]

  const serialisedTasks = project.tasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status as "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED",
    priority: t.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    assigneeId: t.assigneeId,
    assignee: t.assigneeId ? (assigneeMap[t.assigneeId] ?? null) : null,
    dueDate: t.dueDate?.toISOString() ?? null,
    labels: t.labels,
    position: t.position,
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
    })),
  }))

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
  }))

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Projects
        </Link>
      </Button>

      {/* Project Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", priority.dotClass)} />
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge
                variant="outline"
                className={cn("text-xs font-medium border", status.colorClass)}
              >
                {status.label}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground max-w-2xl">{project.description}</p>
            )}
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-5 flex-wrap text-sm text-muted-foreground">
          {owner && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                  {getInitials(owner.name)}
                </AvatarFallback>
              </Avatar>
              <span>{owner.name}</span>
            </div>
          )}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {project.startDate ? formatDate(project.startDate) : "—"}
                {" → "}
                {project.endDate ? formatDate(project.endDate) : "Open"}
              </span>
            </div>
          )}
          {project.budget && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              <span>{formatCurrency(Number(project.budget))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <KanbanBoard
            projectId={params.id}
            initialTasks={serialisedTasks}
            members={memberOptions}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              List view coming soon.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Timeline view coming soon.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardContent className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Project settings coming soon.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
