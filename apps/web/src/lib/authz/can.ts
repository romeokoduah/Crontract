import { prisma } from "@/lib/db"
import { loadRoleGrants } from "./grants"

export type ResourceCtx = { projectId?: string; ownerIds?: string[] }

export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  })
  return m !== null
}

export async function can(
  user: { id: string; roleId: string },
  code: string,
  resource?: ResourceCtx,
): Promise<boolean> {
  const grants = await loadRoleGrants(user.roleId)
  const scope = grants.get(code)
  if (!scope) return false            // fail-closed

  if (!resource) return true          // holds the code at some scope
  if (scope === "ALL") return true

  const ownsIt = resource.ownerIds?.includes(user.id) ?? false
  if (scope === "OWN") return ownsIt

  // TEAM: project membership, else fall back to ownership
  if (resource.projectId) return isProjectMember(user.id, resource.projectId)
  return ownsIt
}
