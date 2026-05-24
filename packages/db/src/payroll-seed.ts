import { PrismaClient, TaxRateType, PayComponentType } from "@prisma/client"

// Ghana 2024 PAYE annual brackets — verify against current GRA tables before production.
const PAYE_BRACKETS_2024 = [
  { min: 0,      max: 4824,   rate: 0 },
  { min: 4824,   max: 6144,   rate: 0.05 },
  { min: 6144,   max: 7704,   rate: 0.10 },
  { min: 7704,   max: 43704,  rate: 0.175 },
  { min: 43704,  max: 240444, rate: 0.25 },
  { min: 240444, max: 600444, rate: 0.30 },
  { min: 600444, max: null,   rate: 0.35 },
]

const DEFAULT_COMPONENTS = [
  { code: "BASIC",     name: "Basic Salary",        type: PayComponentType.EARNING,   taxable: true,  pensionable: true,  sequence: 1 },
  { code: "HOUSING",   name: "Housing Allowance",   type: PayComponentType.EARNING,   taxable: true,  pensionable: false, sequence: 2 },
  { code: "TRANSPORT", name: "Transport Allowance", type: PayComponentType.EARNING,   taxable: true,  pensionable: false, sequence: 3 },
  { code: "MEDICAL",   name: "Medical Allowance",   type: PayComponentType.EARNING,   taxable: false, pensionable: false, sequence: 4 },
  { code: "OVERTIME",  name: "Overtime",            type: PayComponentType.EARNING,   taxable: true,  pensionable: false, sequence: 5 },
  { code: "BONUS",     name: "Bonus",               type: PayComponentType.EARNING,   taxable: true,  pensionable: false, sequence: 6 },
  { code: "PAYE",      name: "PAYE",                type: PayComponentType.STATUTORY, taxable: false, pensionable: false, sequence: 100 },
  { code: "SSNIT_EE",  name: "SSNIT (5.5%)",        type: PayComponentType.STATUTORY, taxable: false, pensionable: false, sequence: 101 },
  { code: "TIER2",     name: "Tier 2 (5%)",         type: PayComponentType.STATUTORY, taxable: false, pensionable: false, sequence: 102 },
]

/**
 * Set basic salaries + pay setups on existing employees so a fresh workspace
 * has a usable payroll demo. Idempotent.
 */
export async function seedDemoEmployeePayroll(
  prisma: PrismaClient,
  workspaceId: string,
  salaryByEmail: Record<string, { basic: number; housing?: number; transport?: number }>,
) {
  const components = await prisma.payComponent.findMany({ where: { workspaceId, deletedAt: null } })
  const byCode = new Map(components.map(c => [c.code, c]))
  const startDate = new Date(new Date().getFullYear(), 0, 1)

  for (const [email, amounts] of Object.entries(salaryByEmail)) {
    const emp = await prisma.employee.findFirst({
      where: { workspaceId, email },
    })
    if (!emp) continue

    await prisma.employee.update({
      where: { id: emp.id },
      data: {
        basicSalary: amounts.basic,
        taxReliefs: { personal: true, marriage: false, dependantChildren: 0, oldAge: false, agedDependant: false, disability: false },
      },
    })

    // Wipe existing setups for this employee then recreate (idempotent)
    await prisma.employeePaySetup.deleteMany({ where: { employeeId: emp.id } })

    if (amounts.housing && byCode.has("HOUSING")) {
      await prisma.employeePaySetup.create({
        data: { employeeId: emp.id, payComponentId: byCode.get("HOUSING")!.id, amount: amounts.housing, startDate },
      })
    }
    if (amounts.transport && byCode.has("TRANSPORT")) {
      await prisma.employeePaySetup.create({
        data: { employeeId: emp.id, payComponentId: byCode.get("TRANSPORT")!.id, amount: amounts.transport, startDate },
      })
    }
  }
}

export async function seedPayrollDefaults(prisma: PrismaClient, workspaceId: string, taxYear = 2024) {
  await prisma.taxRateTable.deleteMany({ where: { workspaceId, taxYear } })

  const rateRows = [
    ...PAYE_BRACKETS_2024.map((b, i) => ({
      workspaceId,
      taxYear,
      type: TaxRateType.PAYE_BRACKET,
      value: b.rate,
      bracketMin: b.min,
      bracketMax: b.max ?? null,
      sequence: i,
    })),
    { workspaceId, taxYear, type: TaxRateType.SSNIT_EMPLOYEE,             value: 0.055, sequence: 0 },
    { workspaceId, taxYear, type: TaxRateType.SSNIT_EMPLOYER,             value: 0.13,  sequence: 0 },
    { workspaceId, taxYear, type: TaxRateType.TIER2,                      value: 0.05,  sequence: 0 },
    { workspaceId, taxYear, type: TaxRateType.RELIEF_PERSONAL,            value: 1200,  sequence: 0 },
    { workspaceId, taxYear, type: TaxRateType.RELIEF_MARRIAGE,            value: 1200,  sequence: 0 },
    { workspaceId, taxYear, type: TaxRateType.RELIEF_DEPENDANT_PER_CHILD, value: 600,   sequence: 0 },
    { workspaceId, taxYear, type: TaxRateType.RELIEF_OLD_AGE,             value: 1500,  sequence: 0 },
    { workspaceId, taxYear, type: TaxRateType.RELIEF_AGED_DEPENDANT,      value: 1000,  sequence: 0 },
    { workspaceId, taxYear, type: TaxRateType.RELIEF_DISABILITY_PCT,      value: 0.25,  sequence: 0 },
  ]

  await prisma.taxRateTable.createMany({ data: rateRows })

  for (const c of DEFAULT_COMPONENTS) {
    await prisma.payComponent.upsert({
      where: { workspaceId_code: { workspaceId, code: c.code } },
      update: {},
      create: { workspaceId, ...c },
    })
  }
}
