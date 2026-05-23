import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { requireAdminRole } from "@/lib/authorization"

const schema = z.object({
  payComponentId: z.string().uuid(),
  amount: z.number().nonnegative(),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
})

async function verifyEmployeeInWorkspace(employeeId: string, workspaceId: string) {
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, workspaceId } })
  return !!emp
}

export async function GET(_: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!

  if (!(await verifyEmployeeInWorkspace(ctx.params.id, workspaceId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const setups = await prisma.employeePaySetup.findMany({
    where: { employeeId: ctx.params.id },
    include: { payComponent: true },
    orderBy: { startDate: "desc" },
  })
  return NextResponse.json({ setups })
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const denied = requireAdminRole(session); if (denied) return denied
  const workspaceId = session!.user.workspaceId!
  const userId = session!.user.id

  if (!(await verifyEmployeeInWorkspace(ctx.params.id, workspaceId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  // Verify component belongs to same workspace
  const comp = await prisma.payComponent.findFirst({
    where: { id: parsed.data.payComponentId, workspaceId, deletedAt: null },
  })
  if (!comp) return NextResponse.json({ error: "Pay component not found" }, { status: 404 })
  if (comp.type === "STATUTORY") {
    return NextResponse.json({ error: "Statutory components are computed automatically and cannot be set per-employee" }, { status: 400 })
  }

  try {
    const setup = await prisma.employeePaySetup.create({
      data: {
        employeeId: ctx.params.id,
        payComponentId: parsed.data.payComponentId,
        amount: parsed.data.amount,
        startDate: new Date(parsed.data.startDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
      include: { payComponent: true },
    })
    await prisma.auditLog.create({
      data: {
        workspaceId, userId,
        entityType: "employee_pay_setup", entityId: setup.id,
        action: "CREATE",
        afterState: { employeeId: ctx.params.id, code: comp.code, amount: parsed.data.amount },
      },
    })
    return NextResponse.json({ setup }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return NextResponse.json({ error: "This component is already set for this start date" }, { status: 409 })
    }
    console.error("[POST /api/payroll/employees/[id]/setup]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
