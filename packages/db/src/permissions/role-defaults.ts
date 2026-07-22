import { CATALOGUE, type PermissionScope } from "./catalogue"

type Grant = { code: string; scope: PermissionScope }

const OPERATIONAL_MODULES = new Set([
  "projects", "procurement", "assets", "hse", "crm", "meetings", "documents", "grants",
])

// Modules a Manager may VIEW by default. Deliberately excludes the sensitive
// modules (finance, payroll runs, admin, budget, compliance, social, reports):
// least-privilege means a department manager does not see company-wide
// financials or the audit log unless an admin grants it explicitly in the matrix.
const MANAGER_VIEW_MODULES = new Set([...OPERATIONAL_MODULES, "people"])

// Self-service codes every employee (and manager) holds regardless of module scoping.
const EMPLOYEE_SELF_SERVICE = new Set([
  "payroll:payslip:view_own",
  "notifications:notification:view",
  "dashboard:dashboard:view",
  "approvals:approval:view",
  "approvals:approval:act",
])

function widest(def: { scopes: PermissionScope[] }): PermissionScope {
  if (def.scopes.includes("ALL")) return "ALL"
  if (def.scopes.includes("TEAM")) return "TEAM"
  return "OWN"
}

export function defaultGrantsForRole(roleName: string): Grant[] {
  switch (roleName) {
    case "Owner":
    case "Administrator":
      return CATALOGUE.map((p) => ({ code: p.code, scope: "ALL" as const }))

    case "Manager":
      return CATALOGUE.flatMap((p): Grant[] => {
        // Self-service basics (dashboard, notifications, approvals, own payslip).
        if (EMPLOYEE_SELF_SERVICE.has(p.code))
          return [{ code: p.code, scope: widest(p) }]
        // View non-sensitive modules at their widest scope (ALL for operational).
        if (p.action === "view" && MANAGER_VIEW_MODULES.has(p.module))
          return [{ code: p.code, scope: widest(p) }]
        // Manage operational modules (create/update/delete/manage/etc.) at TEAM.
        if (p.action !== "view" && OPERATIONAL_MODULES.has(p.module) && p.scopes.includes("TEAM"))
          return [{ code: p.code, scope: "TEAM" }]
        return []
      })

    case "Employee":
      return CATALOGUE.flatMap((p): Grant[] => {
        if (EMPLOYEE_SELF_SERVICE.has(p.code))
          return [{ code: p.code, scope: widest(p) }]
        if (p.action === "view" && OPERATIONAL_MODULES.has(p.module) && p.scopes.includes("TEAM"))
          return [{ code: p.code, scope: "TEAM" }]
        // OWN-scope update, restricted to operational modules (defense-in-depth:
        // a future sensitive-module update+OWN code must not silently leak here).
        if (p.action === "update" && p.scopes.includes("OWN") && OPERATIONAL_MODULES.has(p.module))
          return [{ code: p.code, scope: "OWN" }]
        return []
      })

    default:
      return []
  }
}
