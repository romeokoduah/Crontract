import { describe, it, expect } from "vitest"
import { CATALOGUE, CATALOGUE_BY_CODE, moduleOf } from "../catalogue"

describe("permission catalogue", () => {
  it("has unique codes", () => {
    const codes = CATALOGUE.map((p) => p.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("every code is module:entity:action", () => {
    for (const p of CATALOGUE) {
      expect(p.code).toBe(`${p.module}:${p.entity}:${p.action}`)
    }
  })

  it("every code declares at least one scope", () => {
    for (const p of CATALOGUE) expect(p.scopes.length).toBeGreaterThan(0)
  })

  it("preserves the existing payroll self-service code as OWN", () => {
    const p = CATALOGUE_BY_CODE.get("payroll:payslip:view_own")
    expect(p).toBeDefined()
    expect(p!.scopes).toEqual(["OWN"])
  })

  it("covers every catalogued module", () => {
    const modules = new Set(CATALOGUE.map((p) => moduleOf(p.code)))
    for (const m of [
      "admin","approvals","assets","budget","compliance","crm","dashboard",
      "documents","finance","grants","hse","meetings","notifications",
      "payroll","people","procurement","projects","reports","social",
    ]) expect(modules.has(m)).toBe(true)
  })
})
