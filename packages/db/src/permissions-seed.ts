import { PrismaClient } from "@prisma/client"

const PAYROLL_PERMISSIONS = [
  { code: "payroll:run:create",         module: "payroll", entity: "run",       action: "create",   description: "Create a payroll run" },
  { code: "payroll:run:approve",        module: "payroll", entity: "run",       action: "approve",  description: "Approve a payroll run" },
  { code: "payroll:run:post",           module: "payroll", entity: "run",       action: "post",     description: "Post a payroll run to GL" },
  { code: "payroll:run:view",           module: "payroll", entity: "run",       action: "view",     description: "View payroll runs" },
  { code: "payroll:settings:manage",    module: "payroll", entity: "settings",  action: "manage",   description: "Manage tax rates and GL mapping" },
  { code: "payroll:component:manage",   module: "payroll", entity: "component", action: "manage",   description: "Manage pay components" },
  { code: "payroll:loan:manage",        module: "payroll", entity: "loan",      action: "manage",   description: "Manage staff loans" },
  { code: "payroll:payslip:view_own",   module: "payroll", entity: "payslip",   action: "view_own", description: "View own payslip" },
]

const ADMIN_ROLE_NAMES = new Set(["Owner", "Administrator"])
const SELF_SERVICE_ONLY = "payroll:payslip:view_own"

/**
 * Upsert the global payroll permissions and assign them to roles in this workspace.
 * - Owner/Administrator: all 8
 * - Other roles: view_own only
 */
export async function seedPayrollPermissions(prisma: PrismaClient, workspaceId: string) {
  const permIds: Record<string, string> = {}
  for (const p of PAYROLL_PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description },
      create: p,
    })
    permIds[p.code] = row.id
  }

  const roles = await prisma.role.findMany({ where: { workspaceId } })
  for (const role of roles) {
    const codes = ADMIN_ROLE_NAMES.has(role.name)
      ? PAYROLL_PERMISSIONS.map(p => p.code)
      : [SELF_SERVICE_ONLY]
    for (const code of codes) {
      const permissionId = permIds[code]
      if (!permissionId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      })
    }
  }
}
