import { CATALOGUE, type PermissionScope } from "./catalogue"

type Grant = { code: string; scope: PermissionScope }

const OPERATIONAL_MODULES = new Set([
  "projects", "procurement", "assets", "hse", "crm", "meetings", "documents", "grants",
])

// Self-service codes every employee holds.
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
        if (p.action === "view") return [{ code: p.code, scope: "ALL" }]
        if (OPERATIONAL_MODULES.has(p.module) && p.scopes.includes("TEAM"))
          return [{ code: p.code, scope: "TEAM" }]
        return []
      })

    case "Employee":
      return CATALOGUE.flatMap((p): Grant[] => {
        if (EMPLOYEE_SELF_SERVICE.has(p.code))
          return [{ code: p.code, scope: widest(p) }]
        if (p.action === "view" && OPERATIONAL_MODULES.has(p.module) && p.scopes.includes("TEAM"))
          return [{ code: p.code, scope: "TEAM" }]
        if (p.action === "update" && p.scopes.includes("OWN"))
          return [{ code: p.code, scope: "OWN" }]
        return []
      })

    default:
      return []
  }
}
