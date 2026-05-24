import type { Bracket, Reliefs, ReliefRates, PayslipInput, PayslipOutput } from "./types"

export function applyBrackets(annualTaxable: number, brackets: Bracket[]): number {
  if (annualTaxable <= 0) return 0
  let tax = 0
  for (const b of brackets) {
    if (annualTaxable <= b.min) break
    const upper = b.max ?? Infinity
    const slice = Math.min(annualTaxable, upper) - b.min
    if (slice > 0) tax += slice * b.rate
  }
  return round2(tax)
}

export function computeReliefs(reliefs: Reliefs, rates: ReliefRates, assessableIncome: number): number {
  let total = 0
  if (reliefs.personal)       total += rates.personal
  if (reliefs.marriage)       total += rates.marriage
  if (reliefs.dependantChildren && reliefs.dependantChildren > 0) {
    total += Math.min(reliefs.dependantChildren, 3) * rates.dependantPerChild
  }
  if (reliefs.oldAge)         total += rates.oldAge
  if (reliefs.agedDependant)  total += rates.agedDependant
  if (reliefs.disability)     total += assessableIncome * rates.disabilityPct
  return total
}

export function computePayslip(input: PayslipInput): PayslipOutput {
  const { basicSalary, components, daysWorked, daysInMonth, reliefs, loans, rates, ytd } = input

  const proRate = daysInMonth > 0 ? daysWorked / daysInMonth : 1
  const basicPro = round2(basicSalary * proRate)
  const earnings = components.filter(c => c.type === "EARNING")
  const otherComponents = components.filter(c => c.type === "DEDUCTION")

  const totalEarningsPro = round2(earnings.reduce((s, c) => s + c.amount, 0) * proRate)
  const taxableEarningsPro = round2(
    earnings.filter(c => c.taxable).reduce((s, c) => s + c.amount, 0) * proRate
  )

  const ssnitEmployee = round2(basicPro * rates.ssnitEmployee)
  const ssnitEmployer = round2(basicPro * rates.ssnitEmployer)
  const tier2 = round2(basicPro * rates.tier2)

  const annualGross = (basicPro + taxableEarningsPro) * 12
  const annualSsnit = ssnitEmployee * 12
  const assessable = Math.max(0, annualGross - annualSsnit)
  const annualReliefs = computeReliefs(reliefs, rates.reliefs, assessable)
  const annualTaxable = Math.max(0, assessable - annualReliefs)
  const annualPAYE = applyBrackets(annualTaxable, rates.paye)
  const monthlyPAYE = round2(annualPAYE / 12)

  const loanApplied = loans.map(l => ({
    loanId: l.id,
    amount: round2(Math.min(l.monthlyDeduction, l.balance)),
  }))
  let loanDeductions = round2(loanApplied.reduce((s, l) => s + l.amount, 0))
  let otherDeductions = round2(otherComponents.reduce((s, c) => s + c.amount, 0))

  const gross = round2(basicPro + totalEarningsPro)
  // Tier 2 is employer-paid in Ghana (mandatory occupational pension to a private trustee) —
  // it's reported on the payslip but NOT deducted from the employee's net pay.
  // Only SSNIT employee (5.5%) and PAYE come off the employee's pocket as statutory.
  const statutory = round2(ssnitEmployee + monthlyPAYE)
  let totalDeductions = round2(statutory + loanDeductions + otherDeductions)

  // Cap non-statutory deductions so net pay can't go negative.
  if (gross - totalDeductions < 0) {
    const room = Math.max(0, gross - statutory)
    const nonStatutory = loanDeductions + otherDeductions
    const scale = nonStatutory > 0 ? room / nonStatutory : 0
    loanDeductions = round2(loanDeductions * scale)
    otherDeductions = round2(otherDeductions * scale)
    for (const l of loanApplied) l.amount = round2(l.amount * scale)
    totalDeductions = round2(statutory + loanDeductions + otherDeductions)
  }
  const netPay = Math.max(0, round2(gross - totalDeductions))

  return {
    basicSalary: basicPro,
    totalEarnings: totalEarningsPro,
    totalDeductions,
    gross,
    paye: monthlyPAYE,
    ssnitEmployee,
    ssnitEmployer,
    tier2,
    loanDeductions,
    otherDeductions,
    netPay,
    loanApplied,
    ytdGross: round2(ytd.gross + gross),
    ytdPaye: round2(ytd.paye + monthlyPAYE),
    ytdSsnit: round2(ytd.ssnit + ssnitEmployee),
    snapshot: { rates, components, reliefs, daysWorked, daysInMonth },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
