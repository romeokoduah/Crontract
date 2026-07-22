import { describe, it, expect } from "vitest"
import { defaultGrantsForRole } from "../role-defaults"

describe("defaultGrantsForRole", () => {
  it("Owner gets every catalogue code at ALL", () => {
    const g = defaultGrantsForRole("Owner")
    expect(g.every((x) => x.scope === "ALL")).toBe(true)
    expect(g.length).toBeGreaterThan(50)
  })

  it("Administrator matches Owner", () => {
    expect(defaultGrantsForRole("Administrator").length)
      .toBe(defaultGrantsForRole("Owner").length)
  })

  it("Employee cannot view payroll runs", () => {
    const codes = defaultGrantsForRole("Employee").map((x) => x.code)
    expect(codes).not.toContain("payroll:run:view")
  })

  it("Employee can view own payslip", () => {
    const codes = defaultGrantsForRole("Employee").map((x) => x.code)
    expect(codes).toContain("payroll:payslip:view_own")
  })

  it("Employee cannot view finance invoices", () => {
    const codes = defaultGrantsForRole("Employee").map((x) => x.code)
    expect(codes).not.toContain("finance:invoice:view")
  })

  it("Manager views projects at ALL but updates at TEAM", () => {
    const g = defaultGrantsForRole("Manager")
    expect(g.find((x) => x.code === "projects:task:view")?.scope).toBe("ALL")
    expect(g.find((x) => x.code === "projects:task:update")?.scope).toBe("TEAM")
  })

  // Least-privilege: Manager does NOT see company-wide financial / admin data by default.
  it("Manager cannot view finance, payroll runs, admin audit, or compliance", () => {
    const codes = defaultGrantsForRole("Manager").map((x) => x.code)
    expect(codes).not.toContain("finance:invoice:view")
    expect(codes).not.toContain("payroll:run:view")
    expect(codes).not.toContain("admin:audit:view")
    expect(codes).not.toContain("compliance:obligation:view")
    expect(codes).not.toContain("budget:budget:view")
  })

  it("Manager keeps self-service basics (dashboard, notifications, approvals)", () => {
    const codes = defaultGrantsForRole("Manager").map((x) => x.code)
    expect(codes).toContain("dashboard:dashboard:view")
    expect(codes).toContain("notifications:notification:view")
    expect(codes).toContain("approvals:approval:act")
  })

  it("Manager can view people (HR) and manage operational modules", () => {
    const g = defaultGrantsForRole("Manager")
    expect(g.find((x) => x.code === "people:employee:view")).toBeDefined()
    expect(g.find((x) => x.code === "procurement:po:view")?.scope).toBe("ALL")
    expect(g.find((x) => x.code === "crm:contact:manage")?.scope).toBe("TEAM")
  })

  it("unknown role gets no grants (fail-closed)", () => {
    expect(defaultGrantsForRole("Nonexistent")).toEqual([])
  })
})
