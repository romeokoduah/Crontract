import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const schema = z.object({
  code: z.string().min(1).max(30).toUpperCase(),
  name: z.string().min(1),
  type: z.enum(["EARNING", "DEDUCTION", "STATUTORY", "LOAN"]),
  taxable: z.boolean().default(true),
  pensionable: z.boolean().default(false),
  defaultAmount: z.number().nonnegative().optional(),
  sequence: z.number().int().default(0),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!

  const components = await prisma.payComponent.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: [{ sequence: "asc" }, { name: "asc" }],
  })
  return NextResponse.json({ components })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", detail: parsed.error.issues.map(i => i.message).join(", ") },
      { status: 400 }
    )
  }

  try {
    const component = await prisma.payComponent.create({
      data: { workspaceId, ...parsed.data },
    })
    await prisma.auditLog.create({
      data: {
        workspaceId, userId,
        entityType: "pay_component", entityId: component.id,
        action: "CREATE", afterState: { code: component.code, name: component.name },
      },
    })
    return NextResponse.json({ component }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return NextResponse.json({ error: "Component code already exists" }, { status: 409 })
    }
    console.error("[POST /api/payroll/components]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
