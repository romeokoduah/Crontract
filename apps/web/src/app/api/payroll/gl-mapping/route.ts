import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { PayrollGlLineType, AccountType } from "@prisma/client"

const DEFAULTS: { lineType: PayrollGlLineType; code: string; name: string; type: AccountType }[] = [
  { lineType: "WAGES_EXPENSE",          code: "5000", name: "Wages & Salaries Expense", type: "EXPENSE" },
  { lineType: "EMPLOYER_SSNIT_EXPENSE", code: "5010", name: "Employer SSNIT Expense",   type: "EXPENSE" },
  { lineType: "EMPLOYER_TIER2_EXPENSE", code: "5020", name: "Employer Tier 2 Expense",  type: "EXPENSE" },
  { lineType: "SSNIT_PAYABLE",          code: "2100", name: "SSNIT Payable",            type: "LIABILITY" },
  { lineType: "PAYE_PAYABLE",           code: "2110", name: "PAYE Payable",             type: "LIABILITY" },
  { lineType: "TIER2_PAYABLE",          code: "2120", name: "Tier 2 Payable",           type: "LIABILITY" },
  { lineType: "LOAN_RECEIVABLE",        code: "1310", name: "Staff Loans Receivable",   type: "ASSET" },
  { lineType: "NET_PAY_CLEARING",       code: "1010", name: "Net Pay Clearing",         type: "LIABILITY" },
]

const lineTypeEnum = z.enum([
  "WAGES_EXPENSE","EMPLOYER_SSNIT_EXPENSE","EMPLOYER_TIER2_EXPENSE",
  "SSNIT_PAYABLE","PAYE_PAYABLE","TIER2_PAYABLE","LOAN_RECEIVABLE","NET_PAY_CLEARING",
])

const applySchema = z.object({
  mappings: z.array(z.object({
    lineType: lineTypeEnum,
    accountId: z.string().uuid().optional(),
    create: z.boolean().optional(),
  })).length(8),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!

  const [mappings, accounts] = await Promise.all([
    prisma.payrollGlMapping.findMany({ where: { workspaceId }, include: { account: true } }),
    prisma.account_GL.findMany({ where: { workspaceId, isActive: true }, orderBy: { code: "asc" } }),
  ])

  return NextResponse.json({ mappings, accounts, defaults: DEFAULTS })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const body = await req.json()
  const parsed = applySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", detail: parsed.error.issues.map(i => i.message).join(", ") },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const out: { lineType: PayrollGlLineType; accountId: string }[] = []
      for (const m of parsed.data.mappings) {
        let accountId = m.accountId
        if (m.create) {
          const def = DEFAULTS.find(d => d.lineType === m.lineType)!
          let code = def.code
          let suffix = 1
          while (await tx.account_GL.findUnique({ where: { workspaceId_code: { workspaceId, code } } })) {
            code = `${def.code}-${suffix++}`
          }
          const acct = await tx.account_GL.create({
            data: { workspaceId, code, name: def.name, type: def.type, isActive: true },
          })
          accountId = acct.id
        }
        if (!accountId) throw new Error(`No account specified for ${m.lineType}`)
        await tx.payrollGlMapping.upsert({
          where: { workspaceId_lineType: { workspaceId, lineType: m.lineType } },
          update: { accountId },
          create: { workspaceId, lineType: m.lineType, accountId },
        })
        out.push({ lineType: m.lineType, accountId })
      }
      await tx.auditLog.create({
        data: {
          workspaceId, userId,
          entityType: "payroll_gl_mapping", entityId: workspaceId,
          action: "UPDATE", afterState: { mappings: out },
        },
      })
      return out
    })

    return NextResponse.json({ mappings: result })
  } catch (err) {
    console.error("[POST /api/payroll/gl-mapping]", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
