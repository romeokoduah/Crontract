import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, FolderKanban } from "lucide-react"
import { ProjectsList } from "./projects-list"

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const projects = await prisma.project.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      tasks: {
        where: { deletedAt: null },
        select: { id: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Enrich with owner names
  const ownerIds = Array.from(new Set(projects.map((p) => p.ownerId)))
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true },
      })
    : []
  const ownerMap = Object.fromEntries(owners.map((u) => [u.id, u]))

  const serialised = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    priority: p.priority,
    startDate: p.startDate?.toISOString() ?? null,
    endDate: p.endDate?.toISOString() ?? null,
    budget: p.budget ? Number(p.budget) : null,
    ownerId: p.ownerId,
    ownerName: ownerMap[p.ownerId]?.name ?? null,
    taskCount: p.tasks.length,
    completedTaskCount: p.tasks.filter((t) => t.status === "DONE").length,
    createdAt: p.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage and track your projects</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No projects yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Create your first project to start tracking tasks
            </p>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ProjectsList projects={serialised} />
      )}
    </div>
  )
}
