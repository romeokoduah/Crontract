// Coarse, STATIC page/route gate for edge middleware, which cannot query the DB.
// Keyed on the JWT role NAME. The API-route guards (requirePermission) remain the
// authoritative check; this only stops sensitive PAGES from rendering server-side
// for roles that plainly shouldn't see them. It mirrors the least-privilege
// role-defaults but is intentionally coarse — a custom role's real grants live in
// the DB and are enforced at the API layer, not here.

/** Gated route prefix → the view permission code it requires. */
export const MODULE_VIEW_PERMISSION: Record<string, string> = {
  "/payroll": "payroll:run:view",
  "/finance": "finance:invoice:view",
  "/budget": "budget:budget:view",
  "/people": "people:employee:view",
  "/procurement": "procurement:po:view",
  "/compliance": "compliance:obligation:view",
  "/social-media": "social:post:view",
  "/reports": "reports:report:view",
}

// Manager (least-privilege) may view ONLY the operational gated prefixes it holds
// in role-defaults — /people and /procurement — NOT finance/payroll/budget/
// compliance/social/reports. Employee sees none of these sensitive prefixes.
export const ROLE_MODULE_VIEW: Record<string, Set<string>> = {
  Owner: new Set(Object.values(MODULE_VIEW_PERMISSION)),
  Administrator: new Set(Object.values(MODULE_VIEW_PERMISSION)),
  Manager: new Set([
    MODULE_VIEW_PERMISSION["/people"],
    MODULE_VIEW_PERMISSION["/procurement"],
  ]),
  Employee: new Set<string>([]),
}
