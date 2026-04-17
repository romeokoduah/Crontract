import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DashboardContent } from "./dashboard-content"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold">Welcome to Crontract</h2>
          <p className="text-muted-foreground">
            You don&apos;t have a workspace yet. Create one to get started.
          </p>
        </div>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const [
    employeeCount,
    projectCount,
    activeTaskCount,
    pendingApprovalCount,
    recentActivity,
  ] = await Promise.all([
    prisma.employee.count({
      where: { workspaceId, deletedAt: null, status: "ACTIVE" },
    }),
    prisma.project.count({
      where: { workspaceId, deletedAt: null },
    }),
    prisma.task.count({
      where: { workspaceId, deletedAt: null, status: { in: ["TODO", "IN_PROGRESS"] } },
    }),
    prisma.approval.count({
      where: { workspaceId, status: "PENDING" },
    }),
    prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
  ])

  return (
    <DashboardContent
      stats={{
        employees: employeeCount,
        projects: projectCount,
        activeTasks: activeTaskCount,
        pendingApprovals: pendingApprovalCount,
      }}
      recentActivity={recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        userName: a.user.name,
        createdAt: a.createdAt.toISOString(),
      }))}
      userName={session.user.name || "User"}
      workspaceName={session.user.workspaceName || "Workspace"}
    />
  )
}
