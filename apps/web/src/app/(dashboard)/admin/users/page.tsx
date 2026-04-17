import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Users } from "lucide-react"
import { UsersClient } from "./users-client"

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  const [memberships, roles] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({
      where: { workspaceId },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ])

  const pendingInvitations = await prisma.invitation.findMany({
    where: { workspaceId, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500" />
            Users &amp; Team
          </h1>
          <p className="text-muted-foreground">{memberships.length} member{memberships.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <UsersClient
        members={memberships.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          isOwner: m.isOwner,
          joinedAt: m.createdAt,
        }))}
        roles={roles}
        pendingInvitations={pendingInvitations.map((i) => ({
          id: i.id,
          email: i.email,
          status: i.status,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
        }))}
        currentUserId={session.user.id}
      />
    </div>
  )
}
