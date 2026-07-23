import { describe, it, expect } from "vitest"
import { MODULE_VIEW_PERMISSION, ROLE_MODULE_VIEW } from "../route-map"

describe("MODULE_VIEW_PERMISSION", () => {
  it("gates payroll behind a payroll view code", () => {
    expect(MODULE_VIEW_PERMISSION["/payroll"]).toBe("payroll:run:view")
  })
  it("gates finance", () => {
    expect(MODULE_VIEW_PERMISSION["/finance"]).toBe("finance:invoice:view")
  })
  it("every mapped code is a real catalogue code", async () => {
    const { CATALOGUE_BY_CODE } = await import("@crontract/db/permissions/catalogue")
    for (const code of Object.values(MODULE_VIEW_PERMISSION)) {
      expect(CATALOGUE_BY_CODE.has(code)).toBe(true)
    }
  })
})

describe("ROLE_MODULE_VIEW (least-privilege)", () => {
  it("Owner and Administrator see every gated prefix", () => {
    const all = Object.values(MODULE_VIEW_PERMISSION).length
    expect(ROLE_MODULE_VIEW.Owner.size).toBe(all)
    expect(ROLE_MODULE_VIEW.Administrator.size).toBe(all)
  })
  it("Manager sees only people + procurement, NOT finance/payroll/etc.", () => {
    expect(ROLE_MODULE_VIEW.Manager.has(MODULE_VIEW_PERMISSION["/people"])).toBe(true)
    expect(ROLE_MODULE_VIEW.Manager.has(MODULE_VIEW_PERMISSION["/procurement"])).toBe(true)
    expect(ROLE_MODULE_VIEW.Manager.has(MODULE_VIEW_PERMISSION["/payroll"])).toBe(false)
    expect(ROLE_MODULE_VIEW.Manager.has(MODULE_VIEW_PERMISSION["/finance"])).toBe(false)
  })
  it("Employee sees no gated (sensitive) prefix", () => {
    expect(ROLE_MODULE_VIEW.Employee.size).toBe(0)
  })
})
