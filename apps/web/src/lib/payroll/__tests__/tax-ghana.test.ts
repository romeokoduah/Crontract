import { describe, it, expect } from "vitest"
import { applyBrackets, computeReliefs, computePayslip } from "../tax-ghana"
import type { RatePack, PayslipInput } from "../types"

const GH_2024: RatePack = {
  paye: [
    { min: 0,      max: 4824,   rate: 0 },
    { min: 4824,   max: 6144,   rate: 0.05 },
    { min: 6144,   max: 7704,   rate: 0.10 },
    { min: 7704,   max: 43704,  rate: 0.175 },
    { min: 43704,  max: 240444, rate: 0.25 },
    { min: 240444, max: 600444, rate: 0.30 },
    { min: 600444, max: null,   rate: 0.35 },
  ],
  ssnitEmployee: 0.055,
  ssnitEmployer: 0.13,
  tier2: 0.05,
  reliefs: {
    personal: 1200, marriage: 1200, dependantPerChild: 600,
    oldAge: 1500, agedDependant: 1000, disabilityPct: 0.25,
  },
}

describe("applyBrackets", () => {
  it("returns 0 within the tax-free band", () => {
    expect(applyBrackets(0, GH_2024.paye)).toBe(0)
    expect(applyBrackets(4824, GH_2024.paye)).toBe(0)
    expect(applyBrackets(-100, GH_2024.paye)).toBe(0)
  })

  it("taxes only the amount above the tax-free band", () => {
    expect(applyBrackets(6144, GH_2024.paye)).toBeCloseTo(66, 2)
  })

  it("spans multiple brackets correctly at 17.5% top", () => {
    expect(applyBrackets(43704, GH_2024.paye)).toBeCloseTo(6522, 2)
  })

  it("hits the 25% bracket at the boundary", () => {
    expect(applyBrackets(43705, GH_2024.paye)).toBeCloseTo(6522.25, 2)
  })

  it("applies the 35% rate above 600,444", () => {
    const base600444 = applyBrackets(600444, GH_2024.paye)
    expect(applyBrackets(700444, GH_2024.paye)).toBeCloseTo(base600444 + 100_000 * 0.35, 0)
  })
})

describe("computeReliefs", () => {
  it("returns 0 when no flags are set", () => {
    expect(computeReliefs({}, GH_2024.reliefs, 50000)).toBe(0)
  })

  it("sums personal + marriage + 2 children", () => {
    const r = computeReliefs({ personal: true, marriage: true, dependantChildren: 2 }, GH_2024.reliefs, 50000)
    expect(r).toBe(1200 + 1200 + 1200)
  })

  it("caps dependant children at 3", () => {
    const r = computeReliefs({ dependantChildren: 5 }, GH_2024.reliefs, 50000)
    expect(r).toBe(1800)
  })

  it("disability is 25% of assessable income", () => {
    expect(computeReliefs({ disability: true }, GH_2024.reliefs, 80000)).toBeCloseTo(20000, 2)
  })

  it("combines all reliefs", () => {
    const r = computeReliefs(
      { personal: true, marriage: true, dependantChildren: 3, oldAge: true, agedDependant: true, disability: true },
      GH_2024.reliefs, 100000
    )
    expect(r).toBeCloseTo(1200 + 1200 + 1800 + 1500 + 1000 + 25000, 2)
  })
})

describe("computePayslip", () => {
  const base: PayslipInput = {
    basicSalary: 12000,
    components: [
      { componentId: "c1", code: "HOUSING",   name: "Housing",   type: "EARNING", taxable: true, pensionable: false, amount: 3000 },
      { componentId: "c2", code: "TRANSPORT", name: "Transport", type: "EARNING", taxable: true, pensionable: false, amount: 1500 },
    ],
    daysWorked: 30,
    daysInMonth: 30,
    reliefs: { personal: true, marriage: true, dependantChildren: 1 },
    loans: [],
    rates: GH_2024,
    ytd: { gross: 0, paye: 0, ssnit: 0 },
  }

  it("gross = basic + earnings", () => {
    expect(computePayslip(base).gross).toBeCloseTo(16500, 2)
  })

  it("SSNIT employee at 5.5% of basic", () => {
    expect(computePayslip(base).ssnitEmployee).toBeCloseTo(660, 2)
  })

  it("SSNIT employer at 13% of basic", () => {
    expect(computePayslip(base).ssnitEmployer).toBeCloseTo(1560, 2)
  })

  it("Tier 2 at 5% of basic", () => {
    expect(computePayslip(base).tier2).toBeCloseTo(600, 2)
  })

  it("net = gross - PAYE - SSNIT_EE (Tier 2 is employer-paid, not employee deduction)", () => {
    const out = computePayslip(base)
    expect(out.netPay).toBeCloseTo(out.gross - out.paye - out.ssnitEmployee, 2)
  })

  it("pro-rates basic and earnings when daysWorked < daysInMonth", () => {
    const out = computePayslip({ ...base, daysWorked: 15 })
    expect(out.basicSalary).toBeCloseTo(6000, 2)
    expect(out.totalEarnings).toBeCloseTo(2250, 2)
    expect(out.gross).toBeCloseTo(8250, 2)
  })

  it("excludes non-taxable allowances from PAYE base", () => {
    const withMedical = computePayslip({
      ...base,
      components: [
        ...base.components,
        { componentId: "c3", code: "MEDICAL", name: "Medical", type: "EARNING", taxable: false, pensionable: false, amount: 1000 },
      ],
    })
    // Medical adds to gross but not to PAYE base
    expect(withMedical.gross).toBeCloseTo(17500, 2)
    expect(withMedical.paye).toBeCloseTo(computePayslip(base).paye, 2)
  })

  it("net pay never goes negative when statutory exceeds non-statutory room", () => {
    const out = computePayslip({
      ...base,
      basicSalary: 2000,
      components: [],
      loans: [{ id: "L1", monthlyDeduction: 5000, balance: 5000 }],
    })
    expect(out.netPay).toBeGreaterThanOrEqual(0)
  })

  it("caps loan deduction at remaining balance", () => {
    const out = computePayslip({
      ...base,
      loans: [{ id: "L1", monthlyDeduction: 1000, balance: 250 }],
    })
    expect(out.loanApplied[0].amount).toBeCloseTo(250, 2)
    expect(out.loanDeductions).toBeCloseTo(250, 2)
  })

  it("accumulates YTD across runs", () => {
    const o1 = computePayslip(base)
    const o2 = computePayslip({ ...base, ytd: { gross: o1.gross, paye: o1.paye, ssnit: o1.ssnitEmployee } })
    expect(o2.ytdGross).toBeCloseTo(o1.gross * 2, 2)
    expect(o2.ytdPaye).toBeCloseTo(o1.paye * 2, 2)
    expect(o2.ytdSsnit).toBeCloseTo(o1.ssnitEmployee * 2, 2)
  })

  it("snapshot captures the rates and components used", () => {
    const out = computePayslip(base)
    expect(out.snapshot.rates).toBe(GH_2024)
    expect(out.snapshot.components).toHaveLength(2)
    expect(out.snapshot.daysWorked).toBe(30)
  })

  it("non-taxable EARNING does not show in components for PAYE math", () => {
    const out = computePayslip({
      ...base,
      components: [
        { componentId: "c1", code: "MEDICAL", name: "Medical", type: "EARNING", taxable: false, pensionable: false, amount: 5000 },
      ],
    })
    // Only medical (non-taxable) — PAYE should be exactly what 12000 basic alone produces
    const baseOnly = computePayslip({ ...base, components: [] })
    expect(out.paye).toBeCloseTo(baseOnly.paye, 2)
    expect(out.gross).toBeCloseTo(17000, 2)
  })
})
