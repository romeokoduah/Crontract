import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isAdmin } from "@/lib/authorization"
import { AdminDashboardContent } from "./admin-dashboard-content"
import { EmployeeDashboardContent } from "./employee-dashboard-content"

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
  const userId = session.user.id
  const isAdminUser = isAdmin(session)

  if (isAdminUser) {
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
      <AdminDashboardContent
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

  // Employee dashboard — personal metrics
  const now = new Date()
  const [
    myTaskCount,
    myOverdueTaskCount,
    myProjectCount,
    myPendingApprovalCount,
    upcomingMeetings,
    myRecentTasks,
  ] = await Promise.all([
    prisma.task.count({
      where: {
        workspaceId,
        assigneeId: userId,
        deletedAt: null,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        assigneeId: userId,
        deletedAt: null,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
    }),
    prisma.project.count({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [{ ownerId: userId }, { createdBy: userId }],
      },
    }),
    prisma.approval.count({
      where: { workspaceId, requestedBy: userId, status: "PENDING" },
    }),
    prisma.meeting.findMany({
      where: {
        workspaceId,
        startTime: { gte: now },
        attendees: { has: userId },
      },
      orderBy: { startTime: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        location: true,
      },
    }),
    prisma.task.findMany({
      where: {
        workspaceId,
        assigneeId: userId,
        deletedAt: null,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { name: true } },
      },
    }),
  ])

  return (
    <EmployeeDashboardContent
      stats={{
        myTasks: myTaskCount,
        overdueTasks: myOverdueTaskCount,
        myProjects: myProjectCount,
        pendingApprovals: myPendingApprovalCount,
      }}
      upcomingMeetings={upcomingMeetings.map((m) => ({
        id: m.id,
        title: m.title,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime.toISOString(),
        location: m.location,
      }))}
      myTasks={myRecentTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        projectName: t.project.name,
      }))}
      userName={session.user.name || "User"}
      workspaceName={session.user.workspaceName || "Workspace"}
    />
  )
}
