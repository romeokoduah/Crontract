import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Shield } from "lucide-react"
import { PermissionMatrix } from "./permission-matrix"

export default async function PermissionsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    )
  }

  const workspaceId = session.user.workspaceId

  // Single optimized query — load everything at once
  const [roles, allPermissions] = await Promise.all([
    prisma.role.findMany({
      where: { workspaceId },
      include: {
        permissions: { select: { permissionId: true } },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }),
    prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { entity: "asc" }, { action: "asc" }],
    }),
  ])

  // Build initial state: roleId -> Set<permissionId>
  const initialState: Record<string, string[]> = {}
  for (const role of roles) {
    initialState[role.id] = role.permissions.map((rp) => rp.permissionId)
  }

  // Group permissions by module
  const permissionsByModule = allPermissions.reduce<Record<string, typeof allPermissions>>(
    (acc, p) => {
      if (!acc[p.module]) acc[p.module] = []
      acc[p.module].push(p)
      return acc
    },
    {}
  )

  const rolesData = roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-500" />
          Permission Matrix
        </h1>
        <p className="text-muted-foreground">Configure what each role can do across all modules</p>
      </div>

      <PermissionMatrix
        roles={rolesData}
        permissions={allPermissions}
        permissionsByModule={permissionsByModule}
        initialState={initialState}
      />
    </div>
  )
}
