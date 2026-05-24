import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"
import { TaxRateType } from "@prisma/client"

const TYPE_VALUES = [
  "PAYE_BRACKET","SSNIT_EMPLOYEE","SSNIT_EMPLOYER","TIER2",
  "RELIEF_PERSONAL","RELIEF_MARRIAGE","RELIEF_DEPENDANT_PER_CHILD",
  "RELIEF_OLD_AGE","RELIEF_AGED_DEPENDANT","RELIEF_DISABILITY_PCT",
] as const

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  taxYear: z.number().int().min(2020).max(2100),
  type: z.enum(TYPE_VALUES),
  value: z.number().nonnegative(),
  bracketMin: z.number().nonnegative().nullable().optional(),
  bracketMax: z.number().nonnegative().nullable().optional(),
  sequence: z.number().int().default(0),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get("year") ?? "0", 10)

  const rates = await prisma.taxRateTable.findMany({
    where: { workspaceId, ...(year ? { taxYear: year } : {}) },
    orderBy: [{ taxYear: "desc" }, { type: "asc" }, { sequence: "asc" }],
  })
  return NextResponse.json({ rates })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const body = await req.json()
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", detail: parsed.error.issues.map(i => i.message).join(", ") },
      { status: 400 }
    )
  }

  const { id, ...data } = parsed.data
  const row = id
    ? await prisma.taxRateTable.update({
        where: { id },
        data: {
          taxYear: data.taxYear,
          type: data.type as TaxRateType,
          value: data.value,
          bracketMin: data.bracketMin ?? null,
          bracketMax: data.bracketMax ?? null,
          sequence: data.sequence,
        },
      })
    : await prisma.taxRateTable.create({
        data: {
          workspaceId,
          taxYear: data.taxYear,
          type: data.type as TaxRateType,
          value: data.value,
          bracketMin: data.bracketMin ?? null,
          bracketMax: data.bracketMax ?? null,
          sequence: data.sequence,
        },
      })

  await prisma.auditLog.create({
    data: {
      workspaceId, userId,
      entityType: "tax_rate", entityId: row.id,
      action: id ? "UPDATE" : "CREATE",
      afterState: { type: data.type, value: data.value, taxYear: data.taxYear },
    },
  })
  return NextResponse.json({ rate: row })
}
