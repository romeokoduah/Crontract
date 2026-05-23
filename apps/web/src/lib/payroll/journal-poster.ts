import { Prisma, PayrollGlLineType } from "@prisma/client"

type Direction = "DR" | "CR"
type Line = { accountId: string; debit: number; credit: number; memo: string }

const REQUIRED: PayrollGlLineType[] = [
  "WAGES_EXPENSE",
  "EMPLOYER_SSNIT_EXPENSE",
  "EMPLOYER_TIER2_EXPENSE",
  "SSNIT_PAYABLE",
  "PAYE_PAYABLE",
  "TIER2_PAYABLE",
  "LOAN_RECEIVABLE",
  "NET_PAY_CLEARING",
]

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function buildPayrollJournalLines(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  runId: string,
): Promise<{ lines: Line[]; totals: { debit: number; credit: number } }> {
  const mappings = await tx.payrollGlMapping.findMany({ where: { workspaceId } })
  const map = new Map<PayrollGlLineType, string>(mappings.map(m => [m.lineType, m.accountId]))
  const missing = REQUIRED.filter(r => !map.has(r))
  if (missing.length > 0) {
    throw new Error(`Missing GL mappings for: ${missing.join(", ")}. Configure them at /payroll/gl-mapping.`)
  }

  const payslips = await tx.payslip.findMany({ where: { payrollRunId: runId } })
  if (payslips.length === 0) throw new Error("No payslips on run")

  const wages = round2(payslips.reduce((s, p) => s + Number(p.gross), 0))
  const emprSsnit = round2(payslips.reduce((s, p) => s + Number(p.ssnitEmployer), 0))
  const emprTier2 = round2(payslips.reduce((s, p) => s + Number(p.tier2), 0))
  const ssnitPayable = round2(payslips.reduce((s, p) => s + Number(p.ssnitEmployee) + Number(p.ssnitEmployer), 0))
  const payePayable = round2(payslips.reduce((s, p) => s + Number(p.paye), 0))
  const tier2Payable = round2(payslips.reduce((s, p) => s + Number(p.tier2), 0))
  const loanCr = round2(payslips.reduce((s, p) => s + Number(p.loanDeductions), 0))
  const netClearing = round2(payslips.reduce((s, p) => s + Number(p.netPay), 0))

  const dr = (lineType: PayrollGlLineType, amount: number, memo: string): Line =>
    ({ accountId: map.get(lineType)!, debit: amount, credit: 0, memo })
  const cr = (lineType: PayrollGlLineType, amount: number, memo: string): Line =>
    ({ accountId: map.get(lineType)!, debit: 0, credit: amount, memo })

  const lines: Line[] = [
    dr("WAGES_EXPENSE",          wages,        "Gross payroll"),
    dr("EMPLOYER_SSNIT_EXPENSE", emprSsnit,    "Employer SSNIT 13%"),
    dr("EMPLOYER_TIER2_EXPENSE", emprTier2,    "Employer Tier 2 5%"),
    cr("SSNIT_PAYABLE",          ssnitPayable, "SSNIT employee + employer"),
    cr("PAYE_PAYABLE",           payePayable,  "PAYE withheld"),
    cr("TIER2_PAYABLE",          tier2Payable, "Tier 2"),
    cr("LOAN_RECEIVABLE",        loanCr,       "Loan repayments"),
    cr("NET_PAY_CLEARING",       netClearing,  "Net pay to disburse"),
  ].filter(l => l.debit > 0 || l.credit > 0)

  const totalDr = round2(lines.reduce((s, l) => s + l.debit, 0))
  const totalCr = round2(lines.reduce((s, l) => s + l.credit, 0))
  if (Math.abs(totalDr - totalCr) > 0.01) {
    throw new Error(`Journal imbalance: DR ${totalDr} CR ${totalCr}`)
  }
  return { lines, totals: { debit: totalDr, credit: totalCr } }
}

/** Reversing journal: swap each line's debit <-> credit. Same accounts. */
export function reverseLines(lines: Line[]): Line[] {
  return lines.map(l => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, memo: `Reversal: ${l.memo}` }))
}

/** Decrement active loans by the per-employee loanApplied amounts captured in payslip snapshot. */
export async function applyLoanRepayments(
  tx: Prisma.TransactionClient,
  runId: string,
  direction: 1 | -1,   // 1 = post (decrement balance), -1 = reverse (increment back)
) {
  const payslips = await tx.payslip.findMany({
    where: { payrollRunId: runId },
    select: { componentsSnapshot: true },
  })
  for (const p of payslips) {
    const snap = p.componentsSnapshot as { loanApplied?: { loanId: string; amount: number }[] }
    if (!snap?.loanApplied?.length) continue
    for (const la of snap.loanApplied) {
      if (la.amount <= 0) continue
      const loan = await tx.payrollLoan.findUnique({ where: { id: la.loanId } })
      if (!loan) continue
      const delta = la.amount * direction
      const newBalance = round2(Number(loan.balance) - delta)
      await tx.payrollLoan.update({
        where: { id: la.loanId },
        data: {
          balance: newBalance,
          status: newBalance <= 0 ? "PAID" : "ACTIVE",
        },
      })
    }
  }
}
