import { PrismaClient } from "@prisma/client"
import { CATALOGUE } from "./catalogue"
import { defaultGrantsForRole } from "./role-defaults"

export async function seedCatalogue(prisma: PrismaClient): Promise<Map<string, string>> {
  const byCode = new Map<string, string>()
  for (const p of CATALOGUE) {
    const row = await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, entity: p.entity, action: p.action, description: p.description },
      create: { code: p.code, module: p.module, entity: p.entity, action: p.action, description: p.description },
    })
    byCode.set(p.code, row.id)
  }
  return byCode
}

export async function backfillRoleGrants(
  prisma: PrismaClient, workspaceId: string,
): Promise<{ grants: number }> {
  const perms = await prisma.permission.findMany()
  const idByCode = new Map(perms.map((p) => [p.code, p.id]))
  const roles = await prisma.role.findMany({ where: { workspaceId } })

  let grants = 0
  for (const role of roles) {
    for (const g of defaultGrantsForRole(role.name)) {
      const permissionId = idByCode.get(g.code)
      if (!permissionId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: { scope: g.scope },
        create: { roleId: role.id, permissionId, scope: g.scope },
      })
      grants++
    }
  }
  return { grants }
}

export async function enrolProjectOwners(
  prisma: PrismaClient, workspaceId: string,
): Promise<{ members: number }> {
  const projects = await prisma.project.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, ownerId: true },
  })
  let members = 0
  for (const proj of projects) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: proj.id, userId: proj.ownerId } },
      update: { role: "LEAD" },
      create: { projectId: proj.id, userId: proj.ownerId, role: "LEAD" },
    })
    members++
  }
  return { members }
}

export async function runBackfill(prisma: PrismaClient): Promise<void> {
  await seedCatalogue(prisma)
  const workspaces = await prisma.workspace.findMany({ select: { id: true } })
  let grants = 0, members = 0
  for (const w of workspaces) {
    grants += (await backfillRoleGrants(prisma, w.id)).grants
    members += (await enrolProjectOwners(prisma, w.id)).members
  }
  console.log(`[backfill] workspaces=${workspaces.length} grants=${grants} projectMembers=${members}`)
}

// Allow `tsx src/permissions/backfill.ts` to run it directly.
if (require.main === module) {
  const prisma = new PrismaClient()
  runBackfill(prisma).finally(() => prisma.$disconnect())
}
