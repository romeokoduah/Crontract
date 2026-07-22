export type PermissionScope = "ALL" | "TEAM" | "OWN"

const RANK: Record<PermissionScope, number> = { ALL: 3, TEAM: 2, OWN: 1 }

/** Returns the widest (highest-rank) of two scopes. */
export function widerScope(a: PermissionScope, b: PermissionScope): PermissionScope {
  return RANK[a] >= RANK[b] ? a : b
}
