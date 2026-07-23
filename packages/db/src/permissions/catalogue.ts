export type PermissionScope = "ALL" | "TEAM" | "OWN"

export interface PermissionDef {
  code: string
  module: string
  entity: string
  action: string
  description: string
  scopes: PermissionScope[]
}

const ALL: PermissionScope[] = ["ALL"]
const TEAM: PermissionScope[] = ["ALL", "TEAM", "OWN"]
const OWN: PermissionScope[] = ["OWN"]

function def(
  module: string, entity: string, action: string,
  scopes: PermissionScope[], description: string,
): PermissionDef {
  return { code: `${module}:${entity}:${action}`, module, entity, action, scopes, description }
}

export const CATALOGUE: PermissionDef[] = [
  // ── admin (system, ALL only) ──
  def("admin", "member", "view",   ALL, "View workspace members"),
  def("admin", "member", "manage", ALL, "Add/remove/invite members"),
  def("admin", "role",   "view",   ALL, "View roles"),
  def("admin", "role",   "manage", ALL, "Create/edit roles and permissions"),
  def("admin", "workspace", "manage", ALL, "Edit workspace settings"),
  def("admin", "audit",  "view",   ALL, "View audit log"),

  // ── projects (team-scoped) ──
  def("projects", "project", "view",   TEAM, "View projects"),
  def("projects", "project", "create", TEAM, "Create projects"),
  def("projects", "project", "update", TEAM, "Edit projects"),
  def("projects", "project", "delete", TEAM, "Delete projects"),
  def("projects", "task",    "view",   TEAM, "View tasks"),
  def("projects", "task",    "create", TEAM, "Create tasks"),
  def("projects", "task",    "update", TEAM, "Edit/move tasks"),
  def("projects", "task",    "delete", TEAM, "Delete tasks"),

  // ── people (HR — view team; salary via finance) ──
  def("people", "employee", "view",   TEAM, "View employees"),
  def("people", "employee", "create", ALL,  "Create employees"),
  def("people", "employee", "update", ALL,  "Edit employees"),
  def("people", "employee", "delete", ALL,  "Delete employees"),

  // ── payroll (preserve existing 8 codes exactly) ──
  def("payroll", "run",       "create",   ALL, "Create a payroll run"),
  def("payroll", "run",       "approve",  ALL, "Approve a payroll run"),
  def("payroll", "run",       "post",     ALL, "Post a payroll run to GL"),
  def("payroll", "run",       "view",     ALL, "View payroll runs"),
  def("payroll", "settings",  "manage",   ALL, "Manage tax rates and GL mapping"),
  def("payroll", "component", "manage",   ALL, "Manage pay components"),
  def("payroll", "loan",      "manage",   ALL, "Manage staff loans"),
  def("payroll", "payslip",   "view_own", OWN, "View own payslip"),

  // ── finance (ALL only) ──
  def("finance", "invoice", "view",   ALL, "View invoices"),
  def("finance", "invoice", "create", ALL, "Create invoices"),
  def("finance", "invoice", "update", ALL, "Edit invoices"),
  def("finance", "bill",    "view",   ALL, "View bills"),
  def("finance", "bill",    "create", ALL, "Create bills"),
  def("finance", "expense", "view",   ALL, "View expenses"),
  def("finance", "expense", "create", ALL, "Create expenses"),
  def("finance", "account", "view",   ALL, "View chart of accounts"),
  def("finance", "account", "manage", ALL, "Manage chart of accounts"),

  // ── budget (ALL only) ──
  def("budget", "budget", "view",   ALL, "View budgets"),
  def("budget", "budget", "create", ALL, "Create budgets"),
  def("budget", "budget", "update", ALL, "Edit budgets"),

  // ── procurement (team-scoped) ──
  def("procurement", "po",          "view",   TEAM, "View purchase orders"),
  def("procurement", "po",          "create", TEAM, "Create purchase orders"),
  def("procurement", "po",          "update", TEAM, "Edit purchase orders"),
  def("procurement", "requisition", "view",   TEAM, "View requisitions"),
  def("procurement", "requisition", "create", TEAM, "Create requisitions"),
  def("procurement", "vendor",      "view",   ALL,  "View vendors"),
  def("procurement", "vendor",      "manage", ALL,  "Manage vendors"),

  // ── assets (team-scoped) ──
  def("assets", "asset", "view",   TEAM, "View assets"),
  def("assets", "asset", "create", TEAM, "Register assets"),
  def("assets", "asset", "update", TEAM, "Edit assets"),

  // ── hse (team-scoped) ──
  def("hse", "incident", "view",    TEAM, "View incidents"),
  def("hse", "incident", "report",  TEAM, "Report incidents"),
  def("hse", "incident", "update",  TEAM, "Investigate/close incidents"),
  def("hse", "permit",   "view",    TEAM, "View permits"),
  def("hse", "permit",   "manage",  TEAM, "Manage permits"),

  // ── crm (team-scoped) ──
  def("crm", "contact",  "view",   TEAM, "View contacts"),
  def("crm", "contact",  "manage", TEAM, "Manage contacts"),
  def("crm", "deal",     "view",   TEAM, "View deals"),
  def("crm", "deal",     "manage", TEAM, "Manage deals"),
  def("crm", "activity", "manage", TEAM, "Log activities"),

  // ── grants (team-scoped) ──
  def("grants", "grant",     "view",   TEAM, "View grants"),
  def("grants", "grant",     "manage", TEAM, "Manage grants"),
  def("grants", "donor",     "view",   TEAM, "View donors"),
  def("grants", "indicator", "manage", TEAM, "Manage indicators"),

  // ── compliance (ALL only) ──
  def("compliance", "obligation", "view",   ALL, "View obligations"),
  def("compliance", "obligation", "manage", ALL, "Manage obligations"),
  def("compliance", "licence",    "view",   ALL, "View licences"),
  def("compliance", "licence",    "manage", ALL, "Manage licences"),

  // ── meetings (team-scoped) ──
  def("meetings", "meeting", "view",   TEAM, "View meetings"),
  def("meetings", "meeting", "create", TEAM, "Create meetings"),
  def("meetings", "meeting", "update", TEAM, "Edit meetings/minutes"),

  // ── documents (team-scoped) ──
  def("documents", "document", "view",   TEAM, "View documents"),
  def("documents", "document", "create", TEAM, "Upload documents"),
  def("documents", "document", "update", TEAM, "Edit documents"),
  def("documents", "document", "delete", TEAM, "Delete documents"),

  // ── approvals (own — you act on approvals routed to you) ──
  def("approvals", "approval", "view", OWN, "View my approvals"),
  def("approvals", "approval", "act",  OWN, "Approve/reject items routed to me"),

  // ── notifications (own) ──
  def("notifications", "notification", "view", OWN, "View own notifications"),

  // ── social (ALL only) ──
  def("social", "post", "view",    ALL, "View social posts"),
  def("social", "post", "manage",  ALL, "Compose/schedule posts"),
  def("social", "post", "publish", ALL, "Publish posts"),

  // ── reports (ALL only) ──
  def("reports", "report", "view", ALL, "View reports"),

  // ── dashboard (own) ──
  def("dashboard", "dashboard", "view", OWN, "View dashboard"),
]

export const CATALOGUE_BY_CODE = new Map(CATALOGUE.map((p) => [p.code, p]))

export function moduleOf(code: string): string {
  return code.split(":")[0]
}
