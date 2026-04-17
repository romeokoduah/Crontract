import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { FileText } from "lucide-react"
import { AuditClient } from "./audit-client"

export default async function AuditPage({
  searchParams,
}: {
  searchParams: {
    userId?: string
    entityType?: string
    action?: string
    from?: string
    to?: string
    page?: string
  }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId
  const page = parseInt(searchParams.page ?? "1", 10)
  const pageSize = 50
  const { userId, entityType, action, from, to } = searchParams

  const where = {
    workspaceId,
    ...(userId ? { userId } : {}),
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
    ...(from || to ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    } : {}),
  }

  const [logs, total, workspaceUsers] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ])

  // Get unique entity types and actions for filter dropdowns
  const allEntityTypes = await prisma.auditLog.findMany({
    where: { workspaceId },
    distinct: ["entityType"],
    select: { entityType: true },
  })
  const allActions = await prisma.auditLog.findMany({
    where: { workspaceId },
    distinct: ["action"],
    select: { action: true },
  })

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-slate-500" />
          Audit Log
        </h1>
        <p className="text-muted-foreground">Complete audit trail of all system actions — {total.toLocaleString()} events</p>
      </div>

      <AuditClient
        logs={logs.map((log) => ({
          id: log.id,
          entityType: log.entityType,
          entityId: log.entityId,
          action: log.action,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
          beforeState: log.beforeState,
          afterState: log.afterState,
          user: log.user,
        }))}
        total={total}
        page={page}
        totalPages={totalPages}
        workspaceUsers={workspaceUsers.map((m) => ({ id: m.user.id, name: m.user.name }))}
        entityTypes={allEntityTypes.map((e) => e.entityType).sort()}
        actions={allActions.map((a) => a.action).sort()}
        filters={{ userId, entityType, action, from, to }}
      />
    </div>
  )
}
