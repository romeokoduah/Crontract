import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isAdmin } from "@/lib/authorization"
import { TasksList } from "./tasks-list"

export default async function TasksPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const userId = session.user.id
  const isAdminUser = isAdmin(session)

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      // Admins see all tasks, employees see only their assigned tasks
      ...(!isAdminUser ? { assigneeId: userId } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
  })

  // Get assignee names
  const assigneeIds = Array.from(
    new Set(tasks.map((t) => t.assigneeId).filter(Boolean))
  ) as string[]
  const assignees = assigneeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, name: true },
      })
    : []
  const assigneeMap = Object.fromEntries(assignees.map((u) => [u.id, u.name]))

  const serialised = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    projectId: t.projectId,
    projectName: t.project.name,
    assigneeId: t.assigneeId,
    assigneeName: t.assigneeId ? assigneeMap[t.assigneeId] ?? null : null,
    labels: t.labels,
    createdAt: t.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isAdminUser ? "All Tasks" : "My Tasks"}
        </h1>
        <p className="text-muted-foreground">
          {isAdminUser
            ? "All tasks across the workspace"
            : "Tasks assigned to you across all projects"}
        </p>
      </div>

      <TasksList tasks={serialised} showAssignee={isAdminUser} />
    </div>
  )
}
