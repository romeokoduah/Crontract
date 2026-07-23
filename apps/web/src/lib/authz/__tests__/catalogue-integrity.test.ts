import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { CATALOGUE_BY_CODE } from "@crontract/db/permissions/catalogue"

// Recursively collect every `route.ts` under the API tree — no external glob dep.
function findRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) findRouteFiles(full, acc)
    else if (entry.name === "route.ts") acc.push(full)
  }
  return acc
}

const routeFiles = findRouteFiles(join(process.cwd(), "src/app/api"))

// Routes that intentionally carry NO permission guard because they are public or
// pure self-service (identity/onboarding flows gated by session + self-scoping,
// not by a workspace permission). Each entry is justified; adding to this list is
// a deliberate security decision, not a way to silence the test.
const UNGUARDED_ALLOWLIST = new Set<string>([
  "src/app/api/auth/signup/route.ts", // create a brand-new workspace + user; no prior workspace/permission exists
  "src/app/api/auth/accept-invite/route.ts", // invitee joins via a signed invite token
  "src/app/api/auth/change-password/route.ts", // user changes their OWN password (session-scoped)
  "src/app/api/onboarding/complete/route.ts", // new user completes their OWN onboarding
  "src/app/api/profile/route.ts", // user edits their OWN profile (self-scoped by userId)
])

// Normalise to a web-app-relative POSIX path (e.g. "src/app/api/.../route.ts").
const cwd = process.cwd().replace(/\\/g, "/")
const norm = (p: string) => p.replace(/\\/g, "/").replace(`${cwd}/`, "")

describe("route guard integrity", () => {
  it("found route files to scan", () => {
    expect(routeFiles.length).toBeGreaterThan(50)
  })

  it("every requirePermission code exists in the catalogue", () => {
    const codeRe = /requirePermission\([^,]+,\s*["'`]([a-z_]+:[a-z_]+:[a-z_]+)["'`]/g
    const missing: string[] = []
    for (const f of routeFiles) {
      const src = readFileSync(f, "utf8")
      for (const m of src.matchAll(codeRe)) {
        if (!CATALOGUE_BY_CODE.has(m[1])) missing.push(`${norm(f)}: ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })

  it("every mutating route references requirePermission (or is allowlisted)", () => {
    const unguarded: string[] = []
    for (const f of routeFiles) {
      const src = readFileSync(f, "utf8")
      const mutates = /export async function (POST|PATCH|PUT|DELETE)/.test(src)
      if (mutates && !src.includes("requirePermission") && !UNGUARDED_ALLOWLIST.has(norm(f))) {
        unguarded.push(norm(f))
      }
    }
    expect(unguarded).toEqual([])
  })
})
