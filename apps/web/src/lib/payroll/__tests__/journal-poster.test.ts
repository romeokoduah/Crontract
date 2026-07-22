import { describe, it, expect } from "vitest"
import type { Prisma } from "@prisma/client"
import {
  buildPayrollJournalLines,
  reverseLines,
  applyLoanRepayments,
} from "../journal-poster"

// ─── Test doubles ────────────────────────────────────────────────────────────
// journal-poster only touches a handful of Prisma methods; stub exactly those.

const ALL_LINE_TYPES = [
  "WAGES_EXPENSE",
  "EMPLOYER_SSNIT_EXPENSE",
  "EMPLOYER_TIER2_EXPENSE",
  "SSNIT_PAYABLE",
  "PAYE_PAYABLE",
  "TIER2_PAYABLE",
  "LOAN_RECEIVABLE",
  "NET_PAY_CLEARING",
] as const

function fullMappings() {
  return ALL_LINE_TYPES.map((lineType) => ({
    lineType,
    accountId: `acct-${lineType}`,
  }))
}

// A self-consistent payslip: netPay = gross - ssnitEmployee - paye - loanDeductions
// (the accounting identity that makes the journal balance).
function payslip(overrides: Partial<Record<string, number>> = {}) {
  const base = {
    gross: 1000,
    ssnitEmployee: 55,
    ssnitEmployer: 130,
    tier2: 50,
    paye: 80,
    loanDeductions: 100,
    netPay: 765,
  }
  return { ...base, ...overrides }
}

function makeTx(opts: {
  mappings?: { lineType: string; accountId: string }[]
  payslips?: Record<string, number>[]
  loans?: Record<string, { id: string; balance: number; status: string }>
  loanPayslips?: { componentsSnapshot: unknown }[]
}) {
  const loans = opts.loans ?? {}
  const updates: { id: string; data: { balance: number; status: string } }[] = []
  const tx = {
    payrollGlMapping: {
      findMany: async () => opts.mappings ?? fullMappings(),
    },
    payslip: {
      findMany: async (args?: { select?: unknown }) =>
        args && "select" in (args ?? {}) && opts.loanPayslips
          ? opts.loanPayslips
          : opts.payslips ?? [],
    },
    payrollLoan: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        loans[where.id] ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: { balance: number; status: string }
      }) => {
        updates.push({ id: where.id, data })
        return data
      },
    },
  }
  return { tx: tx as unknown as Prisma.TransactionClient, updates }
}

// ─── buildPayrollJournalLines ─────────────────────────────────────────────────

describe("buildPayrollJournalLines", () => {
  it("produces a balanced double-entry journal (DR == CR)", async () => {
    const { tx } = makeTx({ payslips: [payslip()] })
    const { lines, totals } = await buildPayrollJournalLines(tx, "ws1", "run1")

    expect(totals.debit).toBe(totals.credit)
    const dr = lines.reduce((s, l) => s + l.debit, 0)
    const cr = lines.reduce((s, l) => s + l.credit, 0)
    expect(Math.round((dr - cr) * 100) / 100).toBe(0)
  })

  it("maps each line to its configured GL account with correct amounts", async () => {
    const { tx } = makeTx({ payslips: [payslip()] })
    const { lines } = await buildPayrollJournalLines(tx, "ws1", "run1")
    const byAccount = Object.fromEntries(
      lines.map((l) => [l.accountId, l])
    )

    expect(byAccount["acct-WAGES_EXPENSE"]).toMatchObject({ debit: 1000, credit: 0 })
    expect(byAccount["acct-EMPLOYER_SSNIT_EXPENSE"]).toMatchObject({ debit: 130 })
    expect(byAccount["acct-EMPLOYER_TIER2_EXPENSE"]).toMatchObject({ debit: 50 })
    // SSNIT payable = employee 55 + employer 130
    expect(byAccount["acct-SSNIT_PAYABLE"]).toMatchObject({ debit: 0, credit: 185 })
    expect(byAccount["acct-PAYE_PAYABLE"]).toMatchObject({ credit: 80 })
    expect(byAccount["acct-NET_PAY_CLEARING"]).toMatchObject({ credit: 765 })
  })

  it("aggregates amounts across multiple payslips", async () => {
    const { tx } = makeTx({ payslips: [payslip(), payslip()] })
    const { totals } = await buildPayrollJournalLines(tx, "ws1", "run1")
    // Single payslip DR total is 1180; two payslips => 2360.
    expect(totals.debit).toBe(2360)
    expect(totals.credit).toBe(2360)
  })

  it("throws listing the missing GL mappings", async () => {
    const partial = fullMappings().filter((m) => m.lineType !== "PAYE_PAYABLE")
    const { tx } = makeTx({ mappings: partial, payslips: [payslip()] })
    await expect(buildPayrollJournalLines(tx, "ws1", "run1")).rejects.toThrow(
      /Missing GL mappings for: PAYE_PAYABLE/
    )
  })

  it("throws when the run has no payslips", async () => {
    const { tx } = makeTx({ payslips: [] })
    await expect(buildPayrollJournalLines(tx, "ws1", "run1")).rejects.toThrow(
      /No payslips on run/
    )
  })

  it("rounds fractional currency so cents don't break the balance check", async () => {
    const p = payslip({
      gross: 1000.005,
      ssnitEmployee: 55.001,
      paye: 80.002,
      loanDeductions: 100,
      netPay: 765.002,
    })
    const { tx } = makeTx({ payslips: [p] })
    const { totals } = await buildPayrollJournalLines(tx, "ws1", "run1")
    expect(Math.abs(totals.debit - totals.credit)).toBeLessThanOrEqual(0.01)
  })

  it("credits OTHER_DEDUCTIONS_PAYABLE and stays balanced when a payslip has other deductions", async () => {
    // Self-consistent: net = gross - ssnitEE - paye - loan - other = 1000 - 55 - 80 - 100 - 65 = 700
    const p = payslip({ otherDeductions: 65, netPay: 700 })
    const { tx } = makeTx({
      mappings: [
        ...fullMappings(),
        { lineType: "OTHER_DEDUCTIONS_PAYABLE", accountId: "acct-OTHER_DEDUCTIONS_PAYABLE" },
      ],
      payslips: [p],
    })
    const { lines, totals } = await buildPayrollJournalLines(tx, "ws1", "run1")

    expect(totals.debit).toBe(totals.credit)
    const byAccount = Object.fromEntries(lines.map((l) => [l.accountId, l]))
    expect(byAccount["acct-OTHER_DEDUCTIONS_PAYABLE"]).toMatchObject({ debit: 0, credit: 65 })
  })

  it("throws a clear error when other deductions exist but the GL mapping is unset", async () => {
    const p = payslip({ otherDeductions: 65, netPay: 700 })
    const { tx } = makeTx({ payslips: [p] }) // only the core 8 mappings
    await expect(buildPayrollJournalLines(tx, "ws1", "run1")).rejects.toThrow(
      /OTHER_DEDUCTIONS_PAYABLE/
    )
  })

  it("omits the other-deductions line entirely when there are none (backward compatible)", async () => {
    const { tx } = makeTx({ payslips: [payslip()] }) // no otherDeductions, 8 mappings
    const { lines } = await buildPayrollJournalLines(tx, "ws1", "run1")
    expect(lines.find((l) => l.accountId === "acct-OTHER_DEDUCTIONS_PAYABLE")).toBeUndefined()
  })
})

// ─── reverseLines ─────────────────────────────────────────────────────────────

describe("reverseLines", () => {
  it("swaps debit and credit and keeps the same accounts", () => {
    const lines = [
      { accountId: "a", debit: 100, credit: 0, memo: "Gross" },
      { accountId: "b", debit: 0, credit: 100, memo: "Net" },
    ]
    const reversed = reverseLines(lines)
    expect(reversed[0]).toEqual({ accountId: "a", debit: 0, credit: 100, memo: "Reversal: Gross" })
    expect(reversed[1]).toEqual({ accountId: "b", debit: 100, credit: 0, memo: "Reversal: Net" })
  })

  it("a journal plus its reversal nets to zero", () => {
    const lines = [
      { accountId: "a", debit: 100, credit: 0, memo: "x" },
      { accountId: "b", debit: 0, credit: 100, memo: "y" },
    ]
    const all = [...lines, ...reverseLines(lines)]
    const dr = all.reduce((s, l) => s + l.debit, 0)
    const cr = all.reduce((s, l) => s + l.credit, 0)
    expect(dr).toBe(cr)
    // Per account, debits and credits cancel.
    expect(all.filter((l) => l.accountId === "a").reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0)
  })
})

// ─── applyLoanRepayments ──────────────────────────────────────────────────────

describe("applyLoanRepayments", () => {
  const snapshot = (loanApplied: { loanId: string; amount: number }[]) => [
    { componentsSnapshot: { loanApplied } },
  ]

  it("decrements the loan balance on post (direction = 1)", async () => {
    const { tx, updates } = makeTx({
      loanPayslips: snapshot([{ loanId: "L1", amount: 100 }]),
      loans: { L1: { id: "L1", balance: 300, status: "ACTIVE" } },
    })
    await applyLoanRepayments(tx, "run1", 1)
    expect(updates).toEqual([{ id: "L1", data: { balance: 200, status: "ACTIVE" } }])
  })

  it("marks the loan PAID when the balance reaches zero", async () => {
    const { tx, updates } = makeTx({
      loanPayslips: snapshot([{ loanId: "L1", amount: 100 }]),
      loans: { L1: { id: "L1", balance: 100, status: "ACTIVE" } },
    })
    await applyLoanRepayments(tx, "run1", 1)
    expect(updates[0].data).toEqual({ balance: 0, status: "PAID" })
  })

  it("restores the balance on reverse (direction = -1)", async () => {
    const { tx, updates } = makeTx({
      loanPayslips: snapshot([{ loanId: "L1", amount: 100 }]),
      loans: { L1: { id: "L1", balance: 200, status: "ACTIVE" } },
    })
    await applyLoanRepayments(tx, "run1", -1)
    expect(updates[0].data).toEqual({ balance: 300, status: "ACTIVE" })
  })

  it("ignores zero/negative amounts and unknown loans", async () => {
    const { tx, updates } = makeTx({
      loanPayslips: snapshot([
        { loanId: "L1", amount: 0 },
        { loanId: "ghost", amount: 50 },
      ]),
      loans: {},
    })
    await applyLoanRepayments(tx, "run1", 1)
    expect(updates).toEqual([])
  })
})
